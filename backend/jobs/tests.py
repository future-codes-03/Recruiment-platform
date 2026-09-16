from decimal import Decimal

from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, UserRole
from company.models import Company

from .models import Job, JobSkillRequirement, JobStatus, Skill


class SkillCatalogMixin:
    """Shared setup for the seeded catalog plus jobs that require skills
    from it. The catalog rows themselves come from
    jobs/migrations/0004_skill_slug_and_seed_catalog, so no test creates
    Skill rows of its own — that is the behaviour under test."""

    def skill(self, slug):
        return Skill.objects.get(slug=slug)

    def make_company(self, name='Acme'):
        return Company.objects.create(name=name)

    def make_recruiter(self, company, email='rec@acme.com'):
        return User.objects.create_user(
            email=email, password='pw12345678', full_name='Recruiter',
            role=UserRole.COMPANY_ADMIN, company=company,
        )

    def make_candidate(self, email='cand@example.com', skills=()):
        user = User.objects.create_user(
            email=email, password='pw12345678', full_name='Candidate',
            role=UserRole.CANDIDATE, company=None,
        )
        if skills:
            user.skills.set([self.skill(s) for s in skills])
        return user

    def make_job(self, company, creator, title='Job', status=JobStatus.PUBLISHED, skills=()):
        job = Job.objects.create(
            company=company, created_by=creator, title=title,
            status=status, guaranteed_slots=5,
        )
        for slug in skills:
            JobSkillRequirement.objects.create(
                job=job, skill=self.skill(slug),
                min_score=Decimal('60.00'),
                weight_pct=Decimal('100.00') / len(skills),
            )
        return job

    def auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


class SkillListViewTests(SkillCatalogMixin, APITestCase):
    url = '/api/v1/public/skills'

    def test_is_public(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)

    def test_returns_seeded_catalog(self):
        response = self.client.get(self.url)

        names = [s['name'] for s in response.json()]
        self.assertEqual(
            names,
            ['Backend', 'Data/ML', 'DevOps', 'Frontend', 'Full-Stack',
             'Mobile', 'QA / Testing', 'UI/UX Design'],
        )

    def test_each_entry_has_id_slug_name(self):
        response = self.client.get(self.url)

        entry = next(s for s in response.json() if s['slug'] == 'data-ml')
        self.assertEqual(entry['name'], 'Data/ML')
        self.assertEqual(entry['id'], str(self.skill('data-ml').id))

    def test_response_is_a_bare_list_not_paginated(self):
        """The picker needs the whole catalog in one call — a paginated
        envelope would silently truncate it at 20 once the catalog grows."""
        response = self.client.get(self.url)

        self.assertIsInstance(response.json(), list)


class PublicJobListViewTests(SkillCatalogMixin, APITestCase):
    url = '/api/v1/public/jobs'

    def setUp(self):
        self.company = self.make_company('Acme')
        self.recruiter = self.make_recruiter(self.company)

    def test_includes_company_name(self):
        self.make_job(self.company, self.recruiter, title='Backend Dev', skills=['backend'])

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        job = response.json()['results'][0]
        self.assertEqual(job['company_name'], 'Acme')
        self.assertEqual(job['company_id'], str(self.company.id))

    def test_excludes_unpublished_jobs(self):
        self.make_job(self.company, self.recruiter, title='Draft', status=JobStatus.DRAFT)
        self.make_job(self.company, self.recruiter, title='Live')

        response = self.client.get(self.url)

        titles = [j['title'] for j in response.json()['results']]
        self.assertEqual(titles, ['Live'])

    def test_company_name_costs_no_extra_query_per_row(self):
        for i in range(3):
            self.make_job(self.company, self.recruiter, title=f'Job {i}', skills=['backend'])

        with self.assertNumQueries(3):  # count, page of jobs (+company), prefetch
            response = self.client.get(self.url)

        self.assertEqual(len(response.json()['results']), 3)


