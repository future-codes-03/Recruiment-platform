from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class PublicResultsPagination(PageNumberPagination):
    page_size = 20  # not specified in the docs — defaulting to 20

    def get_paginated_response(self, data):
        return Response({
            'results': data,
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            # deliberately no 'previous' — the API spec's shape omits it
        })
