import 'dart:convert';

/// Error raised by any API interaction. `statusCode == 0` means a network
/// failure (no HTTP response was obtained).
class ApiException implements Exception {
  ApiException({
    required this.statusCode,
    required this.code,
    required this.detail,
    this.retryAfterSeconds,
  });

  factory ApiException.network(String detail) =>
      ApiException(statusCode: 0, code: 'NETWORK_ERROR', detail: detail);

  final int statusCode;
  final String code;
  final String detail;
  final int? retryAfterSeconds;

  bool get isNetwork => statusCode == 0;

  bool get isAuth => statusCode == 401;

  bool get isLicense =>
      statusCode == 402 ||
      code == 'INVALID_LICENSE_KEY' ||
      code == 'DEVICE_LIMIT_REACHED' ||
      code.startsWith('SUBSCRIPTION_');

  bool get isDeviceLimit => code == 'DEVICE_LIMIT_REACHED';

  @override
  String toString() => isNetwork ? detail : '[$statusCode $code] $detail';
}

// --------------------------------------------------------------------- auth --

class StoredUser {
  StoredUser({
    required this.id,
    required this.cedula,
    required this.fullName,
    required this.role,
  });

  factory StoredUser.fromJson(Map<String, dynamic> json) => StoredUser(
        id: (json['id'] ?? '') as String,
        cedula: (json['user_cedula'] ?? '') as String,
        fullName: (json['full_name'] ?? '') as String,
        role: (json['role'] ?? '') as String,
      );

  static StoredUser? tryParse(String? json) {
    if (json == null || json.isEmpty) return null;
    try {
      final decoded = jsonDecode(json);
      if (decoded is Map<String, dynamic>) return StoredUser.fromJson(decoded);
    } catch (_) {
      // Corrupted storage entry; force re-login.
    }
    return null;
  }

  final String id;
  final String cedula;
  final String fullName;
  final String role;

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_cedula': cedula,
        'full_name': fullName,
        'role': role,
      };

  String toJsonString() => jsonEncode(toJson());
}

// ----------------------------------------------------------------- manifest --

class ManifestProduct {
  ManifestProduct({
    required this.id,
    required this.barcodeQr,
    required this.description,
    required this.unit,
    required this.weight,
  });

  factory ManifestProduct.fromJson(Map<String, dynamic> json) =>
      ManifestProduct(
        id: (json['id'] ?? '') as String,
        barcodeQr: (json['barcode_qr'] ?? '') as String,
        description: (json['description'] ?? '') as String,
        unit: (json['unit'] ?? '') as String,
        weight: ((json['weight'] as num?) ?? 0).toDouble(),
      );

  final String id;
  final String barcodeQr;
  final String description;
  final String unit;
  final double weight;
}

class ManifestItem {
  ManifestItem({
    required this.routeDetailId,
    required this.status,
    required this.assignedQuantity,
    required this.deliveredQuantity,
    required this.returnRequired,
    required this.rejectionReason,
    required this.lastScanAt,
    required this.product,
  });

  factory ManifestItem.fromJson(Map<String, dynamic> json) => ManifestItem(
        routeDetailId: (json['route_detail_id'] ?? '') as String,
        status: (json['status'] ?? 'IN_TRUCK') as String,
        assignedQuantity: ((json['assigned_quantity'] as num?) ?? 0).toInt(),
        deliveredQuantity: ((json['delivered_quantity'] as num?) ?? 0).toInt(),
        returnRequired: json['return_required'] == true,
        rejectionReason: json['rejection_reason'] as String?,
        lastScanAt: json['last_scan_at'] as String?,
        product: ManifestProduct.fromJson(
          (json['product'] as Map<String, dynamic>?) ?? const {},
        ),
      );

  final String routeDetailId;
  final String status; // IN_TRUCK | DELIVERED | REJECTED
  final int assignedQuantity;
  final int deliveredQuantity;
  final bool returnRequired;
  final String? rejectionReason;
  final String? lastScanAt;
  final ManifestProduct product;

  bool get isDelivered => status == 'DELIVERED';
  bool get isRejected => status == 'REJECTED';
  bool get isPending => !isDelivered && !isRejected;
}

class ManifestData {
  ManifestData({
    required this.routeId,
    required this.routeDate,
    required this.routeStatus,
    required this.truckPlate,
    required this.message,
    required this.items,
    required this.counts,
    this.fromCache = false,
  });

