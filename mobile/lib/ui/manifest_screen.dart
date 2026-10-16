import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../data/models.dart';
import '../data/repository.dart';
import '../data/session_store.dart';
import 'widgets.dart';

/// Today's route: per-item delivery status, cached for offline use.
class ManifestScreen extends StatefulWidget {
  const ManifestScreen({
    super.key,
    required this.session,
    required this.repository,
  });

  final SessionStore session;
  final Repository repository;

  @override
  State<ManifestScreen> createState() => _ManifestScreenState();
}

class _ManifestScreenState extends State<ManifestScreen> {
  Future<ManifestData>? _future;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.fetchManifest();
  }

  void _load() {
    setState(() => _future = widget.repository.fetchManifest());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ManifestData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final manifest = snapshot.data;
        if (manifest == null) {
          return _ErrorState(onRetry: _load);
        }
        if (!manifest.hasRoute) {
          return RefreshIndicator(
            onRefresh: () async => _load(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 80),
                const Icon(Icons.inbox_outlined, size: 64, color: Colors.black26),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    manifest.message ?? 'No tiene ruta asignada para hoy.',
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ],
            ),
          );
        }

        final items = [...manifest.items]..sort((a, b) {
            if (a.isPending == b.isPending) return 0;
            return a.isPending ? -1 : 1;
          });

        return RefreshIndicator(
          onRefresh: () async => _load(),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SectionCard(
                title: 'Ruta de hoy · ${manifest.truckPlate ?? ''}',
                trailing: manifest.fromCache
                    ? const StatusChip(
                        label: 'SIN CONEXIÓN', color: AppColors.warning)
                    : null,
                child: Text(
                  '${manifest.deliveredUnits}/${manifest.assignedUnits} unidades · '
                  '${manifest.pendingUnits} pendientes · ${manifest.rejectedLines} rechazos',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
              const SizedBox(height: 4),
              for (final item in items) _ManifestTile(item: item),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }
}

class _ManifestTile extends StatelessWidget {
  const _ManifestTile({required this.item});

  final ManifestItem item;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd/MM HH:mm');
    String? lastScan;
    final raw = item.lastScanAt;
    if (raw != null) {
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) lastScan = fmt.format(parsed.toLocal());
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: item.isPending
              ? AppColors.warning.withAlpha(30)
              : item.isDelivered
                  ? AppColors.success.withAlpha(30)
                  : AppColors.danger.withAlpha(30),
          child: Icon(
            item.isPending
                ? Icons.inventory_2_outlined
                : item.isDelivered
                    ? Icons.check
                    : Icons.close,
            color: item.isPending
                ? AppColors.warning
                : item.isDelivered
                    ? AppColors.success
                    : AppColors.danger,
          ),
        ),
        title: Text(
          item.product.description,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${item.product.barcodeQr} · ${item.product.unit}'),
            const SizedBox(height: 2),
            Text(
              'Entregado ${item.deliveredQuantity} de ${item.assignedQuantity}'
              '${item.returnRequired ? ' · requiere devolución' : ''}'
              '${lastScan != null ? ' · último: $lastScan' : ''}',
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
        ),
        trailing: StatusChip.itemStatus(item.status),
        isThreeLine: true,
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off, size: 56, color: AppColors.warning),
          const SizedBox(height: 12),
          const Text('No hay ruta disponible sin conexión.'),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Reintentar'),
          ),
        ],
      ),
    );
  }
}
