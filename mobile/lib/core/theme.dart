import 'package:flutter/material.dart';

/// RutaScan brand palette.
class AppColors {
  AppColors._();

  static const Color navy = Color(0xFFdc2626); // rojo RutaScan, combina con landing MagnetLines
  static const Color primary = Color(0xFFdc2626);
  static const Color loadGreen = Color(0xFFef4444); // rojo brillante para carga
  static const Color deliverBlue = Color(0xFFf87171); // rojo claro para entrega
  static const Color rejectOrange = Color(0xFFdc2626); // rojo intenso para rechazo
  static const Color success = Color(0xFF2E7D32);
  static const Color danger = Color(0xFFC62828);
  static const Color warning = Color(0xFFEF6C00);
  static const Color surface = Color(0xFFF4F6F8);
}

ThemeData buildAppTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: AppColors.navy),
  );
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.surface,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.navy,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      filled: true,
      fillColor: Colors.white,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
    ),
  );
}
