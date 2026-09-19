import cloudinary.uploader
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from core.permissions import IsCandidate

from .notifications import send_password_reset_email, send_verification_email
from .serializers import (
    CandidateProfileSerializer,
    CandidateProfileWriteSerializer,
    CandidateSignupSerializer,
    CompanySerializer,
    CompanySignupSerializer,
    ForgotPasswordSerializer,
    GoogleLoginSerializer,
    LoginSerializer,
    RefreshTokenSerializer,
    ResendVerificationSerializer,
    ResetPasswordSerializer,
    UserSerializer,
    VerifyEmailSerializer,
    make_email_verification_token,
    make_reset_token,
)


class CandidateSignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CandidateSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_verification_email(user, make_email_verification_token(user))
        return Response(
            {
                'user': UserSerializer(user).data,
                'message': 'Verification email sent',
            },
            status=status.HTTP_201_CREATED,
        )


class CompanySignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CompanySignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        user = result['user']
        send_verification_email(user, make_email_verification_token(user))
        return Response(
            {
                'company': CompanySerializer(result['company']).data,
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        # Not raise_exception=True: the spec only defines 200/401 for this
        # endpoint (no 400) — any validation failure, including a missing
        # field, maps to the same generic 401 as bad credentials.
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        data = serializer.validated_data
        return Response(
            {
                'access_token': data['access_token'],
                'refresh_token': data['refresh_token'],
                'expires_in': data['expires_in'],
                'user': UserSerializer(data['user']).data,
            },
            status=status.HTTP_200_OK,
        )


class GoogleLoginView(APIView):
    """
    POST /auth/google — not in docs/api_specification.yaml. Candidate-only
    Google sign-in: exchanges a Google ID token for a SkillBridge session,
    creating the candidate account on first sign-in. Flagged, not skipped —
    see .claude/specs/login-with-google.md.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        # Unlike LoginView: a missing id_token is a client bug (400, standard
        # DRF behavior via raise_exception=True), distinct from a rejected/
        # invalid Google token (401, raised as AuthenticationFailed inside
        # save() and handled automatically by DRF's exception handling).
        serializer.is_valid(raise_exception=True)
        data = serializer.save()

        return Response(
            {
                'access_token': data['access_token'],
                'refresh_token': data['refresh_token'],
                'expires_in': data['expires_in'],
                'user': UserSerializer(data['user']).data,
                # Siblings of 'user', not fields on UserSerializer — that
                # serializer is shared with company signup and email/password
                # login, where a candidate-only completeness flag is
                # meaningless.
                'profile_complete': data['profile_complete'],
                'missing_fields': data['missing_fields'],
            },
            status=status.HTTP_201_CREATED if data['created'] else status.HTTP_200_OK,
        )


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        # Same reasoning as LoginView: spec only defines 200/401 here.
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.get_user()
        if user is not None:
            send_password_reset_email(user, make_reset_token(user))

        # Same response whether or not the email is registered — never
        # leak which emails exist.
        return Response(
            {'message': 'If that email is registered, a reset link has been sent.'},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Force re-login everywhere, not just the current session.
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        return Response(
            {'message': 'Password updated. Please log in again.'},
            status=status.HTTP_200_OK,
        )


class VerifyEmailView(APIView):
    """
    POST /auth/verify-email — not in docs/api_specification.yaml. Spec gap:
    the YAML implies link-based verification (the "Verification email sent"
    message on signup) but never defines the endpoint the link actually
    hits. Flagged, not skipped.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'message': 'Email verified successfully.'},
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    """
    POST /auth/resend-verification — not in docs/api_specification.yaml.
    Same spec gap as VerifyEmailView: there's no documented way to get a
    new link once the first one expires or never arrives. Flagged, not
    skipped.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.get_user()
        if user is not None:
            send_verification_email(user, make_email_verification_token(user))

        # Same response whether the account doesn't exist, is already
        # verified, or genuinely got a new link — never distinguish.
        return Response(
            {'message': 'If that email needs verification, a new link has been sent.'},
            status=status.HTTP_200_OK,
        )


class CompanyVerificationStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = request.user.company
        if company is None:
            return Response(
                {'detail': 'This account is not associated with a company.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            {
                'is_verified': company.is_verified,
                'submitted_at': company.created_at,
            },
            status=status.HTTP_200_OK,
        )


class CandidateProfileView(APIView):
    """
    GET/PUT/PATCH /api/v1/me/profile — candidate's own CV + skills.
    PUT = full submission (both cv and skills required). PATCH = partial
    edit (either field, independently). Candidate-only; identifies the
    user from the access token, never a submitted user_id.
    """
    permission_classes = [IsAuthenticated, IsCandidate]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(CandidateProfileSerializer(request.user).data, status=status.HTTP_200_OK)

    def put(self, request):
        return self._write(request, partial=False)

    def patch(self, request):
        return self._write(request, partial=True)

    def _write(self, request, partial):
        serializer = CandidateProfileWriteSerializer(
            data=request.data, partial=partial, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(CandidateProfileSerializer(user).data, status=status.HTTP_200_OK)


class CandidateCVDeleteView(APIView):
    """
    DELETE /api/v1/me/profile/cv — removes the candidate's uploaded CV.
    Candidate-only; identifies the user from the access token, never a
    submitted user_id.
    """
    permission_classes = [IsAuthenticated, IsCandidate]

    def delete(self, request):
        user = request.user
        if not user.resume_url:
            return Response(
                {'error_code': 'ERR_CV_NOT_FOUND', 'message': 'No CV on file to delete.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Don't branch on the destroy result ('ok' vs 'not found') — either
        # way the candidate's desired end state (no CV on their profile) is
        # the same, and blocking on a Cloudinary-side asset that's already
        # gone would leave the profile stuck with a dangling resume_url.
        cloudinary.uploader.destroy(f'candidate_cvs/{user.id}', resource_type='raw')

        user.resume_url = ''
        user.cv_uploaded_at = None
        user.save(update_fields=['resume_url', 'cv_uploaded_at'])
        return Response(CandidateProfileSerializer(user).data, status=status.HTTP_200_OK)


class CandidatePhoneDeleteView(APIView):
    """
    DELETE /api/v1/me/profile/phone — removes the candidate's phone number.
    Candidate-only; identifies the user from the access token, never a
    submitted user_id. No external-service cleanup to do, unlike the CV
    delete — a phone number is a column, not a file.

    For a Google-signup candidate this puts 'phone' back on missing_fields
    and flips profile_complete to false, re-gating them on next login — the
    same recompute-every-time behaviour CV deletion already has.
    """
    permission_classes = [IsAuthenticated, IsCandidate]

    def delete(self, request):
        user = request.user
        if not user.phone.strip():
            return Response(
                {
                    'error_code': 'ERR_PHONE_NOT_FOUND',
                    'message': 'No phone number on file to delete.',
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        user.phone = ''
        user.save(update_fields=['phone'])
        return Response(CandidateProfileSerializer(user).data, status=status.HTTP_200_OK)
