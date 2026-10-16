import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../core/config.dart';
import 'models.dart';
import 'session_store.dart';

/// Thin HTTP wrapper around the RutaScan backend.
///
/// * always sends X-License-Key / X-Device-UUID / X-Device-Platform / X-App-Version
/// * attaches `Authorization: Bearer <access>` to authenticated calls
/// * transparently refreshes an expired access token once (401 -> refresh -> retry)
/// * translates errors into [ApiException] with `statusCode` + `code`
class ApiClient {
  ApiClient(this.session);

  final SessionStore session;
  final http.Client _client = http.Client();

  Uri _uri(String path) => Uri.parse('${AppConfig.apiBaseUrl}$path');

  Map<String, String> _headers({bool auth = true, bool json = true}) {
    final headers = <String, String>{
      'X-License-Key': session.licenseKey ?? '',
      'X-Device-UUID': session.deviceUuid ?? '',
      'X-Device-Platform': Platform.isAndroid
          ? 'android'
          : Platform.isIOS
              ? 'ios'
              : 'other',
      'X-App-Version': AppConfig.appVersion,
    };
    if (json) headers['Content-Type'] = 'application/json';
    if (auth && session.accessToken != null) {
      headers['Authorization'] = 'Bearer ${session.accessToken}';
    }
    return headers;
  }

  // -------------------------------------------------------------------- api --

  Future<Map<String, dynamic>> login({
    required String cedula,
    required String pin,
  }) =>
      _request(
        'POST',
        '/auth/login',
        withAuth: false,
        body: {
          'cedula': cedula,
          'pin': pin,
          'device_uuid': session.deviceUuid,
          'platform': Platform.isAndroid
              ? 'android'
              : Platform.isIOS
                  ? 'ios'
                  : 'other',
          'app_version': AppConfig.appVersion,
        },
      );

  Future<Map<String, dynamic>> getJson(String path) =>
      _authed(() => _request('GET', path));

  Future<Map<String, dynamic>> postJson(
    String path, [
    Map<String, dynamic>? body,
  ]) =>
      _authed(
        () => _request(
          'POST',
          path,
          body: body ?? const <String, dynamic>{},
        ),
      );

  /// Multipart upload of a PoD artifact (signature PNG / evidence JPEG).
  Future<Map<String, dynamic>> uploadPod({
    required Uint8List bytes,
    required String kind,
    String? filename,
  }) async {
    Future<http.Response> send() async {
      final request = http.MultipartRequest('POST', _uri('/api/v1/mobile/pod'));
      request.headers.addAll(_headers(auth: true, json: false));
      request.fields['kind'] = kind;
      final name =
          filename ?? (kind == 'signature' ? 'signature.png' : 'evidence.jpg');
      final mediaType = name.toLowerCase().endsWith('.png')
          ? MediaType('image', 'png')
          : MediaType('image', 'jpeg');
      request.files.add(
        http.MultipartFile.fromBytes('file', bytes,
            filename: name, contentType: mediaType),
      );
      final streamed = await request.send().timeout(AppConfig.uploadTimeout);
      return http.Response.fromStream(streamed);
    }

    try {
      var response = await send();
      if (response.statusCode == 401 && session.refreshToken != null) {
        if (await _refreshTokens()) response = await send();
      }
      return _decode(response);
    } on TimeoutException {
      throw ApiException.network('La carga de evidencia tardó demasiado.');
    } on SocketException catch (e) {
      throw ApiException.network(_networkMessage(e));
    } on http.ClientException catch (e) {
      throw ApiException.network(_networkMessage(e));
    }
  }

  // ---------------------------------------------------------------- internals --

  Future<Map<String, dynamic>> _authed(
    Future<Map<String, dynamic>> Function() run,
  ) async {
    try {
      return await run();
    } on ApiException catch (e) {
      if (e.isAuth && session.refreshToken != null) {
        if (await _refreshTokens()) return await run();
      }
      rethrow;
    }
  }

  Future<bool> _refreshTokens() async {
    final refreshToken = session.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return false;
    try {
      final response = await _request(
        'POST',
        '/auth/refresh',
        body: {'refresh_token': refreshToken},
        withAuth: false,
      );
      await session.updateTokens(response);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool withAuth = true,
  }) async {
    final uri = _uri(path);
    http.Response response;
    try {
      if (method == 'GET') {
        response = await _client
            .get(uri, headers: _headers(auth: withAuth))
            .timeout(AppConfig.requestTimeout);
      } else {
        response = await _client
            .post(
              uri,
              headers: _headers(auth: withAuth),
              body: jsonEncode(body ?? const <String, dynamic>{}),
            )
            .timeout(AppConfig.requestTimeout);
      }
    } on TimeoutException {
      throw ApiException.network('El servidor no respondió a tiempo.');
    } on SocketException catch (e) {
      throw ApiException.network(_networkMessage(e));
    } on http.ClientException catch (e) {
      throw ApiException.network(_networkMessage(e));
    }
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final status = response.statusCode;
    Map<String, dynamic>? payload;
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) payload = decoded;
      } catch (_) {
        // Non-JSON body (e.g. reverse proxy error page).
      }
    }

    if (status >= 200 && status < 300) {
      return payload ?? <String, dynamic>{};
    }

    final detail = payload?['detail'];
    final code = payload?['code'] as String?;
    String message;
    if (detail is String && detail.isNotEmpty) {
      message = detail;
    } else if (detail is List && detail.isNotEmpty) {
      final first = detail.first;
      message = first is Map<String, dynamic>
          ? ((first['msg'] ?? 'Datos inválidos.') as String)
          : 'Datos inválidos.';
    } else {
      message = 'Error del servidor ($status).';
    }

    throw ApiException(
      statusCode: status,
      code: code ?? 'HTTP_$status',
      detail: message,
      retryAfterSeconds: (payload?['retry_after'] as num?)?.toInt(),
    );
  }

  String _networkMessage(Object error) {
    if (error is SocketException) {
      return 'Sin conexión con el servidor.';
    }
    return 'No se pudo contactar al servidor.';
  }
}
