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
            flexibleSpace: const DecoratedBox(
              decoration: BoxDecoration(gradient: AppColors.headerGradient),
            ),
            title: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.qr_code_2_rounded, size: 28),
                SizedBox(width: 10),
                Text('RutaScan'),
              ],
            ),
            actions: [
              _ConnectionChip(online: widget.sync.online),
              const SizedBox(width: 14),
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

class _ConnectionChip extends StatelessWidget {
  const _ConnectionChip({required this.online});

  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(28),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withAlpha(60)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            online ? Icons.wifi_rounded : Icons.wifi_off_rounded,
            size: 14,
            color: Colors.white,
          ),
          const SizedBox(width: 5),
          Text(
            online ? 'En línea' : 'Offline',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
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
    final today = DateFormat('EEEE d MMMM', 'es').format(DateTime.now());
    final todayLabel = today[0].toUpperCase() + today.substring(1);

    return RefreshIndicator(
      onRefresh: () async {
        _reload();
        await widget.sync.flush(manual: true);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 4, bottom: 28),
        children: [
          _WelcomeCard(
            greeting: _greeting,
            company: widget.session.companyName,
            todayLabel: todayLabel,
            online: widget.sync.online,
          ),
          SectionCard(
            title: 'Mi ruta de hoy',
            trailing: widget.sync.pendingCount + widget.sync.podPendingCount > 0
                ? Text(
                    '${widget.sync.pendingCount + widget.sync.podPendingCount} en cola',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.warning,
                    ),
                  )
                : null,
            child: _RouteSummary(future: _manifestFuture),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
            child: Row(
              children: [
                Text(
                  'Acciones rápidas',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                const Spacer(),
                Text(
                  'Toca para escanear',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.muted(context),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GiantActionButton(
              label: 'CARGAR CAMIÓN',
              subtitle: 'Confirmar mercancía que sube al vehículo',
              icon: Icons.local_shipping_rounded,
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
              icon: Icons.assignment_turned_in_rounded,
              color: AppColors.deliverBlue,
              onPressed: () => _openScan('DELIVER'),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () => _openScan('REJECT'),
              icon: const Icon(Icons.report_gmailerrorred_rounded),
              label: const Text('RECHAZAR ENTREGA'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                foregroundColor: AppColors.rejectOrange,
                side: BorderSide(
                  color: AppColors.rejectOrange.withAlpha(150),
                ),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          _SyncStrip(sync: widget.sync),
        ],
      ),
    );
  }
}

class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard({
    required this.greeting,
    required this.company,
    required this.todayLabel,
    required this.online,
  });

  final String greeting;
  final String? company;
  final String todayLabel;
  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.headerGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.brand.withAlpha(70),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      greeting,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if (company != null && company!.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        company!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(28),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      online ? Icons.cloud_done_rounded : Icons.cloud_off_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      online ? 'Sincronizado' : 'Offline',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(22),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withAlpha(40)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.calendar_today_rounded,
                  size: 16,
                  color: Colors.white70,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    todayLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Icon(
                  Icons.qr_code_scanner_rounded,
                  size: 17,
                  color: Colors.white70,
                ),
                const SizedBox(width: 5),
                const Text(
                  'Listo para escanear',
                  style: TextStyle(color: Colors.white70, fontSize: 11),
                ),
              ],
            ),
          ),
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
            child: Row(
              children: [
                Icon(
                  Icons.inbox_outlined,
                  size: 22,
                  color: AppColors.muted(context),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    manifest.message ?? 'No tiene ruta asignada para hoy.',
                    style: TextStyle(color: AppColors.muted(context)),
                  ),
                ),
              ],
            ),
          );
        }
        final pct = (manifest.completionPct / 100).clamp(0.0, 1.0).toDouble();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.local_shipping_outlined,
                  size: 20,
                  color: AppColors.brand,
                ),
                const SizedBox(width: 6),
                Text(
                  manifest.truckPlate ?? 'Vehículo',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const Spacer(),
                if (manifest.fromCache)
                  const StatusChip(
                    label: 'SIN CONEXIÓN',
                    color: AppColors.warning,
                  )
                else
                  Text(
                    '${manifest.completionPct.toStringAsFixed(0)}%',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppColors.brand,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 10,
                backgroundColor: AppColors.border(context),
                color: AppColors.brand,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _MiniStat(
                    value: '${manifest.deliveredUnits}',
                    label: 'entregadas',
                    color: AppColors.success,
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    value: '${manifest.pendingUnits}',
                    label: 'pendientes',
                    color: AppColors.warning,
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    value: '${manifest.rejectedLines}',
                    label: 'rechazos',
                    color: AppColors.danger,
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.value,
    required this.label,
    required this.color,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(fontSize: 11, color: AppColors.muted(context)),
        ),
      ],
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
    final pending = sync.pendingCount + sync.podPendingCount;

    return SectionCard(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: (sync.online ? AppColors.success : AppColors.warning)
                  .withAlpha(22),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              sync.online ? Icons.cloud_done_rounded : Icons.cloud_off_rounded,
              color: sync.online ? AppColors.success : AppColors.warning,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sync.online ? 'En línea' : 'Sin conexión (trabajo offline)',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  last != null
                      ? 'Última sincronización: ${fmt.format(last.toLocal())}'
                      : 'Aún no se ha sincronizado la cola',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: AppColors.muted(context),
                  ),
                ),
                if (sync.lastSyncError != null)
                  Text(
                    sync.lastSyncError!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.danger,
                    ),
                  ),
              ],
            ),
          ),
          if (pending > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.warning.withAlpha(24),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$pending en cola',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.warning,
                ),
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
                : const Icon(Icons.sync_rounded),
            tooltip: 'Sincronizar ahora',
          ),
        ],
      ),
    );
  }
}
