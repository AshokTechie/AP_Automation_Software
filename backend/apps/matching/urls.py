from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.matching.views import MatchingResultViewSet, EvaluateMatchView, OverrideMatchView

router = DefaultRouter()
router.register(r'matching-results', MatchingResultViewSet, basename='matching-result')

urlpatterns = [
    path('evaluate/<uuid:invoice_id>/', EvaluateMatchView.as_view(), name='evaluate-match'),
    path('override/<uuid:invoice_id>/', OverrideMatchView.as_view(), name='override-match'),
    path('', include(router.urls)),
]