  factory ManifestData.fromJson(
    Map<String, dynamic> json, {
    bool fromCache = false,
  }) {
    final routeRaw = json['route'];
    final route = routeRaw is Map<String, dynamic> ? routeRaw : null;

    String? truckPlate;
    final truckRaw = route?['truck'] ?? json['truck'];
    if (truckRaw is Map<String, dynamic>) {
      truckPlate = truckRaw['license_plate'] as String?;
    }

    final counts =
        (json['counts'] as Map<String, dynamic>?) ?? const <String, dynamic>{};

    final itemsRaw = json['items'];
    final items = <ManifestItem>[];
    if (itemsRaw is List) {
      for (final raw in itemsRaw) {
        if (raw is Map<String, dynamic>) items.add(ManifestItem.fromJson(raw));
      }
    }

    return ManifestData(
      routeId: route?['id'] as String?,
      routeDate: route?['route_date'] as String?,
      routeStatus: route?['status'] as String?,
      truckPlate: truckPlate,
      message: json['message'] as String?,
      items: items,
      counts: counts,
      fromCache: fromCache,
    );
  }

  static ManifestData? tryParse(String? json) {
    if (json == null || json.isEmpty) return null;
    try {
      final decoded = jsonDecode(json);
      if (decoded is Map<String, dynamic>) {
        return ManifestData.fromJson(decoded, fromCache: true);
      }
    } catch (_) {
      // Ignore corrupted cache.
    }
    return null;
  }

  final String? routeId;
  final String? routeDate;
  final String? routeStatus;
  final String? truckPlate;
  final String? message;
  final List<ManifestItem> items;
  final Map<String, dynamic> counts;
  final bool fromCache;

  bool get hasRoute => routeId != null;

  int get lines => ((counts['lines'] as num?) ?? 0).toInt();
  int get assignedUnits => ((counts['assigned_units'] as num?) ?? 0).toInt();
  int get deliveredUnits => ((counts['delivered_units'] as num?) ?? 0).toInt();
  int get rejectedLines => ((counts['rejected_lines'] as num?) ?? 0).toInt();
  int get inTruckLines => ((counts['in_truck_lines'] as num?) ?? 0).toInt();
  double get completionPct =>
      ((counts['completion_pct'] as num?) ?? 0).toDouble();

  List<ManifestItem> get pendingItems =>
      items.where((i) => i.isPending).toList(growable: false);

  int get pendingUnits => pendingItems.fold(
        0,
        (sum, item) => sum + (item.assignedQuantity - item.deliveredQuantity),
      );
}

// ------------------------------------------------------------------- scans --

/// One offline scan queued locally (sqflite row in `pending_scans`).
class PendingScan {
  PendingScan({
    this.id,
    required this.scanUuid,
    required this.qrCode,
    required this.action,
    required this.latitude,
    required this.longitude,
    required this.gpsAccuracy,
    required this.scanTimestampUtc,
    this.rejectionReason,
    this.rejectionNotes,
    this.podSignatureUrl,
    this.podPhotoUrl,
    this.failed = false,
    this.lastError,
    this.attemptCount = 0,
    required this.createdAt,
  });

  factory PendingScan.fromRow(Map<String, Object?> row) => PendingScan(
        id: row['id'] as int?,
        scanUuid: (row['scan_uuid'] ?? '') as String,
        qrCode: (row['qr_code'] ?? '') as String,
        action: (row['action'] ?? 'DELIVER') as String,
        latitude: ((row['latitude'] as num?) ?? 0).toDouble(),
        longitude: ((row['longitude'] as num?) ?? 0).toDouble(),
        gpsAccuracy: (row['gps_accuracy'] as num?)?.toDouble(),
        scanTimestampUtc: (row['scan_timestamp_utc'] ?? '') as String,
        rejectionReason: row['rejection_reason'] as String?,
        rejectionNotes: row['rejection_notes'] as String?,
        podSignatureUrl: row['pod_signature_url'] as String?,
        podPhotoUrl: row['pod_photo_url'] as String?,
        failed: (row['failed'] as int? ?? 0) == 1,
        lastError: row['last_error'] as String?,
        attemptCount: (row['attempt_count'] as int?) ?? 0,
        createdAt: (row['created_at'] ?? '') as String,
      );

  final int? id;
  final String scanUuid;
  final String qrCode;
  final String action;
  final double latitude;
  final double longitude;
  final double? gpsAccuracy;
  final String scanTimestampUtc;
  final String? rejectionReason;
  final String? rejectionNotes;
  final String? podSignatureUrl;
  final String? podPhotoUrl;
  final bool failed;
  final String? lastError;
  final int attemptCount;
  final String createdAt;

  Map<String, Object?> toRow() => {
        'scan_uuid': scanUuid,
        'qr_code': qrCode,
        'action': action,
        'latitude': latitude,
        'longitude': longitude,
        'gps_accuracy': gpsAccuracy,
        'scan_timestamp_utc': scanTimestampUtc,
        'rejection_reason': rejectionReason,
        'rejection_notes': rejectionNotes,
        'pod_signature_url': podSignatureUrl,
        'pod_photo_url': podPhotoUrl,
        'failed': failed ? 1 : 0,
        'last_error': lastError,
        'attempt_count': attemptCount,
        'created_at': createdAt,
      };

