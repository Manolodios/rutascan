import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';

import '../core/theme.dart';
import '../data/models.dart';
import '../data/sync_engine.dart';

/// Proof of delivery: client signature and/or evidence photo.
/// Both artifacts are keyed by the scan's `scan_uuid`.
class SignatureScreen extends StatefulWidget {
  const SignatureScreen({
    super.key,
    required this.scanUuid,
    required this.sync,
  });

  final String scanUuid;
  final SyncEngine sync;

  @override
  State<SignatureScreen> createState() => _SignatureScreenState();
}

class _SignatureScreenState extends State<SignatureScreen> {
  final SignatureController _controller = SignatureController(
    penStrokeWidth: 3.0,
    penColor: const Color(0xFF1A1A1A),
    exportBackgroundColor: Colors.white,
  );
  final ImagePicker _picker = ImagePicker();

  bool _busy = false;
  String? _banner;
  bool _bannerOk = true;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _saveSignature() async {
    if (_controller.isEmpty) {
      setState(() {
        _banner = 'La firma está vacía. Pida al cliente que firme.';
        _bannerOk = false;
      });
      return;
    }
    final bytes = await _controller.toPngBytes();
    if (bytes == null || bytes.length < 64) {
      setState(() {
        _banner = 'No se pudo generar la imagen de la firma.';
        _bannerOk = false;
      });
      return;
    }
    await _attach(kind: 'signature', bytes: bytes, successMessage: 'Firma guardada.');
  }

  Future<void> _takePhoto() async {
    try {
      final photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 60,
        maxWidth: 1600,
      );
      if (photo == null) return;
      final bytes = await photo.readAsBytes();
      if (bytes.isEmpty) {
        setState(() {
          _banner = 'La foto salió vacía. Intente de nuevo.';
          _bannerOk = false;
        });
        return;
      }
      await _attach(kind: 'photo', bytes: bytes, successMessage: 'Foto guardada.');
    } catch (e) {
      setState(() {
        _banner = 'No se pudo abrir la cámara: $e';
        _bannerOk = false;
      });
    }
  }

  Future<void> _attach({
    required String kind,
    required Uint8List bytes,
    required String successMessage,
  }) async {
    setState(() {
      _busy = true;
      _banner = null;
    });
    try {
      final result = await widget.sync.attachPod(
        scanUuid: widget.scanUuid,
        kind: kind,
        bytes: bytes,
      );
      if (!mounted) return;
      setState(() {
        _bannerOk = true;
        _banner = result.queuedOffline
            ? 'Guardado sin conexión. Se subirá automáticamente.'
            : successMessage;
      });
      if (result.storedOnServer) {
        await Future<void>.delayed(const Duration(milliseconds: 700));
        if (!mounted) return;
        Navigator.of(context).pop();
        return;
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _bannerOk = false;
        _banner = e.detail;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Firma / evidencia')),
      body: Column(
        children: [
          if (_banner != null)
            Container(
              width: double.infinity,
              color: _bannerOk ? AppColors.success : AppColors.danger,
              padding: const EdgeInsets.all(12),
              child: Text(
                _banner!,
                style: const TextStyle(color: Colors.white),
              ),
            ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.black26),
              ),
              clipBehavior: Clip.antiAlias,
              child: Signature(
                controller: _controller,
                backgroundColor: Colors.white,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : _controller.clear,
                        icon: const Icon(Icons.cleaning_services),
                        label: const Text('Limpiar'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : _takePhoto,
                        icon: const Icon(Icons.photo_camera),
                        label: const Text('Foto'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                  ),
                  onPressed: _busy ? null : _saveSignature,
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.check),
                  label: const Text('GUARDAR FIRMA'),
                ),
                TextButton(
                  onPressed:
                      _busy ? null : () => Navigator.of(context).pop(),
                  child: const Text('Omitir'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
