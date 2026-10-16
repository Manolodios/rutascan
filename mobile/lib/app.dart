import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'data/api_client.dart';
import 'data/repository.dart';
import 'data/session_store.dart';
import 'data/sync_engine.dart';
import 'ui/splash_screen.dart';

class RutaScanApp extends StatelessWidget {
  const RutaScanApp({
    super.key,
    required this.session,
    required this.api,
    required this.repository,
    required this.sync,
  });

  final SessionStore session;
  final ApiClient api;
  final Repository repository;
  final SyncEngine sync;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RutaScan',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: SplashScreen(
        session: session,
        api: api,
        repository: repository,
        sync: sync,
      ),
    );
  }
}