  /// Payload for POST /api/v1/mobile/deliveries/sync-batch.
  Map<String, dynamic> toScanItemJson() => {
        'scan_uuid': scanUuid,
        'qr_code': qrCode,
        'action': action,
        'latitude': latitude,
        'longitude': longitude,
        if (gpsAccuracy != null) 'gps_accuracy_m': gpsAccuracy,
        'is_mocked_location': false,
        'scan_timestamp_utc': scanTimestampUtc,
        if (rejectionReason != null) 'rejection_reason': rejectionReason,
        if (rejectionNotes != null && rejectionNotes!.isNotEmpty)
          'rejection_notes': rejectionNotes,
        if (podSignatureUrl != null) 'pod_signature_url': podSignatureUrl,
        if (podPhotoUrl != null) 'pod_photo_url': podPhotoUrl,
      };
}

/// One proof-of-delivery artifact waiting to be uploaded (`pod_pending`).
class PodPending {
  PodPending({
    this.id,
    required this.scanUuid,
    required this.kind, // signature | photo
    required this.localPath,
    required this.createdAt,
  });

  factory PodPending.fromRow(Map<String, Object?> row) => PodPending(
        id: row['id'] as int?,
        scanUuid: (row['scan_uuid'] ?? '') as String,
        kind: (row['kind'] ?? 'signature') as String,
        localPath: (row['local_path'] ?? '') as String,
        createdAt: (row['created_at'] ?? '') as String,
      );

  final int? id;
  final String scanUuid;
  final String kind;
  final String localPath;
  final String createdAt;

  Map<String, Object?> toRow() => {
        'scan_uuid': scanUuid,
        'kind': kind,
        'local_path': localPath,
        'created_at': createdAt,
      };
}

/// Result of `SyncEngine.submitScan`.
class ScanOutcome {
  ScanOutcome({
    required this.scanUuid,
    required this.ok,
    required this.queued,
    required this.duplicate,
    required this.routeCompleted,
    required this.message,
    this.code,
    this.productDescription,
  });

  final String scanUuid;
  final bool ok;
  final bool queued;
  final bool duplicate;
  final bool routeCompleted;
  final String message;
  final String? code;
  final String? productDescription;

  /// True when the scan happened live (server answered) and evidence can be
  /// attached immediately.
  bool get attachedOnline => ok && !queued;
}

/// Result of uploading/attaching a PoD artifact.
class PodAttachResult {
  PodAttachResult({
    required this.storedOnServer,
    required this.queuedOffline,
    this.warning,
  });

  /// Signature/photo URL already registered against a server-side scan.
  final bool storedOnServer;

  /// Saved locally; will be uploaded automatically by the sync engine.
  final bool queuedOffline;

  final String? warning;
}

// ---------------------------------------------------------------- heartbeat --

class LicenseInfo {
  LicenseInfo({
    required this.licenseKey,
    required this.companyName,
    required this.subscriptionStatus,
    required this.expirationDate,
    required this.daysRemaining,
    required this.expiringSoon,
    required this.expired,
    required this.maxTrucks,
    required this.activeDevices,
    required this.deviceTtlDays,
  });

  factory LicenseInfo.fromJson(Map<String, dynamic> json) => LicenseInfo(
        licenseKey: (json['license_key'] ?? '') as String,
        companyName: (json['company_name'] ?? '') as String,
        subscriptionStatus: (json['subscription_status'] ?? 'ACTIVE') as String,
        expirationDate: (json['expiration_date'] ?? '') as String,
        daysRemaining: ((json['days_remaining'] as num?) ?? 0).toInt(),
        expiringSoon: json['expiring_soon'] == true,
        expired: json['expired'] == true,
        maxTrucks: ((json['max_trucks'] as num?) ?? 0).toInt(),
        activeDevices: ((json['active_devices'] as num?) ?? 0).toInt(),
        deviceTtlDays: ((json['device_ttl_days'] as num?) ?? 0).toInt(),
      );

  final String licenseKey;
  final String companyName;
  final String subscriptionStatus; // ACTIVE | SUSPENDED
  final String expirationDate;
  final int daysRemaining;
  final bool expiringSoon;
  final bool expired;
  final int maxTrucks;
  final int activeDevices;
  final int deviceTtlDays;

  bool get isActive => subscriptionStatus == 'ACTIVE' && !expired;
}

class HeartbeatResult {
  HeartbeatResult({
    required this.serverTimeUtc,
    required this.license,
    required this.graceToken,
    required this.graceExpiresAt,
  });

  factory HeartbeatResult.fromJson(Map<String, dynamic> json) =>
      HeartbeatResult(
        serverTimeUtc: (json['server_time_utc'] ?? '') as String,
        license: LicenseInfo.fromJson(
          (json['license'] as Map<String, dynamic>?) ?? const {},
        ),
        graceToken: (json['grace_token'] ?? '') as String,
        graceExpiresAt: (json['grace_expires_at'] ?? '') as String,
      );

  final String serverTimeUtc;
  final LicenseInfo license;
  final String graceToken;
  final String graceExpiresAt;
}