class MatchedJobListViewTests(SkillCatalogMixin, APITestCase):
    url = '/api/v1/me/jobs'

    def setUp(self):
        self.company = self.make_company('Acme')
        self.recruiter = self.make_recruiter(self.company)
        self.backend_job = self.make_job(
            self.company, self.recruiter, title='Backend Dev', skills=['backend'])
        self.design_job = self.make_job(
            self.company, self.recruiter, title='Designer', skills=['ui-ux-design'])

    def test_requires_auth(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)

    def test_rejects_non_candidate(self):
        self.auth(self.recruiter)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_returns_only_jobs_matching_candidate_skills(self):
        """Regression: this path previously iterated request.user.skills —
        a manager, not a list — and raised TypeError on every request."""
        self.auth(self.make_candidate(skills=['backend']))

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        titles = [j['title'] for j in response.json()['results']]
        self.assertEqual(titles, ['Backend Dev'])

    def test_candidate_with_no_skills_sees_all_published_jobs(self):
        """Regression: `if request.user.skills:` was always truthy, so this
        fallback never fired."""
        self.auth(self.make_candidate())

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        titles = {j['title'] for j in response.json()['results']}
        self.assertEqual(titles, {'Backend Dev', 'Designer'})

    def test_matches_on_any_overlap_not_full_coverage(self):
        fullstack_job = self.make_job(
            self.company, self.recruiter, title='Full-Stack Dev',
            skills=['backend', 'frontend'],
        )
        self.auth(self.make_candidate(skills=['frontend']))

        response = self.client.get(self.url)

        titles = [j['title'] for j in response.json()['results']]
        self.assertEqual(titles, [fullstack_job.title])

    def test_job_appears_once_when_multiple_skills_overlap(self):
        self.make_job(
            self.company, self.recruiter, title='Full-Stack Dev',
            skills=['backend', 'frontend'],
        )
        self.auth(self.make_candidate(skills=['backend', 'frontend']))

        response = self.client.get(self.url)

        titles = [j['title'] for j in response.json()['results']]
        self.assertEqual(titles.count('Full-Stack Dev'), 1)

    def test_excludes_unpublished_jobs(self):
        self.make_job(
            self.company, self.recruiter, title='Draft Backend',
            status=JobStatus.DRAFT, skills=['backend'],
        )
        self.auth(self.make_candidate(skills=['backend']))

        response = self.client.get(self.url)

        titles = [j['title'] for j in response.json()['results']]
        self.assertEqual(titles, ['Backend Dev'])

    def test_includes_company_name(self):
        self.auth(self.make_candidate(skills=['backend']))

        response = self.client.get(self.url)

        self.assertEqual(response.json()['results'][0]['company_name'], 'Acme')


class PublicJobDetailViewTests(SkillCatalogMixin, APITestCase):
    def setUp(self):
        self.company = self.make_company('Acme')
        self.recruiter = self.make_recruiter(self.company)

    def test_includes_company_name(self):
        job = self.make_job(self.company, self.recruiter, skills=['backend'])

        response = self.client.get(f'/api/v1/public/jobs/{job.id}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['company_name'], 'Acme')


class SkillModelTests(SkillCatalogMixin, APITestCase):
    def test_seeded_catalog_size(self):
        self.assertEqual(Skill.objects.count(), 8)

    def test_slug_is_unique(self):
        from django.db import IntegrityError, transaction

        with self.assertRaises(IntegrityError), transaction.atomic():
            Skill.objects.create(slug='backend', name='Backend Engineering')

    def test_renaming_a_skill_keeps_references_intact(self):
        """The reason slug exists: display name is free to change without
        breaking anything that points at the skill."""
        candidate = self.make_candidate(skills=['data-ml'])
        skill = self.skill('data-ml')

        skill.name = 'Data Science / ML'
        skill.save(update_fields=['name'])

        self.assertEqual(candidate.skills.get().slug, 'data-ml')
        self.assertEqual(candidate.skills.get().name, 'Data Science / ML')
