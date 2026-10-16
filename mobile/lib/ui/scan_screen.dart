import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/theme.dart';
import '../data/models.dart';
import '../data/repository.dart';
import '../data/sync_engine.dart';
import '../services/feedback.dart';
import '../services/location_service.dart';
import 'signature_screen.dart';

const _rejectionReasons = <List<String>>[
  ['DAMAGED', 'Producto averiado'],
  ['WRONG_ITEM', 'Producto equivocado'],
  ['CLIENT_REJECTED', 'Cliente no lo recibió'],
  ['NO_ONE_HOME', 'Nadie en el domicilio'],
  ['ADDRESS_NOT_FOUND', 'Dirección no encontrada'],
  ['OTHER', 'Otro motivo'],
];

class _RejectionChoice {
  _RejectionChoice(this.code, this.notes);

  final String code;
  final String? notes;
}

/// Universal scanning screen for LOAD / DELIVER / REJECT actions.
///
/// UX contract: success = green flash + short vibration + high beep;
/// error = red flash + long vibration + low buzz.
class ScanScreen extends StatefulWidget {
  const ScanScreen({
    super.key,
    required this.action,
    required this.repository,
    required this.sync,
  });

  final String action; // LOAD | DELIVER | REJECT
  final Repository repository;
  final SyncEngine sync;

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  bool _busy = false;
  bool _torchOn = false;
  Color? _flash;
  String? _banner;
  bool _bannerOk = true;
  ScanOutcome? _deliveryOutcome;
  String? _lastQr;
  DateTime _lastQrAt = DateTime.fromMillisecondsSinceEpoch(0);
  Timer? _flashTimer;
  Timer? _bannerTimer;

