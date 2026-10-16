import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../core/config.dart';
import '../services/location_service.dart';
import 'api_client.dart';
import 'local_db.dart';
import 'models.dart';

/// Offline-first synchronization engine.
///
/// * live scans go straight to the server when connectivity looks good
/// * otherwise (or when the request fails mid-flight) they are queued in the
///   local database with their client-generated `scan_uuid`
/// * the queue is flushed in one atomic batch (`sync-batch`), item by item
/// * PoD artifacts are uploaded and attached afterwards (`pod` +
///   `pod-attach`), or injected into still-queued scans
class SyncEngine extends ChangeNotifier {
  SyncEngine({required this.api, required this.db});

  final ApiClient api;
  final LocalDb db;
  final Connectivity _connectivity = Connectivity();

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _autoTimer;
  Timer? _retryTimer;

  bool _started = false;
  bool _online = true;
  bool _syncing = false;
  int _retryIndex = 0;

  bool get online => _online;
  bool get syncing => _syncing;
  int pendingCount = 0;
  int failedCount = 0;
  int podPendingCount = 0;
  DateTime? lastSyncAt;
  String? lastSyncError;

  bool get hasPending => pendingCount > 0 || podPendingCount > 0;

  Future<void> start() async {
    if (_started) return;
    _started = true;

    await refreshCounters();

    try {
      final results = await _connectivity.checkConnectivity();
      _online = _isConnected(results);
    } catch (_) {
      _online = true; // assume online; live scan will fall back to the queue
    }

    _connectivitySub =
        _connectivity.onConnectivityChanged.listen((results) {
      final wasOffline = !_online;
      _online = _isConnected(results);
      notifyListeners();
      if (_online && wasOffline) flush();
    });

    _autoTimer = Timer.periodic(AppConfig.autoFlushInterval, (_) {
      if (_online && hasPending && !_syncing) flush();
    });
  }

  bool _isConnected(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);

  // -------------------------------------------------------------- submitScan --

