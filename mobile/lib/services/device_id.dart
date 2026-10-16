import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Stable per-install device identity used for license binding and the
/// server-side device slot counter.
///
/// The UUID is generated once and kept in secure storage; the human-readable
/// device model is derived from device_info_plus for the admin panel.
class DeviceIdService {
  DeviceIdService._();

  static const _kDeviceUuid = 'rs_device_uuid';
  static final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static Future<String> getOrCreate() async {
    try {
      final existing = await _storage.read(key: _kDeviceUuid);
      if (existing != null && existing.length >= 8) return existing;
    } catch (_) {
      // fall through: generate a fresh id
    }
    final uuid = const Uuid().v4();
    try {
      await _storage.write(key: _kDeviceUuid, value: uuid);
    } catch (_) {
      // If secure storage is unavailable, keep the id for this run only.
    }
    return uuid;
  }

  /// e.g. "Samsung SM-A125M" / "Apple iPhone14,3" (best effort).
  static Future<String> describe() async {
    try {
      final plugin = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final info = await plugin.androidInfo;
        return '${info.manufacturer} ${info.model}';
      }
      if (Platform.isIOS) {
        final info = await plugin.iosInfo;
        return '${info.name} (${info.utsname.machine})';
      }
    } catch (_) {
      // ignore
    }
    return 'Dispositivo desconocido';
  }
}
