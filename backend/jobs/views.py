from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import PublicResultsPagination
from core.permissions import IsCandidate

from .models import Job, JobStatus
from .serializers import PublicJobSerializer


class PublicJobListView(APIView):
    permission_classes = [AllowAny]
    pagination_class = PublicResultsPagination

    def get(self, request):
        jobs = Job.objects.filter(status=JobStatus.PUBLISHED)

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
        jobs = Job.objects.filter(status=JobStatus.PUBLISHED)

        skills = request.user.skills
        if skills:
            # OR-chain of case-insensitive matches, one per saved skill —
            # __in is case-sensitive so it can't be used directly here.
            skill_q = Q()
            for skill_name in skills:
                skill_q |= Q(skill_requirements__skill__name__iexact=skill_name)
            jobs = jobs.filter(skill_q).distinct()

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
        job = Job.objects.filter(pk=job_id, status=JobStatus.PUBLISHED).first()
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
