from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from apps.procurement.models import PurchaseOrder, POLineItem, GoodsReceiptNote, ImportBatch
from apps.procurement.serializers import (
    PurchaseOrderSerializer, POLineItemSerializer,
    GoodsReceiptNoteSerializer, ImportBatchSerializer
)
from apps.procurement.services.importer import BulkDataImporter
from apps.core.audit import log_event


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().prefetch_related('items', 'vendor')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['vendor', 'status']
    search_fields = ['po_number', 'vendor__name']


class GoodsReceiptNoteViewSet(viewsets.ModelViewSet):
    queryset = GoodsReceiptNote.objects.all().prefetch_related('items', 'po')
    serializer_class = GoodsReceiptNoteSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['po', 'status']
    search_fields = ['grn_number', 'po__po_number', 'delivery_note_number']


class ImportUploadView(APIView):
    """
    Handles Excel and CSV file upload for PO and GRN data.
    Parses headers, validates row integrity, master relations, and provides preview.
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        batch_type = request.data.get('batch_type', 'PO').upper()

        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        batch = ImportBatch.objects.create(
            batch_type=batch_type,
            file_name=uploaded_file.name,
            uploaded_file=uploaded_file,
            uploaded_by=request.user if request.user.is_authenticated else None
        )

        try:
            if batch_type == 'PO':
                BulkDataImporter.validate_po_batch(batch)
            elif batch_type == 'GRN':
                BulkDataImporter.validate_grn_batch(batch)
            else:
                return Response({"error": "Invalid batch_type. Must be PO or GRN."}, status=status.HTTP_400_BAD_REQUEST)

            log_event(
                action='IMPORT_BATCH_UPLOADED',
                entity_type='ImportBatch',
                entity_id=str(batch.id),
                user=request.user,
                details={'file_name': batch.file_name, 'batch_type': batch_type}
            )

            return Response(ImportBatchSerializer(batch).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            batch.status = 'REJECTED'
            batch.save()
            return Response({"error": str(e), "batch_id": batch.id}, status=status.HTTP_400_BAD_REQUEST)


class ImportCommitView(APIView):
    """
    Commits a validated import batch to the database.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, batch_id):
        try:
            batch = ImportBatch.objects.get(id=batch_id)
        except ImportBatch.DoesNotExist:
            return Response({"error": "Import batch not found"}, status=status.HTTP_404_NOT_FOUND)

        if batch.status == 'COMMITTED':
            return Response({"error": "This batch has already been committed"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else None
        if batch.batch_type == 'PO':
            success, message = BulkDataImporter.commit_po_batch(batch, user)
        else:
            success, message = BulkDataImporter.commit_grn_batch(batch, user)

        if success:
            return Response({"message": message, "batch": ImportBatchSerializer(batch).data})
        else:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
