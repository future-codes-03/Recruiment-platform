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


class AuthProvider(models.TextChoices):
    EMAIL = 'email', 'Email'
    GOOGLE = 'google', 'Google'


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
    # blank=True: Google's id_token doesn't always carry a `name` claim, and
    # get_or_create_google_user() stores '' rather than falling back to the
    # email address — so an empty name is a legal state the profile-completion
    # gate then asks the candidate to fill, not a placeholder to guess at later.
    full_name = models.CharField(max_length=255, blank=True)
    # How the account was created. Scopes the profile-completion gate: a Google
    # signup supplies no phone (and possibly no name), so those are required
    # before the candidate can proceed; an email/password signup collected them
    # at signup and is held to the pre-existing CV + skills bar only.
    auth_provider = models.CharField(
        max_length=20, choices=AuthProvider.choices, default=AuthProvider.EMAIL
    )
    resume_url = models.URLField(max_length=500, blank=True)
    cv_uploaded_at = models.DateTimeField(null=True, blank=True)
    # 'jobs.Skill' as a string, not a direct import — mirrors how jobs/models.py
    # avoids a hard import of accounts.User (settings.AUTH_USER_MODEL instead),
    # keeping the dependency one-way at the Python-import level even though the
    # DB relation itself now ties accounts to jobs.
    skills = models.ManyToManyField('jobs.Skill', related_name='candidates', blank=True)
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
