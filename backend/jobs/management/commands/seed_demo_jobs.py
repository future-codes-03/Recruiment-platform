from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import UserRole
from company.models import Company
from jobs.models import GuaranteeAgreement, Job, JobSeniority, JobSkillRequirement, JobStatus, Skill

User = get_user_model()
JOBS = [
    {
        'title': 'Backend Engineer',
        'description': (
            'Build and operate the core Django/DRF API that powers the guaranteed-'
            'interview pipeline: job publishing, assessment assembly, and the '
            'N-slot claim transaction. You will work closely with the platform '
            'team on PostgreSQL schema design and background job processing.'
        ),
        'seniority': JobSeniority.JUNIOR,
        'guaranteed_slots': 5,
        'overall_min_score': Decimal('65.00'),
        'status': JobStatus.DRAFT,
        'skills': [
            # (name, min_score, weight_pct) — names must match the catalog
            # in jobs/migrations/0004 exactly (case-sensitive lookup).
            ('Backend', Decimal('65.00'), Decimal('70.00')),
            ('DevOps', Decimal('55.00'), Decimal('30.00')),
        ],
    },
    {
        'title': 'Frontend Engineer',
        'description': (
            'Own the candidate-facing React app: the locked assessment runner, '
            'timers, and the results/claim flow. You will collaborate with the '
            'backend team on the API contract defined in the OpenAPI spec.'
        ),
        'seniority': JobSeniority.MID,
        'guaranteed_slots': 10,
        'overall_min_score': Decimal('65.00'),
        'status': JobStatus.PUBLISHED,
        'skills': [
            ('Frontend', Decimal('60.00'), Decimal('80.00')),
            ('UI/UX Design', Decimal('55.00'), Decimal('20.00')),
        ],
    },
    {
        'title': 'Full-Stack Developer',
        'description': (
            'Work across the whole stack — Django API endpoints one day, React '
            'components the next. A generalist role for someone comfortable '
            'moving between the two.'
        ),
        'seniority': JobSeniority.JUNIOR,
        'guaranteed_slots': 8,
        'overall_min_score': Decimal('60.00'),
        'status': JobStatus.PUBLISHED,
        'skills': [
            ('Full-Stack', Decimal('60.00'), Decimal('60.00')),
            ('Backend', Decimal('55.00'), Decimal('25.00')),
            ('Frontend', Decimal('55.00'), Decimal('15.00')),
        ],
    },
    {
        'title': 'QA Engineer',
        'description': (
            'Own test coverage across the platform — manual test plans for now, '
            'automated regression suites as the codebase matures.'
        ),
        'seniority': JobSeniority.ENTRY_LEVEL,
        'guaranteed_slots': 3,
        'overall_min_score': Decimal('55.00'),
        'status': JobStatus.PUBLISHED,
        'skills': [
            ('QA / Testing', Decimal('60.00'), Decimal('100.00')),
        ],
    },
    {
        'title': 'Mobile Developer',
        'description': (
            'Build the mobile companion app once the core web platform '
            'stabilizes. React Native preferred, native experience considered.'
        ),
        'seniority': JobSeniority.MID,
        'guaranteed_slots': 4,
        'overall_min_score': Decimal('65.00'),
        'status': JobStatus.DRAFT,
        'skills': [
            ('Mobile', Decimal('65.00'), Decimal('100.00')),
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed two demo Job records (one draft, one published) with skills, weights, and a guarantee agreement.'

    def handle(self, *args, **options):
        self.created = []
        self.reused = []

        with transaction.atomic():
            company = self._get_or_create_company()
            recruiter = self._get_or_create_recruiter(company)

            for spec in JOBS:
                self._seed_job(spec, company, recruiter)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Created:'))
        for line in self.created:
            self.stdout.write(f'  + {line}')
        if not self.created:
            self.stdout.write('  (none)')

        self.stdout.write(self.style.WARNING('Reused:'))
        for line in self.reused:
            self.stdout.write(f'  = {line}')
        if not self.reused:
            self.stdout.write('  (none)')

    def _get_or_create_company(self):
        company = Company.objects.first()
        if company:
            self.reused.append(f'Company "{company.name}"')
            return company

        company = Company.objects.create(
            name='Acme Software',
            industry='Software',
            website_url='https://acme-software.example.com',
            is_verified=True,
        )
        self.created.append(f'Company "{company.name}"')
        return company

    def _get_or_create_recruiter(self, company):
        user = User.objects.filter(
            company=company, role__in=[UserRole.COMPANY_ADMIN, UserRole.RECRUITER]
        ).first()
        if user:
            self.reused.append(f'User "{user.email}" ({user.role})')
            return user

        user = User.objects.create_user(
            email='hiring@acme-software.example.com',
            password='demo-pass-123',
            role=UserRole.RECRUITER,
            company=company,
            full_name='Acme Hiring Team',
            email_verified_at=timezone.now(),
        )
        self.created.append(f'User "{user.email}" ({user.role})')
        return user

    def _get_or_create_skill(self, name):
        skill = Skill.objects.filter(name__iexact=name).first()
        if skill:
            self.reused.append(f'Skill "{skill.name}"')
            return skill

        # Skill has no review_status field on this model (that lives on
        # Question, per entity_functionalities_algorithms.md) — the task's
        # 'approved' status doesn't apply here, so it's simply not set.
        skill = Skill.objects.create(name=name)
        self.created.append(f'Skill "{skill.name}"')
        return skill

    def _seed_job(self, spec, company, recruiter):
        existing = Job.objects.filter(title=spec['title'], company=company).first()
        if existing:
            self.reused.append(f'Job "{existing.title}" ({existing.status})')
            return existing

        job = Job.objects.create(
            company=company,
            created_by=recruiter,
            title=spec['title'],
            description=spec['description'],
            seniority=spec['seniority'],
            status=JobStatus.DRAFT,
            guaranteed_slots=spec['guaranteed_slots'],
            overall_min_score=spec['overall_min_score'],
        )
        self.created.append(f'Job "{job.title}"')

        for name, min_score, weight_pct in spec['skills']:
            skill = self._get_or_create_skill(name)
            JobSkillRequirement.objects.create(
                job=job, skill=skill, min_score=min_score, weight_pct=weight_pct
            )

        try:
            job.validate_skill_weights()
        except ValidationError as exc:
            raise ValidationError(
                f'Seed data for job "{job.title}" is invalid: {exc}'
            ) from exc

        if spec['status'] == JobStatus.PUBLISHED:
            job.status = JobStatus.PUBLISHED
            job.published_at = timezone.now()
            job.save(update_fields=['status', 'published_at'])

            agreement = GuaranteeAgreement(
                job=job,
                company=company,
                accepted_by=recruiter,
                agreement_version='1.0',
            )
            agreement.full_clean()
            agreement.save()
            self.created.append(f'GuaranteeAgreement for "{job.title}"')

        return job
