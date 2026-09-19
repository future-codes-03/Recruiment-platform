from datetime import timedelta
import cloudinary.uploader
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
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
from jobs.models import Skill
from jobs.serializers import SkillSerializer

from .models import AuthProvider, User, UserRole

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


# What a candidate must supply before the profile-completion gate lets them
# through. Every candidate owes a CV and skills; a Google signup additionally
# owes a phone number and a full name, because Google's id_token carries
# neither reliably and there was no signup form to collect them.
def required_profile_fields(user):
    fields = ['resume_url', 'skills']
    if user.auth_provider == AuthProvider.GOOGLE:
        fields += ['phone', 'full_name']
    return fields


# Always derived from current state, never latched: deleting the CV or the
# phone number puts the field back on this list and re-gates the candidate,
# the same way CV deletion already flips profile_complete back to false.
def compute_missing_profile_fields(user):
    present = {
        'resume_url': bool(user.resume_url),
        'skills': user.skills.exists(),
        'phone': bool(user.phone.strip()),
        'full_name': bool(user.full_name.strip()),
    }
    return [field for field in required_profile_fields(user) if not present[field]]


class CandidateProfileSerializer(serializers.ModelSerializer):
    # Full {id, slug, name} objects rather than bare names: the onboarding
    # picker pre-selects a candidate's saved skills by id, and resolving
    # names back to ids client-side would reintroduce exactly the
    # name-matching fragility the catalog exists to remove.
    skills = SkillSerializer(many=True, read_only=True)
    profile_complete = serializers.SerializerMethodField()
    # Which fields are still outstanding, so the client can render the
    # completion page without re-deriving the rule itself.
    missing_fields = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'resume_url', 'cv_uploaded_at', 'skills', 'phone', 'full_name',
            'auth_provider', 'profile_complete', 'missing_fields',
        ]
        read_only_fields = fields

    def get_profile_complete(self, obj):
        return not compute_missing_profile_fields(obj)

    def get_missing_fields(self, obj):
        return compute_missing_profile_fields(obj)


MAX_CV_SIZE_BYTES = 5 * 1024 * 1024  # 5MB — not specified anywhere, a reasonable default


