import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, Sum
from django.db.models.functions import Lower

# STILL UNRESOLVED (flagged in rounds 1-3): singular `company`, not
# `companies`. Leaving as-is since renaming the app is a deliberate,
# separate action on your end — not something to silently change here.
from company.models import Company

# REMOVED: `from accounts.models import User`. Replaced by
# settings.AUTH_USER_MODEL below on both FKs that used it.

from core.models import BaseModel


class JobStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    PUBLISHED = 'published', 'Published'
    CLOSED = 'closed', 'Closed'


class JobSeniority(models.TextChoices):
    INTERN = 'intern', 'Intern'
    ENTRY_LEVEL = 'entry level', 'Entry Level'
    JUNIOR = 'junior', 'Junior'
    # CHANGED: 'MID' -> 'Mid', matching the title-case convention every
    # other label in this enum uses.
    MID = 'mid', 'Mid'
    SENIOR = 'senior', 'Senior'


class Skill(models.Model):
    """Canonical skill catalog. Normalizes what used to be a free-text
    skill_name on JobSkillRequirement, and is the target of the Job<->Skill
    many-to-many relation (through JobSkillRequirement).

    Closed catalog: rows are seeded by migration, never created from user
    input. `slug` is the stable key and `name` is display-only, so a skill
    can be renamed ("Data/ML" -> "Data Science / ML") without invalidating
    anything that points at it."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'skills'
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(Lower('name'), name='uq_skill_name_ci'),
        ]

    def __str__(self):
        return self.name


class Job(BaseModel):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='jobs'
    )
    # CHANGED: settings.AUTH_USER_MODEL instead of a direct User import —
    # this was flagged in rounds 1 and 2 and had reverted back to a direct
    # import in round 3.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='jobs_created'
    )
    skills = models.ManyToManyField(
        Skill, through='JobSkillRequirement', related_name='jobs'
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    seniority = models.CharField(
        max_length=50, blank=True, choices=JobSeniority.choices, default=JobSeniority.JUNIOR
    )

    status = models.CharField(
        max_length=20, choices=JobStatus.choices, default=JobStatus.DRAFT
    )
    guaranteed_slots = models.PositiveIntegerField()
    slots_filled = models.PositiveIntegerField(default=0)

    overall_min_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'jobs'
        constraints = [
            models.CheckConstraint(
                condition=Q(guaranteed_slots__gt=0),
                name='chk_jobs_guaranteed_slots_positive'
            ),
            models.CheckConstraint(
                condition=Q(slots_filled__gte=0),
                name='chk_jobs_slots_filled_non_negative'
            ),
            models.CheckConstraint(
                condition=Q(slots_filled__lte=models.F('guaranteed_slots')),
                name='chk_jobs_slots_not_exceeded'
            ),
        ]
        indexes = [
            models.Index(
                fields=['company', '-created_at'],
                name='idx_jobs_company_created',
                condition=Q(deleted_at__isnull=True),
            ),
            models.Index(
                fields=['status'],
                name='idx_jobs_status',
                condition=Q(deleted_at__isnull=True),
            ),
        ]

    def __str__(self):
        # CHANGED: back to including company name — reverted to plain
        # `self.title` in round 3, which is ambiguous once two companies
        # post similarly-titled roles.
        return f'{self.title} ({self.company.name})'

    # RESTORED (was dropped in round 3 without comment): cross-row
    # validation that Postgres CHECK constraints structurally can't do,
    # since they only ever see one row at a time. Nothing in the DB stops
    # a job's skill weights from summing to something other than 100%.
    # Call this explicitly before allowing a DRAFT -> PUBLISHED transition
    # (in the view/service/serializer that handles publish) — not on every
    # save, since a job in DRAFT legitimately has partial/zero weight while
    # skills are still being added one at a time.
    def validate_skill_weights(self):
        total = self.skill_requirements.aggregate(total=Sum('weight_pct'))['total'] or 0
        if total != 100:
            raise ValidationError(
                f'Skill requirement weights must sum to 100%, got {total}%.'
            )


class JobSkillRequirement(models.Model):
    """Per-job minimum bar, one row per skill — also the through table for
    Job.skills <-> Skill.jobs. Immutable once created — no updated_at/
    deleted_at, locked alongside the job at publish."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='skill_requirements')
    skill = models.ForeignKey(Skill, on_delete=models.PROTECT, related_name='job_requirements')

    min_score = models.DecimalField(max_digits=5, decimal_places=2)
    weight_pct = models.DecimalField(max_digits=5, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'job_skill_requirements'
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'skill'], name='uq_job_skill'
            ),
            models.CheckConstraint(
                condition=Q(min_score__gte=0) & Q(min_score__lte=100),
                name='chk_job_skill_min_score_range'
            ),
            models.CheckConstraint(
                condition=Q(weight_pct__gte=0) & Q(weight_pct__lte=100),
                name='chk_job_skill_weight_pct_range'
            ),
        ]
        indexes = [
            models.Index(fields=['job'], name='idx_job_skill_requirements_job'),
        ]

    def __str__(self):
        # Kept as skill_id rather than skill.name — avoids triggering an
        # extra query per row in list views (e.g. Django admin). Good call
        # from round 3, unchanged here.
        return f'{self.skill_id} ({self.job_id})'


class GuaranteeAgreement(models.Model):
    """E-signed acceptance of the N-slot guarantee ToS. Exactly one per job —
    immutable audit record, no updated_at/deleted_at."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.OneToOneField(Job, on_delete=models.CASCADE, related_name='guarantee_agreement')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='guarantee_agreements')
    # CHANGED: settings.AUTH_USER_MODEL instead of a direct User import.
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='guarantee_agreements_accepted'
    )

    agreement_version = models.CharField(max_length=20)
    accepted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'guarantee_agreements'

    def __str__(self):
        return f'{self.job_id} accepted {self.agreement_version}'

    # RESTORED (was dropped in round 3 without comment): self.company and
    # self.job.company are independent FKs with nothing enforcing they
    # agree. clean() does NOT run automatically on .save() — you must call
    # full_clean() explicitly wherever these are created (serializer,
    # service function, or a pre_save signal), or this check never fires.
    def clean(self):
        if self.company_id != self.job.company_id:
            raise ValidationError(
                'GuaranteeAgreement.company must match GuaranteeAgreement.job.company.'
            )