import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../data/repository.dart';
import '../data/session_store.dart';
import '../data/sync_engine.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Boot gate:
///  1. no session            -> Login
///  2. valid offline permit  -> Home (works with zero signal)
///  3. otherwise             -> online heartbeat; on failure show the blocked
///                              screen with retry / logout actions.
class SplashScreen extends StatefulWidget {
  const SplashScreen({
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
  State<SplashScreen> createState() => _SplashScreenState();
}

enum _BlockReason { none, offlineNoPermit, license, sessionExpired }

class _SplashScreenState extends State<SplashScreen> {
  _BlockReason _blocked = _BlockReason.none;
  String _blockedMessage = '';
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _decide(initial: true);
  }

  Future<void> _decide({bool initial = false}) async {
    if (!initial) {
      setState(() {
        _checking = true;
        _blocked = _BlockReason.none;
      });
    }

    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    if (!widget.session.isLoggedIn) {
      _goTo(LoginScreen(
        session: widget.session,
        api: widget.api,
        repository: widget.repository,
        sync: widget.sync,
      ));
      return;
    }

    if (widget.session.offlinePermitValid) {
      _goHome();
      return;
    }

    try {
      await widget.repository.sendHeartbeat();
      if (!mounted) return;
      _goHome();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _checking = false;
        if (e.isAuth) {
          _blocked = _BlockReason.sessionExpired;
          _blockedMessage = 'La sesión venció. Inicie sesión nuevamente.';
        } else if (e.isNetwork) {
          _blocked = _BlockReason.offlineNoPermit;
          _blockedMessage =
              'Sin conexión y sin permiso offline vigente. Conéctese a internet para validar la licencia.';
        } else {
          _blocked = _BlockReason.license;
          _blockedMessage = e.detail;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _checking = false;
        _blocked = _BlockReason.sessionExpired;
        _blockedMessage = 'Error inesperado al validar la sesión: $e';
      });
    }
  }

  void _goHome() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => HomeScreen(
          session: widget.session,
          api: widget.api,
          repository: widget.repository,
          sync: widget.sync,
        ),
      ),
    );
  }

  void _goTo(Widget screen) {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => screen),
    );
  }

  Future<void> _logout() async {
    await widget.session.logout();
    if (!mounted) return;
    _goTo(LoginScreen(
      session: widget.session,
      api: widget.api,
      repository: widget.repository,
      sync: widget.sync,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.navy,
      body: Center(
        child: _blocked == _BlockReason.none
            ? Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.qr_code_scanner,
                      size: 92, color: Colors.white),
                  const SizedBox(height: 12),
                  const Text(
                    'RutaScan',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (_checking)
                    const CircularProgressIndicator(color: Colors.white70),
                ],
              )
            : Card(
                margin: const EdgeInsets.all(24),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _blocked == _BlockReason.license
                            ? Icons.verified_user
                            : _blocked == _BlockReason.sessionExpired
                                ? Icons.lock_clock
                                : Icons.wifi_off,
                        size: 56,
                        color: _blocked == _BlockReason.license
                            ? AppColors.danger
                            : AppColors.warning,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _blocked == _BlockReason.license
                            ? 'Licencia no disponible'
                            : _blocked == _BlockReason.sessionExpired
                                ? 'Sesión vencida'
                                : 'Sin conexión',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _blockedMessage,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 14),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _checking ? null : () => _decide(),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Reintentar'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _logout,
                          icon: const Icon(Icons.logout),
                          label: const Text('Cerrar sesión'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}
