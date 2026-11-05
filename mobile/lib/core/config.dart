/// Static configuration compiled into the app.
///
/// Defaults to the production backend so an installed APK works on a real
/// phone without any extra setup. Override at build time for local/LAN work:
///   flutter build apk --dart-define=API_BASE_URL=http://192.168.1.139:8000
///
/// The in-app "Dirección del servidor" dialog can also change it at runtime.
class AppConfig {
  AppConfig._();

  /// Base URL of the RutaScan backend (no trailing slash).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://rutascan.onrender.com',
  );

  /// Sent as X-App-Version; keep in sync with pubspec `version`.
  static const String appVersion = '1.0.0';

  /// HTTP timeouts.
  static const Duration requestTimeout = Duration(seconds: 20);
  static const Duration uploadTimeout = Duration(seconds: 60);

  /// Queue retry backoff ladder (seconds).
  static const List<int> retryBackoffSeconds = [15, 30, 60, 120, 300];

  /// Automatic queue flush cadence while online.
  static const Duration autoFlushInterval = Duration(seconds: 25);

  /// Show a "signature" prompt after each successful delivery.
  static const bool promptSignatureAfterDelivery = false;
}
