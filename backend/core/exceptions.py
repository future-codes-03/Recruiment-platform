from rest_framework.views import exception_handler as drf_exception_handler

STATUS_ERROR_CODES = {
    400: 'ERR_VALIDATION',
    401: 'ERR_UNAUTHENTICATED',
    403: 'ERR_FORBIDDEN',
    404: 'ERR_NOT_FOUND',
    405: 'ERR_METHOD_NOT_ALLOWED',
}


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    if isinstance(detail, dict) and set(detail.keys()) == {'detail'}:
        message, details = str(detail['detail']), None
    else:
        message, details = 'Request could not be processed.', detail

    response.data = {
        'error_code': STATUS_ERROR_CODES.get(response.status_code, 'ERR_UNKNOWN'),
        'message': message,
    }
    if details is not None:
        response.data['details'] = details
    return response