  @override
  void dispose() {
    _flashTimer?.cancel();
    _bannerTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  String get _title {
    switch (widget.action) {
      case 'LOAD':
        return 'CARGAR CAMIÓN';
      case 'REJECT':
        return 'RECHAZAR ENTREGA';
      default:
        return 'ENTREGAR CLIENTE';
    }
  }

  Color get _accent {
    switch (widget.action) {
      case 'LOAD':
        return AppColors.loadGreen;
      case 'REJECT':
        return AppColors.rejectOrange;
      default:
        return AppColors.deliverBlue;
    }
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy) return;
    String? qr;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value != null && value.isNotEmpty) {
        qr = value;
        break;
      }
    }
    if (qr == null) return;

    final now = DateTime.now();
    if (qr == _lastQr && now.difference(_lastQrAt) < const Duration(seconds: 4)) {
      return; // debounce repeated frames of the same code
    }
    _lastQr = qr;
    _lastQrAt = now;
    await _processQr(qr);
  }

  Future<void> _processQr(String qr) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _banner = null;
      _deliveryOutcome = null;
    });
    try {
      final location = await LocationService.capture();

      if (location.isMocked) {
        await _fail('GPS FALSO DETECTADO. El escaneo fue bloqueado y reportado.');
        return;
      }

      if (widget.action == 'REJECT') {
        final choice = await _askRejection();
        if (choice == null) {
          _lastQr = null; // allow immediate rescan when cancelled
          return;
        }
        await _submit(qr, location, reasonCode: choice.code, notes: choice.notes);
      } else {
        await _submit(qr, location);
      }
    } on LocationException catch (e) {
      await _fail(e.message);
    } catch (e) {
      await _fail('Error inesperado: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit(
    String qr,
    ScanLocation location, {
    String? reasonCode,
    String? notes,
  }) async {
    try {
      final outcome = await widget.sync.submitScan(
        qrCode: qr,
        action: widget.action,
        location: location,
        rejectionReason: reasonCode,
        rejectionNotes: notes,
      );
      await FeedbackService.instance.success();
      if (!mounted) return;

      final label = switch (widget.action) {
        'LOAD' => 'CARGA CONFIRMADA',
        'REJECT' => 'RECHAZO REGISTRADO',
        _ => 'ENTREGA CONFIRMADA',
      };
      final product = outcome.productDescription != null
          ? ' · ${outcome.productDescription}'
          : '';
      final queued = outcome.queued ? ' (sin conexión, en cola)' : '';
      final duplicate = outcome.duplicate ? ' (ya registrado)' : '';

      setState(() {
        _flash = AppColors.success;
        _bannerOk = true;
        _banner = '$label$product$duplicate$queued';
        _deliveryOutcome =
            widget.action == 'DELIVER' ? outcome : null;
      });
      _scheduleClear();
      _refreshManifestSilently();
    } on ApiException catch (e) {
      await _fail(_humanize(e));
    }
  }

  Future<void> _fail(String message) async {
    await FeedbackService.instance.error();
    if (!mounted) return;
    setState(() {
      _flash = AppColors.danger;
      _bannerOk = false;
      _banner = message;
      _deliveryOutcome = null;
    });
    _scheduleClear();
  }

  void _scheduleClear() {
    _flashTimer?.cancel();
    _flashTimer = Timer(const Duration(milliseconds: 550), () {
      if (mounted) setState(() => _flash = null);
    });
    _bannerTimer?.cancel();
    _bannerTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) setState(() => _banner = null);
    });
  }

  String _humanize(ApiException e) {
    switch (e.code) {
      case 'ALREADY_DELIVERED':
        return 'Este producto ya fue marcado como entregado.';
      case 'ITEM_NOT_IN_MANIFEST':
        return 'El producto no está en la ruta de hoy.';
      case 'ITEM_NOT_FOUND':
        return 'Código QR no reconocido en el catálogo.';
      case 'MOCK_LOCATION_DETECTED':
        return 'GPS falso detectado. Escaneo bloqueado.';
      case 'DEVICE_LIMIT_REACHED':
        return 'Límite de dispositivos de la licencia alcanzado.';
      case 'SUBSCRIPTION_EXPIRED':
        return 'La licencia venció. Contacte al administrador.';
      case 'SUBSCRIPTION_SUSPENDED':
        return 'Licencia suspendida. Contacte al administrador.';
      case 'REJECTION_REASON_REQUIRED':
        return 'Debe indicar el motivo del rechazo.';
      default:
        return e.detail;
    }
  }

  void _refreshManifestSilently() {
    // Keep the cached manifest fresh after every accepted scan.
    unawaited(
      widget.repository.fetchManifest().then<void>(
        (_) {},
        onError: (Object _) {},
      ),
    );
  }

  Future<_RejectionChoice?> _askRejection() async {
    final notesCtrl = TextEditingController();
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Motivo del rechazo',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
            TextField(
              controller: notesCtrl,
              decoration: const InputDecoration(
                labelText: 'Notas (opcional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final reason in _rejectionReasons)
                    ListTile(
                      leading: const Icon(Icons.cancel_outlined,
                          color: AppColors.rejectOrange),
                      title: Text(reason[1]),
                      onTap: () =>
                          Navigator.of(sheetContext).pop(reason[0]),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (result == null) {
      notesCtrl.dispose();
      return null;
    }
    final notes = notesCtrl.text.trim();
    notesCtrl.dispose();
    return _RejectionChoice(result, notes.isEmpty ? null : notes);
  }

  Future<void> _openManualEntry() async {
    final controller = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ingresar código manualmente'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Código QR / barras'),
          onSubmitted: (value) => Navigator.of(dialogContext).pop(value),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(controller.text),
            child: const Text('Aceptar'),
          ),
        ],
      ),
    );
    controller.dispose();
    final trimmed = code?.trim();
    if (trimmed != null && trimmed.isNotEmpty) {
      await _processQr(trimmed);
    }
  }

  Future<void> _toggleTorch() async {
    try {
      await _controller.toggleTorch();
      if (mounted) setState(() => _torchOn = !_torchOn);
    } catch (_) {
      // camera may not support torch
    }
  }

  Future<void> _openSignature() async {
    final outcome = _deliveryOutcome;
    if (outcome == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SignatureScreen(
          scanUuid: outcome.scanUuid,
          sync: widget.sync,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: _accent,
        title: Text(_title),
        actions: [
          IconButton(
            onPressed: _toggleTorch,
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            tooltip: 'Linterna',
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: MobileScanner(
              controller: _controller,
              fit: BoxFit.cover,
              onDetect: _onDetect,
              errorBuilder: (context, error, child) => _CameraError(
                message: 'No se pudo abrir la cámara (${error.errorCode.name}). '
                    'Verifique los permisos de la aplicación.',
              ),
            ),
          ),
          // Scan window frame
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: _accent, width: 4),
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
          // Success/error flash
          if (_flash != null)
            Positioned.fill(
              child: IgnorePointer(
                child: Container(color: _flash!.withAlpha(150)),
              ),
            ),
          // Status banner
          if (_banner != null)
            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Material(
                color: _bannerOk ? AppColors.success : AppColors.danger,
                borderRadius: BorderRadius.circular(12),
                elevation: 4,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Icon(
                        _bannerOk
                            ? Icons.check_circle_outline
                            : Icons.error_outline,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _banner!,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (_busy && _banner == null)
            const Positioned(
              bottom: 130,
              left: 0,
              right: 0,
              child: Center(
                child: Chip(
                  avatar: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  label: Text('Procesando…'),
                ),
              ),
            ),
          // Bottom controls
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_deliveryOutcome != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.loadGreen,
                        minimumSize: const Size.fromHeight(54),
                      ),
                      onPressed: _busy ? null : _openSignature,
                      icon: const Icon(Icons.draw),
                      label: const Text('FIRMA / FOTO DE ENTREGA'),
                    ),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          backgroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(48),
                        ),
                        onPressed: _busy ? null : _openManualEntry,
                        icon: const Icon(Icons.keyboard),
                        label: const Text('Código manual'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CameraError extends StatelessWidget {
  const _CameraError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black87,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.no_photography_outlined,
                  size: 56, color: Colors.white54),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
