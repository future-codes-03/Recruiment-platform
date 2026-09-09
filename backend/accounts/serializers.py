from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes, force_str
from django.utils.http import base36_to_int, urlsafe_base64_decode, urlsafe_base64_encode
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from company.models import Company

from .models import User, UserRole

# Free consumer email providers rejected on company signup — an admin_email
# must belong to the company's own domain.
FREE_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'gmx.com',
}

# Stateless reset tokens: Django's generator hashes the user's current
# password + last_login into the token, so it stops validating on its own
# the moment the password is changed — no separate "used" flag to store.
password_reset_token_generator = PasswordResetTokenGenerator()


def make_reset_token(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = password_reset_token_generator.make_token(user)
    return f'{uid}.{token}'


def get_user_from_reset_token(reset_token):
    try:
        uid_b64, token = reset_token.split('.', 1)
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid_b64)))
    except (ValueError, TypeError, User.DoesNotExist):
        return None
    if not password_reset_token_generator.check_token(user, token):
        return None
    return user


# Stateless email-verification tokens, same pattern as the reset token
# above but salted separately so a reset token and a verification token
# are never interchangeable.
class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    key_salt = 'accounts.EmailVerificationTokenGenerator'

    # Own expiry window, independent of PASSWORD_RESET_TIMEOUT. The base
    # class's check_token() hardcodes a read of settings.PASSWORD_RESET_TIMEOUT
    # rather than deferring to an instance/class attribute, so getting a
    # different timeout for this generator means overriding check_token
    # itself (below) — not just setting an attribute.
    timeout = timedelta(minutes=10).total_seconds()

    def _make_hash_value(self, user, timestamp):
        # Folds in email_verified_at (unlike the base password-reset hash,
        # which only tracks password + last_login) so the token stops
        # validating the moment it's used — same self-invalidating
        # property as the reset token, without a table.
        return f'{super()._make_hash_value(user, timestamp)}{user.email_verified_at}'

    def check_token(self, user, token):
        # Copied from PasswordResetTokenGenerator.check_token, substituting
        # self.timeout for settings.PASSWORD_RESET_TIMEOUT in the expiry
        # check — everything else (secret/hash verification) is identical.
        if not (user and token):
            return False
        try:
            ts_b36, _ = token.split('-')
        except ValueError:
            return False
        try:
            ts = base36_to_int(ts_b36)
        except ValueError:
            return False

        for secret in [self.secret, *self.secret_fallbacks]:
            if constant_time_compare(self._make_token_with_timestamp(user, ts, secret), token):
                break
        else:
            return False

        if (self._num_seconds(self._now()) - ts) > self.timeout:
            return False
        return True


email_verification_token_generator = EmailVerificationTokenGenerator()


def make_email_verification_token(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token_generator.make_token(user)
    return f'{uid}.{token}'


def get_user_from_verification_token(token):
    try:
        uid_b64, raw_token = token.split('.', 1)
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid_b64)))
    except (ValueError, TypeError, User.DoesNotExist):
        return None
    if not email_verification_token_generator.check_token(user, raw_token):
        return None
    return user


class UserSerializer(serializers.ModelSerializer):
    company_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'role', 'email', 'full_name', 'company_id']
        read_only_fields = fields


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name', 'industry', 'is_verified']
        read_only_fields = fields


class CandidateSignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True, trim_whitespace=False)
    full_name = serializers.CharField(min_length=2)
    phone = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_password(self, value):
        try:
            validate_password(value) #checks whether a password meets your project's password-validation rules.
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            phone=validated_data.get('phone') or '',
            role=UserRole.CANDIDATE,
        )


