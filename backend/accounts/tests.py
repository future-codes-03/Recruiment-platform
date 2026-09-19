import uuid
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from company.models import Company
from jobs.models import Skill

from .models import AuthProvider, User, UserRole


class GoogleLoginViewTests(TestCase):
    url = '/api/v1/auth/google'

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_creates_candidate_on_first_login(self, mock_verify):
        mock_verify.return_value = {
            'email': 'new@example.com',
            'email_verified': True,
            'name': 'New Candidate',
        }

        response = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body['user']['role'], 'candidate')
        self.assertIn('access_token', body)
        self.assertIn('refresh_token', body)
        self.assertIn('expires_in', body)

        user = User.objects.get(email__iexact='new@example.com')
        self.assertEqual(user.role, UserRole.CANDIDATE)
        self.assertIsNone(user.company)
        self.assertIsNotNone(user.email_verified_at)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.auth_provider, AuthProvider.GOOGLE)

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_new_candidate_is_gated_on_phone_and_cv_and_skills(self, mock_verify):
        """Google supplies a name and an email and nothing else, so a
        brand-new Google candidate owes everything but their name."""
        mock_verify.return_value = {
            'email': 'gated@example.com',
            'email_verified': True,
            'name': 'Gated Candidate',
        }

        response = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertFalse(body['profile_complete'])
        self.assertEqual(body['missing_fields'], ['resume_url', 'skills', 'phone'])

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_missing_name_claim_stores_blank_full_name(self, mock_verify):
        """No `name` claim stores '' rather than falling back to the email
        address — an empty name is a fact the gate can act on, an email
        parked in full_name is indistinguishable from a real name."""
        mock_verify.return_value = {
            'email': 'noname@example.com',
            'email_verified': True,
        }

        response = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(response.status_code, 201)
        self.assertIn('full_name', response.json()['missing_fields'])
        user = User.objects.get(email__iexact='noname@example.com')
        self.assertEqual(user.full_name, '')

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_does_not_reclassify_existing_email_password_candidate(self, mock_verify):
        """Using the Google button once must not rewrite the origin of an
        email/password account — that account collected a phone at signup and
        must not start being gated on one."""
        User.objects.create_user(
            email='existing@example.com',
            password='pw12345678',
            full_name='Existing Candidate',
            role=UserRole.CANDIDATE,
        )
        mock_verify.return_value = {
            'email': 'existing@example.com',
            'email_verified': True,
            'name': 'Existing Candidate',
        }

        response = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(response.status_code, 200)
        user = User.objects.get(email__iexact='existing@example.com')
        self.assertEqual(user.auth_provider, AuthProvider.EMAIL)
        # Gated on CV + skills only, never on phone.
        self.assertEqual(response.json()['missing_fields'], ['resume_url', 'skills'])

    def test_email_password_signup_is_recorded_as_email_provider(self):
        response = self.client.post(
            '/api/v1/auth/signup/candidate',
            {
                'email': 'pwuser@example.com',
                'password': 'pw12345678xyz',
                'full_name': 'Password User',
                'phone': '03001234567',
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email__iexact='pwuser@example.com')
        self.assertEqual(user.auth_provider, AuthProvider.EMAIL)

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_replayed_login_reuses_same_user(self, mock_verify):
        mock_verify.return_value = {
            'email': 'repeat@example.com',
            'email_verified': True,
            'name': 'Repeat Candidate',
        }

        first = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')
        second = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            User.objects.filter(email__iexact='repeat@example.com').count(), 1
        )

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_rejects_invalid_token(self, mock_verify):
        mock_verify.side_effect = ValueError('Wrong audience')

        response = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(response.status_code, 401)
        self.assertFalse(User.objects.exists())

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_rejects_unverified_email(self, mock_verify):
        mock_verify.return_value = {
            'email': 'unverified@example.com',
            'email_verified': False,
            'name': 'Unverified',
        }

        response = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(response.status_code, 401)
        self.assertFalse(User.objects.exists())

    @patch('accounts.serializers.id_token.verify_oauth2_token')
    def test_rejects_existing_non_candidate_account(self, mock_verify):
        company = Company.objects.create(name='Acme')
        User.objects.create_user(
            email='admin@acme.com',
            password='irrelevant-password-123',
            full_name='Admin',
            role=UserRole.COMPANY_ADMIN,
            company=company,
        )
        mock_verify.return_value = {
            'email': 'admin@acme.com',
            'email_verified': True,
            'name': 'Admin',
        }

        response = self.client.post(self.url, {'id_token': 'fake'}, content_type='application/json')

        self.assertEqual(response.status_code, 401)
        self.assertEqual(User.objects.filter(email__iexact='admin@acme.com').count(), 1)

    def test_missing_id_token_is_bad_request(self):
        response = self.client.post(self.url, {}, content_type='application/json')

        self.assertEqual(response.status_code, 400)


