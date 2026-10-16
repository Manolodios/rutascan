import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../data/repository.dart';
import '../data/session_store.dart';
import '../data/sync_engine.dart';
import 'home_screen.dart';
import 'server_url_dialog.dart';

/// Cedula + 4-digit PIN login. The license key is remembered between logins.
class LoginScreen extends StatefulWidget {
  const LoginScreen({
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
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final TextEditingController _licenseCtrl;
  final _cedulaCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _licenseCtrl =
        TextEditingController(text: widget.session.licenseKey ?? '');
  }

  @override
  void dispose() {
    _licenseCtrl.dispose();
    _cedulaCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final license = _licenseCtrl.text.trim().toUpperCase();
    final cedula = _cedulaCtrl.text.trim();
    final pin = _pinCtrl.text.trim();

    if (license.isEmpty) {
      setState(() => _error = 'Ingrese la clave de licencia.');
      return;
    }
    if (cedula.isEmpty) {
      setState(() => _error = 'Ingrese la cédula.');
      return;
    }
    if (pin.length != 4) {
      setState(() => _error = 'El PIN debe tener 4 dígitos.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await widget.repository.login(
        licenseKey: license,
        cedula: cedula,
        pin: pin,
      );
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
    } on ApiException catch (e) {
      var message = e.detail;
      if (e.isNetwork) {
        message = 'Sin conexión con el servidor. Verifique la red y la dirección del servidor.';
      } else if (e.code == 'PIN_LOCKOUT' && e.retryAfterSeconds != null) {
        message =
            'Demasiados intentos fallidos. Espere ${e.retryAfterSeconds} segundos.';
      } else if (e.isDeviceLimit) {
        message =
            'Límite de dispositivos de la licencia alcanzado. Contacte al administrador.';
      }
      setState(() => _error = message);
    } catch (e) {
      setState(() => _error = 'Error inesperado: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _editServer() async {
    final changed = await showServerUrlDialog(context, widget.session);
    if (changed && mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.qr_code_scanner,
                      size: 74, color: AppColors.navy),
                  const SizedBox(height: 4),
                  const Text(
                    'RutaScan',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const Text(
                    'Control de entregas · Bodega y conductor',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: Colors.black54),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _licenseCtrl,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Clave de licencia',
                      hintText: 'RUTA-XXXX-XXXX',
                      prefixIcon: Icon(Icons.verified_user_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _cedulaCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9A-Za-z\-]')),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Cédula',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _pinCtrl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 4,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(
                      labelText: 'PIN (4 dígitos)',
                      counterText: '',
                      prefixIcon: Icon(Icons.password),
                    ),
                    onSubmitted: (_) => _loading ? null : _submit(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withAlpha(24),
                        borderRadius: BorderRadius.circular(10),
                        border:
                            Border.all(color: AppColors.danger.withAlpha(90)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppColors.danger),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                color: AppColors.danger,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        : const Text('INICIAR SESIÓN'),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Dispositivo: ${widget.session.deviceUuid ?? '—'}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11, color: Colors.black38),
                  ),
                  TextButton.icon(
                    onPressed: _editServer,
                    style: TextButton.styleFrom(foregroundColor: Colors.black45),
                    icon: const Icon(Icons.dns_outlined, size: 16),
                    label: Text(
                      'Servidor: ${widget.session.effectiveServerUrl}',
                      style: const TextStyle(fontSize: 11.5),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
