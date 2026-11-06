import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'core/theme_controller.dart';
import 'data/api_client.dart';
import 'data/local_db.dart';
import 'data/repository.dart';
import 'data/session_store.dart';
import 'data/sync_engine.dart';
import 'services/device_id.dart';
import 'services/feedback.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await initializeDateFormatting('es');
    final session = SessionStore.instance;
    await session.load();
    ThemeController.instance.hydrate(session.themeMode);
    await FeedbackService.instance.init();

    final deviceUuid = await DeviceIdService.getOrCreate();
    await session.setDeviceUuid(deviceUuid);

    final db = LocalDb.instance;
    final api = ApiClient(session);
    final repository = Repository(api: api, session: session, db: db);
    final sync = SyncEngine(api: api, db: db);
    await sync.start();

    runApp(
      RutaScanApp(
        session: session,
        api: api,
        repository: repository,
        sync: sync,
      ),
    );
  } catch (error) {
    runApp(_BootErrorApp(message: '$error'));
  }
}

/// Shown only when local initialization (secure storage / local DB) fails.
class _BootErrorApp extends StatelessWidget {
  const _BootErrorApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                const Text(
                  'No se pudo iniciar RutaScan',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(message, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                const Text('Reinicie la aplicación. Si persiste, contacte a soporte.'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
