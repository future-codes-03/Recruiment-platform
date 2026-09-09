import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_verification_email(user, token):
    verify_url = f'{settings.FRONTEND_URL}/verify-email?token={token}'
    try:
        send_mail(
            subject='Verify your email',
            message=(
                f'Welcome! Use the link below to verify your email:\n\n{verify_url}\n\n'
                "If you didn't create this account, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
    except Exception:
        # Called after the user row is already committed (signup views,
        # resend-verification) — a broken SMTP config must not 500 a
        # request whose DB write already succeeded, or the account is
        # stuck: it exists, but "already exists" blocks re-signup and no
        # link ever arrived. ResendVerificationView is the recovery path,
        # so failing silently here (loudly in the log) is safe.
        logger.exception('Failed to send verification email to %s', user.email)


def send_password_reset_email(user, reset_token):
    reset_url = f'{settings.FRONTEND_URL}/reset-password?token={reset_token}'
    try:
        send_mail(
            subject='Reset your password',
            message=(
                f'Use the link below to reset your password:\n\n{reset_url}\n\n'
                "If you didn't request this, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
    except Exception:
        logger.exception('Failed to send password reset email to %s', user.email)
