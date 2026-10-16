import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../data/repository.dart';
import '../data/session_store.dart';
import '../data/sync_engine.dart';
import 'manifest_screen.dart';
import 'queue_screen.dart';
import 'scan_screen.dart';
import 'settings_screen.dart';
import 'widgets.dart';

/// Driver/warehouse shell: giant scan actions + manifest, queue and settings.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
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
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.sync,
      builder: (context, _) {
        final queueBadge = widget.sync.pendingCount + widget.sync.failedCount;
        return Scaffold(
          appBar: AppBar(
            title: const Text('RutaScan'),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Center(
                  child: Icon(
                    widget.sync.online ? Icons.wifi : Icons.wifi_off,
                    color: widget.sync.online ? Colors.greenAccent : Colors.orangeAccent,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
          body: IndexedStack(
            index: _tab,
            children: [
              _HomeTab(
                session: widget.session,
                repository: widget.repository,
                sync: widget.sync,
              ),
              ManifestScreen(
                session: widget.session,
                repository: widget.repository,
              ),
              QueueScreen(sync: widget.sync, session: widget.session),
              SettingsScreen(
                session: widget.session,
                api: widget.api,
                repository: widget.repository,
                sync: widget.sync,
              ),
            ],
          ),
          bottomNavigationBar: BottomNavigationBar(
            currentIndex: _tab,
            onTap: (index) => setState(() => _tab = index),
            type: BottomNavigationBarType.fixed,
            selectedItemColor: AppColors.primary,
            unselectedItemColor: Colors.black45,
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined),
                activeIcon: Icon(Icons.home),
                label: 'Inicio',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.list_alt_outlined),
                activeIcon: Icon(Icons.list_alt),
                label: 'Ruta',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: queueBadge > 0,
                  label: Text('$queueBadge'),
                  child: const Icon(Icons.sync_outlined),
                ),
                activeIcon: Badge(
                  isLabelVisible: queueBadge > 0,
                  label: Text('$queueBadge'),
                  child: const Icon(Icons.sync),
                ),
                label: 'Cola',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.settings_outlined),
                activeIcon: Icon(Icons.settings),
                label: 'Ajustes',
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HomeTab extends StatefulWidget {
  const _HomeTab({
    required this.session,
    required this.repository,
    required this.sync,
  });

  final SessionStore session;
  final Repository repository;
  final SyncEngine sync;

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  Future<ManifestData?> _manifestFuture = Future.value(null);

  @override
  void initState() {
    super.initState();
    _manifestFuture = _loadManifest();
  }

  Future<ManifestData?> _loadManifest() =>
      widget.repository.fetchManifest().then<ManifestData?>(
            (data) => data,
            onError: (Object e) => null, // banner shows the error separately
          );

  void _reload() {
    setState(() {
      _manifestFuture = _loadManifest();
    });
  }

  Future<void> _openScan(String action) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ScanScreen(
          action: action,
          repository: widget.repository,
          sync: widget.sync,
        ),
      ),
    );
    _reload();
  }

  String get _greeting {
    final user = widget.session.user;
    final name = user?.fullName ?? 'Conductor';
    return 'Hola, $name';
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        _reload();
        await widget.sync.flush(manual: true);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 8),
          SectionCard(
            title: _greeting,
            trailing: widget.session.companyName != null
                ? Text(
                    widget.session.companyName!,
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  )
                : null,
            child: _RouteSummary(future: _manifestFuture),
          ),
          _SyncStrip(sync: widget.sync),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GiantActionButton(
              label: 'CARGAR CAMIÓN',
              subtitle: 'Confirmar mercancía que sube al vehículo',
              icon: Icons.local_shipping,
              color: AppColors.loadGreen,
              onPressed: () => _openScan('LOAD'),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GiantActionButton(
              label: 'ENTREGAR CLIENTE',
              subtitle: 'Registrar entrega al cliente final',
              icon: Icons.assignment_turned_in,
              color: AppColors.deliverBlue,
              onPressed: () => _openScan('DELIVER'),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () => _openScan('REJECT'),
              icon: const Icon(Icons.report_gmailerrorred,
                  color: AppColors.rejectOrange),
              label: const Text(
                'RECHAZAR ENTREGA',
                style: TextStyle(
                  color: AppColors.rejectOrange,
                  fontWeight: FontWeight.w700,
                ),
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
                side: const BorderSide(color: AppColors.rejectOrange),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _RouteSummary extends StatelessWidget {
  const _RouteSummary({required this.future});

  final Future<ManifestData?> future;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ManifestData?>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final manifest = snapshot.data;
        if (manifest == null) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'No se pudo cargar la ruta. Deslice hacia abajo para reintentar.',
              style: TextStyle(color: AppColors.warning),
            ),
          );
        }
        if (!manifest.hasRoute) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              manifest.message ?? 'No tiene ruta asignada para hoy.',
              style: const TextStyle(color: Colors.black54),
            ),
          );
        }
        final pct = (manifest.completionPct / 100).clamp(0.0, 1.0).toDouble();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.local_shipping_outlined,
                    size: 18, color: AppColors.navy),
                const SizedBox(width: 6),
                Text(
                  manifest.truckPlate ?? 'Vehículo',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                if (manifest.fromCache)
                  const Text(
                    'sin conexión',
                    style: TextStyle(fontSize: 11, color: AppColors.warning),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: pct,
              minHeight: 9,
              borderRadius: BorderRadius.circular(6),
              backgroundColor: Colors.black12,
              color: AppColors.success,
            ),
            const SizedBox(height: 8),
            Text(
              '${manifest.deliveredUnits} de ${manifest.assignedUnits} unidades entregadas · '
              '${manifest.pendingUnits} pendientes · ${manifest.rejectedLines} rechazos',
              style: const TextStyle(fontSize: 13, color: Colors.black87),
            ),
          ],
        );
      },
    );
  }
}

class _SyncStrip extends StatelessWidget {
  const _SyncStrip({required this.sync});

  final SyncEngine sync;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('HH:mm');
    final last = sync.lastSyncAt;
    return SectionCard(
      child: Row(
        children: [
          Icon(
            sync.online ? Icons.cloud_done : Icons.cloud_off,
            color: sync.online ? AppColors.success : AppColors.warning,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sync.online ? 'En línea' : 'Sin conexión (trabajo offline)',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  last != null
                      ? 'Última sincronización: ${fmt.format(last.toLocal())}'
                      : 'Aún no se ha sincronizado la cola',
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
                if (sync.lastSyncError != null)
                  Text(
                    sync.lastSyncError!,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.danger),
                  ),
              ],
            ),
          ),
          if (sync.pendingCount + sync.podPendingCount > 0)
            Text(
              '${sync.pendingCount + sync.podPendingCount} en cola',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.warning,
              ),
            ),
          IconButton(
            onPressed: sync.syncing ? null : () => sync.flush(manual: true),
            icon: sync.syncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.2),
                  )
                : const Icon(Icons.sync),
            tooltip: 'Sincronizar ahora',
          ),
        ],
      ),
    );
  }
}
