from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.categories.views import CategoryViewSet, SubCategoryViewSet, SlaPolicyViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'subcategories', SubCategoryViewSet, basename='subcategory')
router.register(r'sla-policies', SlaPolicyViewSet, basename='sla-policy')

urlpatterns = [
    path('', include(router.urls)),
]
