from unittest.mock import patch

from django.test import TestCase

from company.models import Company

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
