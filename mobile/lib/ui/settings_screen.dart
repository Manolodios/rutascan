import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/config.dart';
import '../core/theme.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../data/repository.dart';
import '../data/session_store.dart';
import '../data/sync_engine.dart';
import 'login_screen.dart';
import 'widgets.dart';

/// Account, license, device and server information + logout.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
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
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _checking = false;

  Future<void> _refreshLicense() async {
    setState(() => _checking = true);
    try {
      final heartbeat = await widget.repository.sendHeartbeat();
      if (!mounted) return;
      _snack(
        'Licencia ${heartbeat.license.subscriptionStatus} · '
        '${heartbeat.license.daysRemaining} días restantes',
        ok: true,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      _snack(e.detail, ok: false);
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  void _snack(String message, {required bool ok}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ok ? AppColors.success : AppColors.danger,
      ),
    );
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text(
          '¿Cerrar sesión en este dispositivo? Los escaneos sin sincronizar '
          'permanecen en la cola local.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await widget.session.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => LoginScreen(
          session: widget.session,
          api: widget.api,
          repository: widget.repository,
          sync: widget.sync,
        ),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final license = session.cachedLicense;
    final fmt = DateFormat('dd/MM/yyyy HH:mm');

    return ListView(
      children: [
        SectionCard(
          title: 'Usuario',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('Nombre', session.user?.fullName ?? '—'),
              _row('Cédula', session.user?.cedula ?? '—'),
              _row('Rol', session.user?.role ?? '—'),
              _row('Empresa', session.companyName ?? '—'),
            ],
          ),
        ),
        SectionCard(
          title: 'Licencia',
          trailing: _checking
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('Clave', session.licenseKey ?? '—'),
              if (license != null) ...[
                _row('Estado', license.subscriptionStatus, highlight: true),
                _row('Vence', license.expirationDate),
                _row('Días restantes', '${license.daysRemaining}'),
                _row('Dispositivos',
                    '${license.activeDevices} de ${license.maxTrucks}'),
              ] else
                const Text('Sin datos de licencia en caché.'),
              _row(
                'Última validación',
                session.lastLicenseCheckAt != null
                    ? fmt.format(session.lastLicenseCheckAt!.toLocal())
                    : '—',
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _checking ? null : _refreshLicense,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Validar licencia ahora'),
                ),
              ),
            ],
          ),
        ),
        SectionCard(
          title: 'Dispositivo',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('ID de dispositivo', session.deviceUuid ?? '—'),
              _row('Versión de app', AppConfig.appVersion),
              _row('Servidor', AppConfig.apiBaseUrl),
            ],
          ),
        ),
        SectionCard(
          title: 'Sincronización',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('Estado', widget.sync.online ? 'En línea' : 'Offline'),
              _row('Pendientes', '${widget.sync.pendingCount}'),
              _row('Rechazados', '${widget.sync.failedCount}'),
              _row('Evidencias por subir', '${widget.sync.podPendingCount}'),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
            ),
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            label: const Text('CERRAR SESIÓN'),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _row(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: Colors.black54),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: highlight ? FontWeight.w700 : FontWeight.w500,
                color: highlight ? AppColors.success : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
