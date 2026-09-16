from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import PublicResultsPagination
from core.permissions import IsCandidate

from .models import Job, JobStatus, Skill
from .serializers import PublicJobSerializer, SkillSerializer

# company_name and skill_requirements are on every serialized job, so both
# list views pull them in one pass instead of one query per row.
JOB_LIST_RELATIONS = {
    'select_related': ('company',),
    'prefetch_related': ('skill_requirements__skill',),
}


class SkillListView(APIView):
    """GET /api/v1/public/skills — the full skill catalog, public.

    Feeds the candidate onboarding picker so the frontend never hardcodes a
    list that can drift from what the API accepts. Unpaginated on purpose:
    the catalog is a closed, seeded set (see jobs/migrations/0004), and a
    picker needs all of it at once.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        skills = Skill.objects.all()  # Meta.ordering = ['name']
        return Response(SkillSerializer(skills, many=True).data, status=status.HTTP_200_OK)


class PublicJobListView(APIView):
    permission_classes = [AllowAny]
    pagination_class = PublicResultsPagination

    def get(self, request):
        jobs = Job.objects.filter(status=JobStatus.PUBLISHED).select_related(
            *JOB_LIST_RELATIONS['select_related']
        ).prefetch_related(*JOB_LIST_RELATIONS['prefetch_related'])

        skill = request.query_params.get('skill')
        if skill:
            # .distinct() is cheap insurance: today's uniqueness constraints
            # (Skill name, JobSkillRequirement job+skill) make fan-out
            # impossible for a single-skill filter, but that's not obvious
            # from reading this view alone, and it becomes load-bearing the
            # moment multi-skill filtering (?skill=a&skill=b) is added later.
            jobs = jobs.filter(skill_requirements__skill__name__iexact=skill).distinct()

        # Job has no Meta.ordering and PKs are random UUIDs — pagination
        # needs an explicit, stable order.
        jobs = jobs.order_by('-created_at')

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(jobs, request, view=self)
        serializer = PublicJobSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class MatchedJobListView(APIView):
    """GET /api/v1/me/jobs — candidate-only. Returns published jobs whose
    required skills overlap with the candidate's own saved skills (any
    overlap, not full coverage). A candidate with no skills saved yet
    falls back to every published job, same as public browsing."""
    permission_classes = [IsAuthenticated, IsCandidate]
    pagination_class = PublicResultsPagination

    def get(self, request):
        jobs = Job.objects.filter(status=JobStatus.PUBLISHED).select_related(
            *JOB_LIST_RELATIONS['select_related']
        ).prefetch_related(*JOB_LIST_RELATIONS['prefetch_related'])

        # Match on catalog IDs, not names. Both sides of this comparison are
        # FKs to the same closed Skill catalog now, so there is no casing or
        # spelling to reconcile — and no need for the old per-skill iexact
        # OR-chain. Evaluated to a list so the emptiness check below is a
        # real check: `request.user.skills` is a manager and always truthy.
        skill_ids = list(request.user.skills.values_list('id', flat=True))
        if skill_ids:
            jobs = jobs.filter(skill_requirements__skill_id__in=skill_ids).distinct()

        jobs = jobs.order_by('-created_at')

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(jobs, request, view=self)
        serializer = PublicJobSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class PublicJobDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        # Filtering status=PUBLISHED directly (rather than get_object_or_404
        # + separate status checks) collapses "nonexistent", "draft",
        # "closed", and "soft-deleted" into one 404 branch with one meaning —
        # matches the spec's intent that an unpublished job's id must not be
        # distinguishable from a truly nonexistent one.
        job = Job.objects.filter(
            pk=job_id, status=JobStatus.PUBLISHED
        ).select_related('company').first()
        if job is None:
            # Hand-rolled {error_code, message} per backend/CLAUDE.md's
            # mandated error shape — no shared exception handler exists yet
            # (core owes one per backend/CLAUDE.md's app table). Not using
            # get_object_or_404 here since it raises Http404, which DRF's
            # default handler turns into {"detail": "..."}, not this shape.
            return Response(
                {'error_code': 'ERR_JOB_NOT_FOUND', 'message': 'Job not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PublicJobSerializer(job).data, status=status.HTTP_200_OK)
