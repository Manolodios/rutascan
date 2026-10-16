import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

/// Persistent session: license key, device UUID, JWT pair and the cached
/// offline "grace" permit (3 days without connectivity).
///
/// Stored in flutter_secure_storage (Android Keystore / iOS Keychain).
class SessionStore {
  SessionStore._();

  static final SessionStore instance = SessionStore._();

  static const _kLicenseKey = 'rs_license_key';
  static const _kDeviceUuid = 'rs_device_uuid';
  static const _kAccessToken = 'rs_access_token';
  static const _kRefreshToken = 'rs_refresh_token';
  static const _kAccessExpiresAt = 'rs_access_expires_at';
  static const _kUserJson = 'rs_user_json';
  static const _kCompanyName = 'rs_company_name';
  static const _kLicenseStatus = 'rs_license_status';
  static const _kLicenseJson = 'rs_license_json';
  static const _kGraceToken = 'rs_grace_token';
  static const _kGraceExpiresAt = 'rs_grace_expires_at';
  static const _kLastLicenseCheck = 'rs_last_license_check';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String? licenseKey;
  String? deviceUuid;
  String? accessToken;
  String? refreshToken;
  DateTime? accessExpiresAt;
  StoredUser? user;
  String? companyName;
  String? licenseStatus; // ACTIVE | SUSPENDED
  String? licenseJson;
  String? graceToken;
  DateTime? graceExpiresAt;
  DateTime? lastLicenseCheckAt;

  bool get isLoggedIn => accessToken != null && user != null;

  /// Whether the cached 3-day offline permit is still valid.
  bool get offlinePermitValid {
    final expires = graceExpiresAt;
    return licenseStatus == 'ACTIVE' &&
        expires != null &&
        DateTime.now().toUtc().isBefore(expires.toUtc());
  }