class CandidateProfileViewTests(APITestCase):
    url = '/api/v1/me/profile'

    def _make_user(self, role=UserRole.CANDIDATE, **extra):
        company = None
        if role in (UserRole.COMPANY_ADMIN, UserRole.RECRUITER):
            company = Company.objects.create(name='Acme')
        return User.objects.create_user(
            email=extra.pop('email', 'cand@example.com'),
            password='pw12345678',
            full_name='Candidate',
            role=role,
            company=company,
        )

    def _auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _pdf(self, name='cv.pdf'):
        return SimpleUploadedFile(name, b'%PDF-1.4 fake content', content_type='application/pdf')

    def _skill(self, slug):
        """Fetch a seeded catalog skill. The catalog is populated by
        jobs/migrations/0004, so these rows exist in the test database
        without any setUp of our own."""
        return Skill.objects.get(slug=slug)

    def _names(self, body):
        return [s['name'] for s in body['skills']]

    def _google_user(self, **extra):
        extra.setdefault('email', 'google-cand@example.com')
        user = self._make_user(**extra)
        user.auth_provider = AuthProvider.GOOGLE
        user.save(update_fields=['auth_provider'])
        return user

    def test_get_requires_auth(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['error_code'], 'ERR_UNAUTHENTICATED')

    def test_get_rejects_non_candidate(self):
        self._auth(self._make_user(role=UserRole.COMPANY_ADMIN, email='admin@acme.com'))

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['error_code'], 'ERR_FORBIDDEN')

    def test_get_profile_complete_false_initially(self):
        self._auth(self._make_user())

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body['profile_complete'])
        self.assertEqual(body['skills'], [])

    @patch('accounts.serializers.cloudinary.uploader.upload')
    def test_put_first_submission_sets_profile_complete_true(self, mock_upload):
        mock_upload.return_value = {'secure_url': 'https://res.cloudinary.com/demo/raw/upload/cv.pdf'}
        self._auth(self._make_user())

        response = self.client.put(
            self.url,
            {
                'cv': self._pdf(),
                'skills': [str(self._skill('backend').id), str(self._skill('devops').id)],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body['profile_complete'])
        self.assertCountEqual(self._names(body), ['Backend', 'DevOps'])
        self.assertEqual(body['resume_url'], 'https://res.cloudinary.com/demo/raw/upload/cv.pdf')
        mock_upload.assert_called_once()

    def test_get_returns_skills_as_catalog_objects(self):
        user = self._make_user()
        user.skills.set([self._skill('frontend')])
        self._auth(user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        skill = response.json()['skills'][0]
        self.assertEqual(
            skill,
            {'id': str(self._skill('frontend').id), 'slug': 'frontend', 'name': 'Frontend'},
        )

    def test_put_rejects_free_text_skill_name(self):
        """The whole point of the catalog: a typed name is not an id, so it
        is rejected rather than silently creating a new Skill row."""
        self._auth(self._make_user())
        before = Skill.objects.count()

        response = self.client.put(
            self.url, {'cv': self._pdf(), 'skills': ['React']}, format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error_code'], 'ERR_VALIDATION')
        self.assertEqual(Skill.objects.count(), before)

    def test_put_rejects_unknown_skill_id(self):
        self._auth(self._make_user())
        before = Skill.objects.count()

        response = self.client.put(
            self.url,
            {'cv': self._pdf(), 'skills': [str(uuid.uuid4())]},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Skill.objects.count(), before)

    def test_put_rejects_empty_skill_list(self):
        self._auth(self._make_user())

        response = self.client.put(
            self.url, {'cv': self._pdf(), 'skills': []}, format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_put_missing_skills_is_400(self):
        self._auth(self._make_user())

        response = self.client.put(self.url, {'cv': self._pdf()}, format='multipart')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error_code'], 'ERR_VALIDATION')

    def test_put_rejects_non_pdf(self):
        self._auth(self._make_user())
        not_pdf = SimpleUploadedFile('cv.docx', b'fake', content_type='application/msword')

        response = self.client.put(
            self.url, {'cv': not_pdf, 'skills': [str(self._skill('backend').id)]},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)

    @patch('accounts.serializers.cloudinary.uploader.upload')
    def test_patch_updates_only_skills(self, mock_upload):
        user = self._make_user()
        user.resume_url = 'https://res.cloudinary.com/demo/raw/upload/old.pdf'
        user.save(update_fields=['resume_url'])
        self._auth(user)

        response = self.client.patch(
            self.url, {'skills': [str(self._skill('mobile').id)]}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertCountEqual(self._names(body), ['Mobile'])
        self.assertEqual(body['resume_url'], 'https://res.cloudinary.com/demo/raw/upload/old.pdf')
        mock_upload.assert_not_called()

    @patch('accounts.serializers.cloudinary.uploader.upload')
    def test_patch_updates_only_cv(self, mock_upload):
        mock_upload.return_value = {'secure_url': 'https://res.cloudinary.com/demo/raw/upload/new.pdf'}
        user = self._make_user()
        user.skills.set([self._skill('backend')])
        self._auth(user)

        response = self.client.patch(self.url, {'cv': self._pdf()}, format='multipart')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['resume_url'], 'https://res.cloudinary.com/demo/raw/upload/new.pdf')
        self.assertCountEqual(self._names(body), ['Backend'])

    def test_patch_with_no_fields_is_400(self):
        self._auth(self._make_user())

        response = self.client.patch(self.url, {}, format='json')

        self.assertEqual(response.status_code, 400)

    # --- profile-completion gate: email/password candidates are unchanged ---

    @patch('accounts.serializers.cloudinary.uploader.upload')
    def test_email_candidate_with_no_phone_is_still_complete(self, mock_upload):
        """Regression guard for the pre-existing contract: the phone
        requirement is scoped to Google signups, so an email/password
        candidate with a CV and skills and no phone stays complete."""
        mock_upload.return_value = {'secure_url': 'https://res.cloudinary.com/demo/raw/upload/cv.pdf'}
        user = self._make_user()
        self.assertEqual(user.phone, '')
        self._auth(user)

        response = self.client.put(
            self.url,
            {'cv': self._pdf(), 'skills': [str(self._skill('backend').id)]},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body['profile_complete'])
        self.assertEqual(body['missing_fields'], [])

    # --- profile-completion gate: Google candidates owe phone + full_name ---

    def test_get_exposes_phone_full_name_and_auth_provider(self):
        user = self._google_user()
        user.phone = '03001234567'
        user.save(update_fields=['phone'])
        self._auth(user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['phone'], '03001234567')
        self.assertEqual(body['full_name'], 'Candidate')
        self.assertEqual(body['auth_provider'], 'google')
        self.assertEqual(body['missing_fields'], ['resume_url', 'skills'])

    def test_google_put_without_phone_is_400_naming_phone(self):
        self._auth(self._google_user())

        response = self.client.put(
            self.url,
            {'cv': self._pdf(), 'skills': [str(self._skill('backend').id)]},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertEqual(body['error_code'], 'ERR_VALIDATION')
        self.assertIn('phone', body['details'])

    @patch('accounts.serializers.cloudinary.uploader.upload')
    def test_google_put_with_all_fields_completes_profile(self, mock_upload):
        mock_upload.return_value = {'secure_url': 'https://res.cloudinary.com/demo/raw/upload/cv.pdf'}
        self._auth(self._google_user())

        response = self.client.put(
            self.url,
            {
                'cv': self._pdf(),
                'skills': [str(self._skill('backend').id)],
                'phone': '03001234567',
                'full_name': 'Real Name',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body['profile_complete'])
        self.assertEqual(body['missing_fields'], [])
        self.assertEqual(body['phone'], '03001234567')
        self.assertEqual(body['full_name'], 'Real Name')

    @patch('accounts.serializers.cloudinary.uploader.upload')
    def test_google_put_may_omit_cv_already_on_file(self, mock_upload):
        """'Required' means non-empty after the write, not present in this
        request — so a candidate who already uploaded a CV can PUT just the
        fields they were missing without re-uploading it."""
        user = self._google_user()
        user.resume_url = 'https://res.cloudinary.com/demo/raw/upload/old.pdf'
        user.skills.set([self._skill('backend')])
        user.save(update_fields=['resume_url'])
        self._auth(user)

        response = self.client.put(self.url, {'phone': '03001234567'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['profile_complete'])
        mock_upload.assert_not_called()

    @patch('accounts.serializers.cloudinary.uploader.upload')
    def test_patch_updates_only_phone(self, mock_upload):
        user = self._google_user()
        user.resume_url = 'https://res.cloudinary.com/demo/raw/upload/old.pdf'
        user.cv_uploaded_at = timezone.now()
        user.skills.set([self._skill('backend')])
        user.save(update_fields=['resume_url', 'cv_uploaded_at'])
        self._auth(user)

        response = self.client.patch(self.url, {'phone': ' 03009999999 '}, format='json')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['phone'], '03009999999')  # stripped
        self.assertEqual(body['resume_url'], 'https://res.cloudinary.com/demo/raw/upload/old.pdf')
        self.assertIsNotNone(body['cv_uploaded_at'])
        self.assertCountEqual(self._names(body), ['Backend'])
        mock_upload.assert_not_called()

    def test_patch_updates_only_full_name(self):
        user = self._google_user()
        self._auth(user)

        response = self.client.patch(self.url, {'full_name': 'Edited Name'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['full_name'], 'Edited Name')
        user.refresh_from_db()
        self.assertEqual(user.full_name, 'Edited Name')

    def test_patch_rejects_one_character_full_name(self):
        self._auth(self._google_user())

        response = self.client.patch(self.url, {'full_name': 'A'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error_code'], 'ERR_VALIDATION')

    def test_patch_rejects_whitespace_only_phone(self):
        self._auth(self._google_user())

        response = self.client.patch(self.url, {'phone': '   '}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_write_ignores_user_id_in_body(self):
        """Identity comes from the access token, never a submitted user_id."""
        victim = self._make_user(email='victim@example.com')
        actor = self._google_user(email='actor@example.com')
        self._auth(actor)

        response = self.client.patch(
            self.url,
            {'user_id': str(victim.id), 'phone': '03001112222'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        victim.refresh_from_db()
        actor.refresh_from_db()
        self.assertEqual(victim.phone, '')
        self.assertEqual(actor.phone, '03001112222')


class CandidatePhoneDeleteViewTests(APITestCase):
    url = '/api/v1/me/profile/phone'

    def _make_user(self, role=UserRole.CANDIDATE, **extra):
        company = None
        if role in (UserRole.COMPANY_ADMIN, UserRole.RECRUITER):
            company = Company.objects.create(name='Acme')
        return User.objects.create_user(
            email=extra.pop('email', 'cand@example.com'),
            password='pw12345678',
            full_name='Candidate',
            role=role,
            company=company,
            **extra,
        )

    def _auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _google_user_with_phone(self):
        user = self._make_user(auth_provider=AuthProvider.GOOGLE)
        user.phone = '03001234567'
        user.resume_url = 'https://res.cloudinary.com/demo/raw/upload/cv.pdf'
        user.skills.set([Skill.objects.get(slug='backend')])
        user.save(update_fields=['phone', 'resume_url'])
        return user

    def test_requires_auth(self):
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['error_code'], 'ERR_UNAUTHENTICATED')

    def test_rejects_non_candidate(self):
        self._auth(self._make_user(role=UserRole.COMPANY_ADMIN, email='admin@acme.com'))

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['error_code'], 'ERR_FORBIDDEN')

    def test_no_phone_on_file_is_404(self):
        self._auth(self._make_user())

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error_code'], 'ERR_PHONE_NOT_FOUND')

    def test_deletes_phone_and_regates_google_candidate(self):
        """Completeness is recomputed from current state, never latched — so
        deleting the phone puts a Google candidate back behind the gate."""
        user = self._google_user_with_phone()
        self._auth(user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['phone'], '')
        self.assertFalse(body['profile_complete'])
        self.assertEqual(body['missing_fields'], ['phone'])
        user.refresh_from_db()
        self.assertEqual(user.phone, '')

    def test_deleting_phone_leaves_email_candidate_complete(self):
        """An email/password candidate is not gated on phone, so removing it
        doesn't touch their completeness."""
        user = self._make_user()
        user.phone = '03001234567'
        user.resume_url = 'https://res.cloudinary.com/demo/raw/upload/cv.pdf'
        user.skills.set([Skill.objects.get(slug='backend')])
        user.save(update_fields=['phone', 'resume_url'])
        self._auth(user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['profile_complete'])

    def test_second_delete_is_404_not_silent_success(self):
        self._auth(self._google_user_with_phone())

        first = self.client.delete(self.url)
        second = self.client.delete(self.url)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 404)
        self.assertEqual(second.json()['error_code'], 'ERR_PHONE_NOT_FOUND')


class CandidateCVDeleteViewTests(APITestCase):
    url = '/api/v1/me/profile/cv'

    def _make_user(self, role=UserRole.CANDIDATE, **extra):
        company = None
        if role in (UserRole.COMPANY_ADMIN, UserRole.RECRUITER):
            company = Company.objects.create(name='Acme')
        return User.objects.create_user(
            email=extra.pop('email', 'cand@example.com'),
            password='pw12345678',
            full_name='Candidate',
            role=role,
            company=company,
        )

    def _auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _user_with_cv(self):
        user = self._make_user()
        user.resume_url = 'https://res.cloudinary.com/demo/raw/upload/cv.pdf'
        user.cv_uploaded_at = timezone.now()
        user.save(update_fields=['resume_url', 'cv_uploaded_at'])
        return user

    def test_requires_auth(self):
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['error_code'], 'ERR_UNAUTHENTICATED')

    def test_rejects_non_candidate(self):
        self._auth(self._make_user(role=UserRole.COMPANY_ADMIN, email='admin@acme.com'))

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['error_code'], 'ERR_FORBIDDEN')

    def test_no_cv_on_file_is_404(self):
        self._auth(self._make_user())

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error_code'], 'ERR_CV_NOT_FOUND')

    @patch('accounts.views.cloudinary.uploader.destroy')
    def test_deletes_cv_and_clears_fields(self, mock_destroy):
        mock_destroy.return_value = {'result': 'ok'}
        user = self._user_with_cv()
        self._auth(user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['resume_url'], '')
        self.assertIsNone(body['cv_uploaded_at'])
        self.assertFalse(body['profile_complete'])
        mock_destroy.assert_called_once_with(f'candidate_cvs/{user.id}', resource_type='raw')
        user.refresh_from_db()
        self.assertEqual(user.resume_url, '')
        self.assertIsNone(user.cv_uploaded_at)

    @patch('accounts.views.cloudinary.uploader.destroy')
    def test_succeeds_even_if_asset_already_gone_on_cloudinary(self, mock_destroy):
        mock_destroy.return_value = {'result': 'not found'}
        user = self._user_with_cv()
        self._auth(user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.resume_url, '')
        self.assertIsNone(user.cv_uploaded_at)

    @patch('accounts.views.cloudinary.uploader.destroy')
    def test_second_delete_is_404_not_silent_success(self, mock_destroy):
        mock_destroy.return_value = {'result': 'ok'}
        user = self._user_with_cv()
        self._auth(user)

        first = self.client.delete(self.url)
        second = self.client.delete(self.url)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 404)
        self.assertEqual(second.json()['error_code'], 'ERR_CV_NOT_FOUND')
        mock_destroy.assert_called_once()
