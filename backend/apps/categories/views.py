from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from apps.categories.models import Category, SubCategory, SlaPolicy
from apps.categories.permissions import IsAdminOrReadOnly
from apps.categories.serializers import (
    CategorySerializer,
    SubCategorySerializer,
    SlaPolicySerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.prefetch_related('subcategories').all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        # Non-admins only see active categories
        if not (self.request.user.is_staff or getattr(self.request.user, 'is_admin_role', False)):
            qs = qs.filter(is_active=True)
        return qs


class SubCategoryViewSet(viewsets.ModelViewSet):
    queryset = SubCategory.objects.select_related('category').all()
    serializer_class = SubCategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'category__name']
    ordering_fields = ['name', 'created_at']
    ordering = ['category', 'name']

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)
        if not (self.request.user.is_staff or getattr(self.request.user, 'is_admin_role', False)):
            qs = qs.filter(is_active=True)
        return qs


class SlaPolicyViewSet(viewsets.ModelViewSet):
    queryset = SlaPolicy.objects.all()
    serializer_class = SlaPolicySerializer
    permission_classes = [IsAdminOrReadOnly]
    ordering = ['priority']
