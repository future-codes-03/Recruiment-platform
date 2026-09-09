from django.urls import path

from . import views

urlpatterns = [
    path('signup/candidate', views.CandidateSignupView.as_view(), name='signup-candidate'),
    path('signup/company', views.CompanySignupView.as_view(), name='signup-company'),
    path('login', views.LoginView.as_view(), name='login'),
    # Not in docs/api_specification.yaml — candidate-only, see GoogleLoginView docstring.
    path('google', views.GoogleLoginView.as_view(), name='google-login'),
    path('refresh', views.RefreshTokenView.as_view(), name='refresh'),
    path('forgot-password', views.ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password', views.ResetPasswordView.as_view(), name='reset-password'),

    # Not in docs/api_specification.yaml — see VerifyEmailView/ResendVerificationView docstrings.
    path('verify-email', views.VerifyEmailView.as_view(), name='verify-email'),
    path('resend-verification', views.ResendVerificationView.as_view(), name='resend-verification'),

    # Spec path is /companies/me/verification-status (no /auth/ segment),
    # but this app is only mounted under .../auth/ at the project level —
    # see chat for the resulting path mismatch.
    path(
        'companies/me/verification-status',
        views.CompanyVerificationStatusView.as_view(),
        name='company-verification-status',
    ),
]