  LicenseInfo? get cachedLicense {
    final raw = licenseJson;
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return LicenseInfo.fromJson(decoded);
    } catch (_) {
      // ignore
    }
    return null;
  }

  Future<void> load() async {
    licenseKey = await _read(_kLicenseKey);
    deviceUuid = await _read(_kDeviceUuid);
    accessToken = await _read(_kAccessToken);
    refreshToken = await _read(_kRefreshToken);
    accessExpiresAt = _parseDate(await _read(_kAccessExpiresAt));
    user = StoredUser.tryParse(await _read(_kUserJson));
    companyName = await _read(_kCompanyName);
    licenseStatus = await _read(_kLicenseStatus);
    licenseJson = await _read(_kLicenseJson);
    graceToken = await _read(_kGraceToken);
    graceExpiresAt = _parseDate(await _read(_kGraceExpiresAt));
    lastLicenseCheckAt = _parseDate(await _read(_kLastLicenseCheck));
  }

  Future<void> setLicenseKey(String value) async {
    licenseKey = value.trim().toUpperCase();
    await _write(_kLicenseKey, licenseKey);
  }

  Future<void> setDeviceUuid(String value) async {
    deviceUuid = value;
    await _write(_kDeviceUuid, value);
  }

  /// Applies the body of POST /auth/login (a TokenPair).
  Future<void> saveLogin(Map<String, dynamic> response) async {
    await _applyTokenPair(response);
    final userRaw = response['user'];
    if (userRaw is Map<String, dynamic>) {
      user = StoredUser.fromJson(userRaw);
      await _write(_kUserJson, user!.toJsonString());
    }
    final companyRaw = response['company'];
    if (companyRaw is Map<String, dynamic>) {
      companyName = companyRaw['name'] as String?;
      await _write(_kCompanyName, companyName);
    }
  }

  /// Applies the body of POST /auth/refresh (rotation: new token pair).
  Future<void> updateTokens(Map<String, dynamic> response) async {
    await _applyTokenPair(response);
    final licRaw = response['license'];
    if (licRaw is Map<String, dynamic>) {
      licenseStatus = licRaw['subscription_status'] as String?;
      licenseJson = jsonEncode(licRaw);
      lastLicenseCheckAt = DateTime.now().toUtc();
      await _write(_kLicenseStatus, licenseStatus);
      await _write(_kLicenseJson, licenseJson);
      await _write(_kLastLicenseCheck, lastLicenseCheckAt!.toIso8601String());
    }
  }

  /// Applies the body of POST /api/v1/mobile/heartbeat.
  Future<void> saveHeartbeat(Map<String, dynamic> response) async {
    final licRaw = response['license'];
    if (licRaw is Map<String, dynamic>) {
      licenseStatus = licRaw['subscription_status'] as String?;
      licenseJson = jsonEncode(licRaw);
      await _write(_kLicenseStatus, licenseStatus);
      await _write(_kLicenseJson, licenseJson);
    }
    final token = response['grace_token'] as String?;
    final expiresAt = response['grace_expires_at'] as String?;
    if (token != null && token.isNotEmpty) {
      graceToken = token;
      graceExpiresAt = DateTime.tryParse(expiresAt ?? '')?.toUtc();
      await _write(_kGraceToken, token);
      if (graceExpiresAt != null) {
        await _write(_kGraceExpiresAt, graceExpiresAt!.toIso8601String());
      }
    }
    lastLicenseCheckAt = DateTime.now().toUtc();
    await _write(_kLastLicenseCheck, lastLicenseCheckAt!.toIso8601String());
  }

  /// Clears the authenticated session but keeps license key + device UUID so
  /// the next login is one PIN away.
  Future<void> logout() async {
    accessToken = null;
    refreshToken = null;
    accessExpiresAt = null;
    user = null;
    graceToken = null;
    graceExpiresAt = null;
    licenseStatus = null;
    licenseJson = null;
    await _delete(_kAccessToken);
    await _delete(_kRefreshToken);
    await _delete(_kAccessExpiresAt);
    await _delete(_kUserJson);
    await _delete(_kGraceToken);
    await _delete(_kGraceExpiresAt);
    await _delete(_kLicenseStatus);
    await _delete(_kLicenseJson);
  }

  Future<void> _applyTokenPair(Map<String, dynamic> response) async {
    accessToken = response['access_token'] as String?;
    refreshToken = response['refresh_token'] as String?;
    final expiresIn = ((response['expires_in'] as num?) ?? 3600).toInt();
    accessExpiresAt = DateTime.now().toUtc().add(Duration(seconds: expiresIn));
    await _write(_kAccessToken, accessToken);
    await _write(_kRefreshToken, refreshToken);
    await _write(_kAccessExpiresAt, accessExpiresAt!.toIso8601String());

    final grace = response['grace_token'] as String?;
    final graceExp = response['grace_expires_at'] as String?;
    if (grace != null && grace.isNotEmpty) {
      graceToken = grace;
      graceExpiresAt = DateTime.tryParse(graceExp ?? '')?.toUtc();
      await _write(_kGraceToken, grace);
      if (graceExpiresAt != null) {
        await _write(_kGraceExpiresAt, graceExpiresAt!.toIso8601String());
      }
    }
    final licRaw = response['license'];
    if (licRaw is Map<String, dynamic>) {
      licenseStatus = licRaw['subscription_status'] as String?;
      licenseJson = jsonEncode(licRaw);
      await _write(_kLicenseStatus, licenseStatus);
      await _write(_kLicenseJson, licenseJson);
    }
    lastLicenseCheckAt = DateTime.now().toUtc();
    await _write(_kLastLicenseCheck, lastLicenseCheckAt!.toIso8601String());
  }

  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      return null;
    }
  }

  Future<void> _write(String key, String? value) async {
    try {
      if (value == null) {
        await _storage.delete(key: key);
      } else {
        await _storage.write(key: key, value: value);
      }
    } catch (_) {
      // Secure storage hiccups must never crash a scan.
    }
  }

  Future<void> _delete(String key) => _write(key, null);

  static DateTime? _parseDate(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw)?.toUtc();
  }
}