class CandidateProfileWriteSerializer(serializers.Serializer):
    # Every field is declared optional and the PUT ("full submission")
    # contract is enforced in validate() instead, against
    # required_profile_fields(). Two reasons it can't be a field-level
    # required=True any more: the required set now depends on the user's
    # auth_provider, and "required" means "non-empty *after* this write" —
    # a Google candidate who already uploaded a CV must be able to PUT just
    # their phone number without re-uploading it.
    cv = serializers.FileField(required=False)
    # Catalog ids only — never free text. An id that isn't in the Skill
    # table is a 400 from DRF, so the API can't grow "React" alongside
    # "react.js" even if a client bypasses the frontend picker. This is the
    # enforcement; the picker is only the convenience.
    skills = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Skill.objects.all(),
        required=False, allow_empty=False,
    )
    # No format/regex validation: nothing in this codebase validates a phone
    # number's shape (CandidateSignupSerializer.phone is a bare CharField),
    # and no canonical source specifies one. Non-empty after strip is the
    # whole rule — see the spec's open questions before adding more.
    phone = serializers.CharField(max_length=20, required=False)
    # min_length matches the full_name rule already used by
    # CandidateSignupSerializer and CompanySignupSerializer.
    full_name = serializers.CharField(max_length=255, min_length=2, required=False)

    def validate_phone(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Phone number cannot be blank.')
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Full name must be at least 2 characters.')
        return value

    def validate_cv(self, value):
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('CV must be a PDF file (.pdf).')
        if value.size > MAX_CV_SIZE_BYTES:
            raise serializers.ValidationError('CV file must be 5MB or smaller.')
        return value

    def validate(self, attrs):
        # A PATCH is an edit from profile settings, not an attempt to satisfy
        # the gate — it enforces no required set, only that it does something.
        if self.partial:
            if not attrs:
                raise serializers.ValidationError(
                    'At least one of cv, skills, phone or full_name must be provided.'
                )
            return attrs

        # A PUT is the full first-time submission. A required field counts as
        # satisfied if this request supplies it OR the user already has it —
        # so re-submitting only what's missing is allowed.
        user = self.context['request'].user
        already_present = {
            'resume_url': bool(user.resume_url),
            'skills': user.skills.exists(),
            'phone': bool(user.phone.strip()),
            'full_name': bool(user.full_name.strip()),
        }
        # The write serializer names the CV field 'cv'; the user attribute it
        # lands in is 'resume_url'.
        supplied_by = {'resume_url': 'cv', 'skills': 'skills', 'phone': 'phone', 'full_name': 'full_name'}

        # Keyed by the request field name, not the model attribute, so DRF
        # renders it as an error against the input the client actually sends.
        missing = {
            supplied_by[field]: ['This field is required to complete your profile.']
            for field in required_profile_fields(user)
            if supplied_by[field] not in attrs and not already_present[field]
        }
        if missing:
            raise serializers.ValidationError(missing)
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user

        # Multi-row write: the user row plus the M2M through-table rows
        # linking them to catalog skills, so wrap in transaction.atomic()
        # per backend/CLAUDE.md's rule for multi-row writes.
        with transaction.atomic():
            # One save() for every scalar field this request touched, rather
            # than one per field — update_fields is built up as we go.
            update_fields = []

            if 'cv' in self.validated_data:
                upload = cloudinary.uploader.upload(
                    self.validated_data['cv'],
                    resource_type='raw',  # required for non-image files like PDFs
                    folder='candidate_cvs',
                    public_id=str(user.id),
                    overwrite=True,
                )
                user.resume_url = upload['secure_url']
                user.cv_uploaded_at = timezone.now()
                update_fields += ['resume_url', 'cv_uploaded_at']

            if 'phone' in self.validated_data:
                user.phone = self.validated_data['phone']
                update_fields.append('phone')

            if 'full_name' in self.validated_data:
                user.full_name = self.validated_data['full_name']
                update_fields.append('full_name')

            if update_fields:
                user.save(update_fields=update_fields)

            if 'skills' in self.validated_data:
                # PrimaryKeyRelatedField has already resolved these to real
                # Skill instances (and rejected anything not in the catalog),
                # so there is nothing left to canonicalize here.
                user.skills.set(self.validated_data['skills'])

        return user


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
            # '' rather than falling back to the email address: an empty name
            # is a fact the completion gate can act on, whereas a full_name
            # that happens to be an email address is indistinguishable from a
            # real one once stored.
            full_name=claims.get('name') or '',
            role=UserRole.CANDIDATE,
        )
        user.set_unusable_password()
        user.email_verified_at = timezone.now()
        user.auth_provider = AuthProvider.GOOGLE
        user.save(update_fields=['password', 'email_verified_at', 'auth_provider'])
        created = True
    elif user.role != UserRole.CANDIDATE:
        # Candidate-only by design — an email that already belongs to a
        # company_admin/recruiter/platform_admin account must never be
        # reachable through this endpoint, enforced here rather than relying
        # on the frontend only rendering this button for candidates.
        raise AuthenticationFailed(GOOGLE_AUTH_FAILURE_MESSAGE)
    # else: matched an existing candidate account (however it was originally
    # created) — log in as-is, auth_provider included. Using the Google button
    # once must not reclassify an email/password account as a Google one, or
    # it would start demanding fields that account already collected at
    # signup. No is_active/email_verified_at re-check here,
    # unlike LoginSerializer: Google already vouches for the email, and a
    # password-created candidate account's email_verified_at guard is a
    # different check than what this endpoint is verifying.

    refresh = RefreshToken.for_user(user)
    # Surfaced at sign-in so the client can route a Google candidate straight
    # to the profile-completion page without a second round-trip to
    # GET /me/profile.
    missing_fields = compute_missing_profile_fields(user)
    return {
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'expires_in': int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        'user': user,
        'created': created,
        'missing_fields': missing_fields,
        'profile_complete': not missing_fields,
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
