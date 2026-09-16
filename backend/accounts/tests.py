import uuid
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from company.models import Company
from jobs.models import Skill

from .models import User, UserRole


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
