from rest_framework import serializers
from apps.vendors.models import Vendor, VendorBankAccount, VendorChangeLog


class VendorBankAccountSerializer(serializers.ModelSerializer):
    masked_account_number = serializers.CharField(read_only=True)

    class Meta:
        model = VendorBankAccount
        fields = [
            'id', 'vendor', 'account_number', 'masked_account_number',
            'account_holder_name', 'ifsc_code', 'bank_name', 'branch_name',
            'is_primary', 'is_verified', 'verified_at', 'verification_reference'
        ]
        extra_kwargs = {
            'account_number': {'write_only': True}  # Secure: raw account number write-only
        }


class VendorSerializer(serializers.ModelSerializer):
    bank_accounts = VendorBankAccountSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    primary_bank = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            'id', 'vendor_code', 'name', 'trade_name', 'gstin', 'pan',
            'is_msme', 'msme_reg_number', 'contact_person', 'email', 'phone',
            'address_line', 'city', 'state', 'pincode', 'payment_terms_days',
            'status', 'status_display', 'is_gstin_verified', 'bank_accounts',
            'primary_bank', 'created_at', 'updated_at'
        ]

    def get_primary_bank(self, obj):
        primary = obj.bank_accounts.filter(is_primary=True).first()
        if primary:
            return {
                'id': str(primary.id),
                'bank_name': primary.bank_name,
                'masked_account_number': primary.masked_account_number,
                'ifsc_code': primary.ifsc_code,
                'is_verified': primary.is_verified,
            }
        return None


class VendorChangeLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.get_full_name', read_only=True)

    class Meta:
        model = VendorChangeLog
        fields = '__all__'
