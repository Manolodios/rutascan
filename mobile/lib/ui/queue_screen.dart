import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../data/models.dart';
import '../data/session_store.dart';
import '../data/sync_engine.dart';
import 'widgets.dart';

/// Offline synchronization queue: pending scans, rejected items and PoD files.
class QueueScreen extends StatefulWidget {
  const QueueScreen({super.key, required this.sync, required this.session});

  final SyncEngine sync;
  final SessionStore session;

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  Future<List<PendingScan>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
    widget.sync.addListener(_onSyncChanged);
  }

  @override
  void dispose() {
    widget.sync.removeListener(_onSyncChanged);
    super.dispose();
  }

  void _onSyncChanged() {
    if (!mounted) return;
    setState(() => _future = _load());
  }

  Future<List<PendingScan>> _load() =>
      widget.sync.db.pendingScans(includeFailed: true);

  @override
  Widget build(BuildContext context) {
    final sync = widget.sync;
    final fmt = DateFormat('dd/MM HH:mm');
    return RefreshIndicator(
      onRefresh: () async {
        await sync.refreshCounters();
        setState(() => _future = _load());
        await sync.flush(manual: true);
      },
      child: FutureBuilder<List<PendingScan>>(
        future: _future,
        builder: (context, snapshot) {
          final scans = snapshot.data ?? const <PendingScan>[];
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SectionCard(
                title: 'Estado de sincronización',
                trailing: StatusChip(
                  label: sync.online ? 'EN LÍNEA' : 'OFFLINE',
                  color: sync.online ? AppColors.success : AppColors.warning,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${sync.pendingCount} escaneos pendientes · '
                      '${sync.failedCount} rechazados · '
                      '${sync.podPendingCount} evidencias por subir',
                      style: const TextStyle(fontSize: 13),
                    ),
                    if (sync.lastSyncAt != null)
                      Text(
                        'Última sincronización: '
                        '${fmt.format(sync.lastSyncAt!.toLocal())}',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.muted(context),
                        ),
                      ),
                    if (sync.lastSyncError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          sync.lastSyncError!,
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.danger),
                        ),
                      ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: sync.syncing
                            ? null
                            : () => sync.flush(manual: true),
                        icon: sync.syncing
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.sync),
                        label: Text(
                          sync.syncing ? 'SINCRONIZANDO…' : 'SINCRONIZAR AHORA',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (scans.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    children: [
                      const Icon(Icons.cloud_done,
                          size: 56, color: AppColors.success),
                      const SizedBox(height: 8),
                      Text(
                        'Todo sincronizado. No hay escaneos pendientes.',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
              for (final scan in scans) _ScanTile(scan: scan, sync: sync),
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }
}

class _ScanTile extends StatelessWidget {
  const _ScanTile({required this.scan, required this.sync});

  final PendingScan scan;
  final SyncEngine sync;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd/MM HH:mm');
    final created =
        DateTime.tryParse(scan.createdAt)?.toLocal() ?? DateTime.now();
    final actionLabel = switch (scan.action) {
      'LOAD' => 'Carga',
      'REJECT' => 'Rechazo',
      _ => 'Entrega',
    };
    final actionColor = switch (scan.action) {
      'LOAD' => AppColors.loadGreen,
      'REJECT' => AppColors.rejectOrange,
      _ => AppColors.deliverBlue,
    };

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: scan.failed
              ? AppColors.danger.withAlpha(28)
              : actionColor.withAlpha(28),
          child: Icon(
            scan.failed ? Icons.error_outline : Icons.qr_code,
            color: scan.failed ? AppColors.danger : actionColor,
          ),
        ),
        title: Text(
          scan.qrCode,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$actionLabel · ${fmt.format(created)}'),
            if (scan.failed && scan.lastError != null)
              Text(
                scan.lastError!,
                style: const TextStyle(fontSize: 12, color: AppColors.danger),
              ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (scan.failed)
              IconButton(
                tooltip: 'Reintentar',
                icon: const Icon(Icons.refresh),
                onPressed: () => sync.retryFailedScan(scan.scanUuid),
              ),
            IconButton(
              tooltip: 'Eliminar',
              icon: const Icon(Icons.delete_outline),
              onPressed: () => _confirmDelete(context),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Eliminar escaneo'),
        content: Text(
          '¿Eliminar el escaneo de "${scan.qrCode}" de la cola local? '
          'Esta acción no se puede deshacer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await sync.deletePendingScan(scan.scanUuid);
    }
  }
}
