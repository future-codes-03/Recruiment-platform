from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .notifications import send_password_reset_email, send_verification_email
from .serializers import (
    CandidateSignupSerializer,
    CompanySerializer,
    CompanySignupSerializer,
    ForgotPasswordSerializer,
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
