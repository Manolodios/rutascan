import 'package:flutter_test/flutter_test.dart';
import 'package:rutascan/core/config.dart';
import 'package:rutascan/data/session_store.dart';

void main() {
  test('la URL del backend no lleva barra final', () {
    expect(AppConfig.apiBaseUrl.endsWith('/'), isFalse);
    expect(AppConfig.apiBaseUrl, startsWith('http'));
  });

  test('la escalera de reintentos crece y termina en 5 minutos', () {
    const ladder = AppConfig.retryBackoffSeconds;
    expect(ladder, isNotEmpty);
    for (var i = 1; i < ladder.length; i++) {
      expect(ladder[i], greaterThan(ladder[i - 1]));
    }
    expect(ladder.last, 300);
  });

  group('dirección del servidor editable', () {
    test('vacío vuelve al valor de fábrica', () {
      expect(SessionStore.normalizeServerUrl(null), isNull);
      expect(SessionStore.normalizeServerUrl(''), isNull);
      expect(SessionStore.normalizeServerUrl('   '), isNull);
    });

    test('agrega el esquema cuando falta', () {
      expect(
        SessionStore.normalizeServerUrl('192.168.1.139:8000'),
        'http://192.168.1.139:8000',
      );
      expect(
        SessionStore.normalizeServerUrl('servidor.miempresa.com'),
        'http://servidor.miempresa.com',
      );
    });

    test('a una IP sola le pone el puerto 8000', () {
      expect(
        SessionStore.normalizeServerUrl('192.168.1.139'),
        'http://192.168.1.139:8000',
      );
    });

    test('quita las barras finales', () {
      expect(
        SessionStore.normalizeServerUrl('https://rutascan.miempresa.com/'),
        'https://rutascan.miempresa.com',
      );
      expect(
        SessionStore.normalizeServerUrl('http://10.0.0.5:8000///'),
        'http://10.0.0.5:8000',
      );
    });

    test('respeta el esquema https', () {
      expect(
        SessionStore.normalizeServerUrl('https://api.miempresa.com'),
        'https://api.miempresa.com',
      );
    });

    test('rechaza textos que no son direcciones', () {
      expect(SessionStore.normalizeServerUrl('no es una url'), isNull);
      expect(SessionStore.normalizeServerUrl('http://'), isNull);
    });

    test('sin dirección guardada usa la de fábrica', () {
      expect(SessionStore.instance.effectiveServerUrl, AppConfig.apiBaseUrl);
    });
  });
}
