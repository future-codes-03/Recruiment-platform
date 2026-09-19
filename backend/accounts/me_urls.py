from django.urls import path

from . import views

urlpatterns = [
    path('me/profile', views.CandidateProfileView.as_view(), name='candidate-profile'),
    path('me/profile/cv', views.CandidateCVDeleteView.as_view(), name='candidate-cv-delete'),
    path('me/profile/phone', views.CandidatePhoneDeleteView.as_view(), name='candidate-phone-delete'),
]
