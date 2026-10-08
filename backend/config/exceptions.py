import logging
from rest_framework.views import exception_handler
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Centralized exception handler that wraps all exceptions in a predictable,
    standardized JSON envelope across the entire API.
    """
    # Call REST framework's default exception handler first to get the standard error response.
    response = exception_handler(exc, context)

    # If DRF handled it, standardize the response format
    if response is not None:
        error_code = 'API_ERROR'
        message = 'An error occurred processing your request.'

        if isinstance(exc, ValidationError):
            error_code = 'VALIDATION_ERROR'
            message = 'Invalid input data.'
        elif isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            error_code = 'AUTHENTICATION_FAILED'
            message = 'Authentication credentials were not provided or are invalid.'
        elif isinstance(exc, PermissionDenied):
            error_code = 'PERMISSION_DENIED'
            message = 'You do not have permission to perform this action.'
        elif isinstance(exc, NotFound):
            error_code = 'NOT_FOUND'
            message = 'Requested resource was not found.'

        formatted_response = {
            'success': False,
            'status_code': response.status_code,
            'error': {
                'code': error_code,
                'message': message,
                'details': response.data,
            },
        }
        response.data = formatted_response
        return response

    # Handle unhandled Python exceptions (500 Internal Server Error)
    view = context.get('view', None)
    view_name = view.__class__.__name__ if view else 'UnknownView'
    logger.error(f"Unhandled Exception in {view_name}: {str(exc)}", exc_info=True)

    return Response(
        {
            'success': False,
            'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'error': {
                'code': 'SERVER_ERROR',
                'message': 'An internal server error occurred. Support has been notified.',
                'details': None,
            },
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
