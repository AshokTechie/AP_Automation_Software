from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.analytics.services.kpi_engine import KPIAnalyticsEngine
from apps.invoices.models import Invoice
from apps.exceptions_mgmt.models import APException, ExceptionCategory


class DashboardSummaryView(APIView):
    """
    Real-Time Executive Cockpit (Module 8).
    Provides aging buckets, turnaround times (TAT), OCR accuracy %, and vendor analytics.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = KPIAnalyticsEngine.get_dashboard_summary()
        return Response(data)


class GSTTaxReportView(APIView):
    """
    GST Reconciliation Report (Module 9).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        report_data = KPIAnalyticsEngine.get_gst_tax_report()
        return Response(report_data)


class ExceptionReportView(APIView):
    """
    Exceptions Analysis Report (Module 9).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        summary = []
        for cat in ExceptionCategory.values:
            total = APException.objects.filter(category=cat).count()
            unresolved = APException.objects.filter(category=cat, resolved=False).count()
            if total > 0:
                summary.append({
                    "category": cat,
                    "category_display": dict(ExceptionCategory.choices).get(cat, cat),
                    "total_count": total,
                    "unresolved_count": unresolved,
                    "resolved_count": total - unresolved
                })
        return Response(summary)
