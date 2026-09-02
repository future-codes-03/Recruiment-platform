from django.conf import settings
from django.core.mail import send_mail


def send_verification_email(user, token):
    verify_url = f'{settings.FRONTEND_URL}/verify-email?token={token}'
    send_mail(
        subject='Verify your email',
        message=(
            f'Welcome! Use the link below to verify your email:\n\n{verify_url}\n\n'
            "If you didn't create this account, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


def send_password_reset_email(user, reset_token):
    reset_url = f'{settings.FRONTEND_URL}/reset-password?token={reset_token}'
    send_mail(
        subject='Reset your password',
        message=(
            f'Use the link below to reset your password:\n\n{reset_url}\n\n'
            "If you didn't request this, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