class CompanySignupSerializer(serializers.Serializer):
    company_name = serializers.CharField(min_length=2)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(min_length=8, write_only=True, trim_whitespace=False)
    admin_full_name = serializers.CharField(min_length=2)

    def validate_company_name(self, value):
        return value.strip()

    def validate_admin_email(self, value):
        email = value.strip().lower()
        domain = email.rsplit('@', 1)[-1]
        if domain in FREE_EMAIL_DOMAINS:
            raise serializers.ValidationError(
                'Please sign up with your company email address, not a free consumer provider.'
            )
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_admin_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        company = Company.objects.create(name=validated_data['company_name'])
        user = User.objects.create_user(
            email=validated_data['admin_email'],
            password=validated_data['admin_password'],
            full_name=validated_data['admin_full_name'],
            role=UserRole.COMPANY_ADMIN,
            company=company,
        )
        return {'company': company, 'user': user}


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()

    default_error_messages = {
        'invalid_token': 'This verification link is invalid, expired, or has already been used.',
    }

    def validate_token(self, value):
        user = get_user_from_verification_token(value)
        if user is None:
            raise serializers.ValidationError(self.error_messages['invalid_token'])
        self._user = user
        return value

    def save(self, **kwargs):
        self._user.email_verified_at = timezone.now()
        self._user.save(update_fields=['email_verified_at'])
        return self._user


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()

    def get_user(self):
        # "No such account" and "already verified" must be indistinguishable
        # to the caller, so both collapse into the same None result here
        # rather than being raised as separate errors.
        return (
            User.objects
            .filter(email__iexact=self.validated_data['email'], email_verified_at__isnull=True)
            .first()
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    default_error_messages = {
        'invalid_credentials': 'Invalid email or password.',
    }

    def validate(self, attrs):
        email = attrs['email'].strip().lower()
        user = User.objects.filter(email__iexact=email).first()

        # Never reveal whether the email exists — same error either way.
        if user is None or not user.check_password(attrs['password']) or not user.is_active or user.email_verified_at is None:
            raise serializers.ValidationError(self.error_messages['invalid_credentials'])

        refresh = RefreshToken.for_user(user)
        return {
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'expires_in': int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
            'user': user,
        }


# Same generic message for every rejection branch below (bad signature, wrong
# audience, unverified email, non-candidate role match) — a caller must not
# be able to tell which one happened, same "never leak why" posture as
# LoginSerializer's invalid_credentials.
GOOGLE_AUTH_FAILURE_MESSAGE = 'Invalid Google credentials.'


def get_or_create_google_user(raw_id_token):
    try:
        claims = id_token.verify_oauth2_token(
            raw_id_token, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID
        )
    except (ValueError, GoogleAuthError):
        raise AuthenticationFailed(GOOGLE_AUTH_FAILURE_MESSAGE)

    if not claims.get('email_verified'):
        raise AuthenticationFailed(GOOGLE_AUTH_FAILURE_MESSAGE)

    email = claims['email'].strip().lower()
    user = User.objects.filter(email__iexact=email).first()
    created = False

    if user is None:
        user = User.objects.create_user(
            email=email,
            password=None,
            full_name=claims.get('name') or email,
            role=UserRole.CANDIDATE,
        )
        user.set_unusable_password()
        user.email_verified_at = timezone.now()
        user.save(update_fields=['password', 'email_verified_at'])
        created = True
    elif user.role != UserRole.CANDIDATE:
        # Candidate-only by design — an email that already belongs to a
        # company_admin/recruiter/platform_admin account must never be
        # reachable through this endpoint, enforced here rather than relying
        # on the frontend only rendering this button for candidates.
        raise AuthenticationFailed(GOOGLE_AUTH_FAILURE_MESSAGE)
    # else: matched an existing candidate account (however it was originally
    # created) — log in as-is. No is_active/email_verified_at re-check here,
    # unlike LoginSerializer: Google already vouches for the email, and a
    # password-created candidate account's email_verified_at guard is a
    # different check than what this endpoint is verifying.

    refresh = RefreshToken.for_user(user)
    return {
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'expires_in': int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        'user': user,
        'created': created,
    }


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()

    def save(self, **kwargs):
        return get_or_create_google_user(self.validated_data['id_token'])


class RefreshTokenSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()

    default_error_messages = {
        'invalid_token': 'The refresh token is invalid or expired.',
    }

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh_token'])
        except TokenError:
            raise serializers.ValidationError(self.error_messages['invalid_token'])

        return {
            'access_token': str(refresh.access_token),
            'expires_in': int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        }


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()

    def get_user(self):
        return User.objects.filter(email__iexact=self.validated_data['email']).first()


class ResetPasswordSerializer(serializers.Serializer):
    reset_token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True, trim_whitespace=False)

    default_error_messages = {
        'invalid_token': 'This reset link is invalid, expired, or has already been used.',
    }

    def validate_reset_token(self, value):
        user = get_user_from_reset_token(value)
        if user is None:
            raise serializers.ValidationError(self.error_messages['invalid_token'])
        self._user = user
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value, user=getattr(self, '_user', None))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def save(self, **kwargs):
        self._user.set_password(self.validated_data['new_password'])
        self._user.save(update_fields=['password'])
        return self._user
