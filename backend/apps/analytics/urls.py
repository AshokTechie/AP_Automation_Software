from django.urls import path
from apps.analytics.views import DashboardSummaryView, GSTTaxReportView, ExceptionReportView

urlpatterns = [
    path('dashboard-summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('reports/gst-tax/', GSTTaxReportView.as_view(), name='report-gst-tax'),
    path('reports/exceptions-summary/', ExceptionReportView.as_view(), name='report-exceptions-summary'),
]
