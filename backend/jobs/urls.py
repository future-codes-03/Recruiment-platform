from django.urls import path

from . import views

urlpatterns = [
    path('public/skills', views.SkillListView.as_view(), name='public-skill-list'),
    path('public/jobs', views.PublicJobListView.as_view(), name='public-job-list'),
    path('public/jobs/<uuid:job_id>', views.PublicJobDetailView.as_view(), name='public-job-detail'),
    path('me/jobs', views.MatchedJobListView.as_view(), name='matched-job-list'),
]
