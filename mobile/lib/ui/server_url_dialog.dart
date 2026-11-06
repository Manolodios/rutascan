import 'package:flutter/material.dart';

import '../core/config.dart';
import '../core/theme.dart';
import '../data/session_store.dart';

/// Lets the user point the app at a different backend (PC on the LAN, a tunnel
/// or a public URL) without rebuilding the APK.
///
/// Returns `true` when the address was saved.
Future<bool> showServerUrlDialog(
  BuildContext context,
  SessionStore session,
) async {
  final controller = TextEditingController(text: session.effectiveServerUrl);
  String? error;

  final saved = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (builderContext, setState) {
        Future<void> save() async {
          final raw = controller.text.trim();
          if (raw.isNotEmpty && SessionStore.normalizeServerUrl(raw) == null) {
            setState(
              () => error = 'Dirección inválida. Ejemplo: http://192.168.1.139:8000',
            );
            return;
          }
          await session.setServerUrl(raw);
          if (builderContext.mounted) Navigator.of(builderContext).pop(true);
        }

        Future<void> reset() async {
          await session.setServerUrl(null);
          if (builderContext.mounted) Navigator.of(builderContext).pop(true);
        }

        return AlertDialog(
          title: const Text('Dirección del servidor'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: controller,
                  autofocus: true,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: InputDecoration(
                    labelText: 'Servidor',
                    hintText: 'http://192.168.1.139:8000',
                    prefixIcon: const Icon(Icons.dns_outlined),
                    errorText: error,
                  ),
                  onSubmitted: (_) => save(),
                ),
                const SizedBox(height: 12),
                Text(
                  'Debe apuntar al servidor de RutaScan:\n'
                  '• Producción: https://rutascan.onrender.com\n'
                  '• Red local: http://IP-DE-LA-PC:8000',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.muted(context),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Predeterminado de fábrica: ${AppConfig.apiBaseUrl}',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.faint(context),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: reset,
              child: const Text('Restablecer'),
            ),
            FilledButton(
              onPressed: save,
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    ),
  );
  return saved == true;
}
