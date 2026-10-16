import 'dart:convert';

import 'api_client.dart';
import 'local_db.dart';
import 'models.dart';
import 'session_store.dart';

/// High-level operations used by the UI: login, manifest and heartbeat.
class Repository {
  Repository({
    required this.api,
    required this.session,
    required this.db,
  });

  final ApiClient api;
  final SessionStore session;
  final LocalDb db;

  Future<void> login({
    required String licenseKey,
    required String cedula,
    required String pin,
  }) async {
    await session.setLicenseKey(licenseKey);
    final response = await api.login(cedula: cedula, pin: pin);
    await session.saveLogin(response);
  }

  /// Today's manifest. Falls back to the last cached copy when offline.
  Future<ManifestData> fetchManifest() async {
    try {
      final response = await api.getJson('/api/v1/mobile/routes/today');
      await db.cacheManifest(jsonEncode(response));
      return ManifestData.fromJson(response);
    } on ApiException catch (e) {
      if (e.isNetwork) {
        final cached = await db.cachedManifest();
        final data = ManifestData.tryParse(cached);
        if (data != null) return data;
      }
      rethrow;
    }
  }

  /// Online heartbeat: renews the 3-day offline grace permit and refreshes
  /// the cached license snapshot.
  Future<HeartbeatResult> sendHeartbeat() async {
    final response = await api.postJson('/api/v1/mobile/heartbeat');
    await session.saveHeartbeat(response);
    return HeartbeatResult.fromJson(response);
  }
}
