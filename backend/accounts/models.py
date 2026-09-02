from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from core.models import BaseModel


class UserRole(models.TextChoices):
    PLATFORM_ADMIN = 'platform_admin', 'Platform Admin'
    COMPANY_ADMIN = 'company_admin', 'Company Admin'
    RECRUITER = 'recruiter', 'Recruiter'
    CANDIDATE = 'candidate', 'Candidate'


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', UserRole.PLATFORM_ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    company = models.ForeignKey(
        'company.Company', null=True, blank=True,
        on_delete=models.PROTECT, related_name='users'
    )
    role = models.CharField(max_length=20, choices=UserRole.choices)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    full_name = models.CharField(max_length=255)
    resume_url = models.URLField(max_length=500, blank=True)
    cv_uploaded_at = models.DateTimeField(null=True, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'users'
        constraints = [
            models.UniqueConstraint(
                Lower('email'), condition=Q(deleted_at__isnull=True),
                name='unique_active_email'
            ),
            models.CheckConstraint(
                condition=(
                    Q(role__in=['company_admin', 'recruiter'], company__isnull=False)
                    | Q(role__in=['candidate', 'platform_admin'], company__isnull=True)
                ),
                name='chk_users_company_role'
            ),
        ]

    def __str__(self):
        return self.email


class OtpToken(BaseModel):
    """
    A short-lived 6-digit code issued for email verification. Stored as a
    hash (not plaintext) — a raw DB read shouldn't hand over a still-valid
    code. Not self-invalidating like the password-reset token, since a
    6-digit code can't encode enough state to detect reuse on its own.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='otp_tokens'
    )
    code_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'otp_tokens'

    def __str__(self):
        return f'OTP for {self.user_id}'