  /// Registers one physical scan. Returns the outcome (live or queued).
  /// Business errors (409/422/404) are re-thrown as [ApiException].
  Future<ScanOutcome> submitScan({
    required String qrCode,
    required String action,
    required ScanLocation location,
    String? rejectionReason,
    String? rejectionNotes,
  }) async {
    if (location.isMocked) {
      throw ApiException(
        statusCode: 422,
        code: 'MOCK_LOCATION_DETECTED',
        detail: 'Ubicación simulada detectada. Desactive el GPS falso.',
      );
    }

    final scanUuid = const Uuid().v4();
    final payload = <String, dynamic>{
      'scan_uuid': scanUuid,
      'qr_code': qrCode,
      'action': action,
      'latitude': location.latitude,
      'longitude': location.longitude,
      if (location.accuracy != null) 'gps_accuracy_m': location.accuracy,
      'is_mocked_location': location.isMocked,
      'scan_timestamp_utc': location.capturedAtUtc.toIso8601String(),
      if (rejectionReason != null) 'rejection_reason': rejectionReason,
      if (rejectionNotes != null && rejectionNotes.isNotEmpty)
        'rejection_notes': rejectionNotes,
    };

    if (_online) {
      try {
        final response =
            await api.postJson('/api/v1/mobile/deliveries/scan', payload);
        return ScanOutcome(
          scanUuid: scanUuid,
          ok: true,
          queued: false,
          duplicate: response['duplicate'] == true,
          routeCompleted: response['route_completed'] == true,
          message: (response['message'] as String?) ?? 'Escaneo registrado.',
          code: response['code'] as String?,
          productDescription: response['product_description'] as String?,
        );
      } on ApiException catch (e) {
        if (!e.isNetwork) rethrow; // business rule or license error
        // Network died mid-flight: fall through and queue locally.
        _online = false;
        notifyListeners();
      }
    }

    await db.enqueuePendingScan(
      PendingScan(
        scanUuid: scanUuid,
        qrCode: qrCode,
        action: action,
        latitude: location.latitude,
        longitude: location.longitude,
        gpsAccuracy: location.accuracy,
        scanTimestampUtc: location.capturedAtUtc.toIso8601String(),
        rejectionReason: rejectionReason,
        rejectionNotes: rejectionNotes,
        createdAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
    await refreshCounters();
    _scheduleRetry();
    return ScanOutcome(
      scanUuid: scanUuid,
      ok: true,
      queued: true,
      duplicate: false,
      routeCompleted: false,
      message: 'Guardado sin conexión. Se sincronizará automáticamente.',
    );
  }

  // --------------------------------------------------------------- attachPod --

  /// Uploads a PoD artifact (signature/photo) and attaches it to [scanUuid].
  /// Queues it locally when offline.
  Future<PodAttachResult> attachPod({
    required String scanUuid,
    required String kind,
    required Uint8List bytes,
  }) async {
    if (_online) {
      try {
        final upload = await api.uploadPod(
          bytes: bytes,
          kind: kind,
          filename: kind == 'signature' ? 'signature.png' : 'evidence.jpg',
        );
        final url = upload['url'] as String?;
        if (url == null || url.isEmpty) {
          throw ApiException(
            statusCode: 500,
            code: 'UPLOAD_FAILED',
            detail: 'El servidor no devolvió la URL de la evidencia.',
          );
        }
        try {
          await api.postJson('/api/v1/mobile/deliveries/pod-attach', {
            'scan_uuid': scanUuid,
            if (kind == 'signature') 'pod_signature_url': url,
            if (kind == 'photo') 'pod_photo_url': url,
          });
          return PodAttachResult(storedOnServer: true, queuedOffline: false);
        } on ApiException catch (e) {
          if (e.statusCode == 404) {
            // Scan still queued locally: carry the URL with the batch.
            final injected = await db.injectPodUrl(scanUuid, kind, url);
            if (injected) {
              return PodAttachResult(storedOnServer: false, queuedOffline: false);
            }
          }
          rethrow;
        }
      } on ApiException catch (e) {
        if (!e.isNetwork) rethrow;
        _online = false;
        notifyListeners();
      }
    }

    final path = await _storePodFile(scanUuid, kind, bytes);
    if (path == null) {
      throw ApiException(
        statusCode: 500,
        code: 'POD_STORAGE_ERROR',
        detail: 'No se pudo guardar la evidencia localmente.',
      );
    }
    await db.addPodPending(
      PodPending(
        scanUuid: scanUuid,
        kind: kind,
        localPath: path,
        createdAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
    await refreshCounters();
    _scheduleRetry();
    return PodAttachResult(storedOnServer: false, queuedOffline: true);
  }

  // ------------------------------------------------------------------- flush --

  /// Drains the offline queue. Scans first (atomic batch), then PoD files.
  Future<void> flush({bool manual = false}) async {
    if (_syncing || !_online) {
      if (manual) notifyListeners();
      return;
    }
    _syncing = true;
    lastSyncError = null;
    notifyListeners();

    try {
      final pending = await db.pendingScans();
      if (pending.isNotEmpty) {
        final response = await api.postJson(
          '/api/v1/mobile/deliveries/sync-batch',
          {
            'items': pending.map((s) => s.toScanItemJson()).toList(),
            'batch_reference':
                'flutter-${DateTime.now().millisecondsSinceEpoch}',
          },
        );
        final results = response['results'];
        if (results is List) {
          for (final raw in results) {
            if (raw is! Map<String, dynamic>) continue;
            final scanUuid = raw['scan_uuid'] as String?;
            if (scanUuid == null) continue;
            final accepted =
                raw['accepted'] == true || raw['duplicate'] == true;
            if (accepted) {
              await db.deleteScan(scanUuid);
            } else {
              final code = (raw['code'] as String?) ?? 'REJECTED';
              final message =
                  (raw['message'] as String?) ?? 'Rechazado por el servidor.';
              await db.markScanFailed(scanUuid, '$code: $message');
            }
          }
        }
        lastSyncAt = DateTime.now();
      }

      // PoD artifacts for scans that are already on the server.
      final pods = await db.podPendings();
      for (final pod in pods) {
        final id = pod.id;
        if (id == null) continue;
        final file = File(pod.localPath);
        if (!await file.exists()) {
          await db.deletePodPending(id);
          continue;
        }
        try {
          final bytes = await file.readAsBytes();
          final upload = await api.uploadPod(
            bytes: bytes,
            kind: pod.kind,
            filename: pod.kind == 'signature' ? 'signature.png' : 'evidence.jpg',
          );
          final url = upload['url'] as String?;
          if (url == null || url.isEmpty) {
            throw ApiException(
              statusCode: 500,
              code: 'UPLOAD_FAILED',
              detail: 'El servidor no devolvió la URL de la evidencia.',
            );
          }
          await api.postJson('/api/v1/mobile/deliveries/pod-attach', {
            'scan_uuid': pod.scanUuid,
            if (pod.kind == 'signature') 'pod_signature_url': url,
            if (pod.kind == 'photo') 'pod_photo_url': url,
          });
          await db.deletePodPending(id);
          try {
            await file.delete();
          } catch (_) {
            // Non-fatal: stale file cleaned up on a later pass.
          }
        } on ApiException catch (e) {
          if (e.statusCode == 404) {
            // Orphan pod (scan never landed on the server).
            await db.deletePodPending(id);
            continue;
          }
          if (e.isNetwork) rethrow;
          // License/other server error: stop draining, keep the file.
          _recordServerError(e);
          break;
        }
      }
      lastSyncAt = DateTime.now();
      _cancelRetry();
    } on ApiException catch (e) {
      _recordServerError(e);
      if (e.isNetwork) {
        _online = false;
        _scheduleRetry();
      }
    } finally {
      _syncing = false;
      await refreshCounters();
    }
  }

  void _recordServerError(ApiException e) {
    if (e.isNetwork) {
      lastSyncError = 'Sin conexión con el servidor. Reintentando…';
    } else {
      lastSyncError = e.detail;
    }
  }

  // ------------------------------------------------------------ queue helpers --

  Future<void> retryFailedScan(String scanUuid) async {
    await db.clearScanFailure(scanUuid);
    await refreshCounters();
    await flush(manual: true);
  }

  Future<void> deletePendingScan(String scanUuid) async {
    await db.deleteScan(scanUuid);
    await refreshCounters();
  }

  Future<void> refreshCounters() async {
    pendingCount = await db.countPending();
    failedCount = await db.countFailed();
    podPendingCount = await db.countPodPending();
    notifyListeners();
  }

  // ---------------------------------------------------------------- internals --

  void _scheduleRetry() {
    _retryTimer?.cancel();
    final seconds = AppConfig.retryBackoffSeconds[
        math.min(_retryIndex, AppConfig.retryBackoffSeconds.length - 1)];
    _retryIndex = math.min(_retryIndex + 1, AppConfig.retryBackoffSeconds.length - 1);
    _retryTimer = Timer(Duration(seconds: seconds), () {
      if (_online && hasPending) flush();
    });
  }

  void _cancelRetry() {
    _retryTimer?.cancel();
    _retryTimer = null;
    _retryIndex = 0;
  }

  Future<String?> _storePodFile(
    String scanUuid,
    String kind,
    Uint8List bytes,
  ) async {
    try {
      final dir = await getApplicationSupportDirectory();
      final podDir = Directory(p.join(dir.path, 'pod_queue'));
      if (!await podDir.exists()) {
        await podDir.create(recursive: true);
      }
      final extension = kind == 'signature' ? 'png' : 'jpg';
      final file = File(
        p.join(podDir.path, '${kind}_${scanUuid}_${DateTime.now().millisecondsSinceEpoch}.$extension'),
      );
      await file.writeAsBytes(bytes, flush: true);
      return file.path;
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    _autoTimer?.cancel();
    _retryTimer?.cancel();
    super.dispose();
  }
}
