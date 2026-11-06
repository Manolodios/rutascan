import 'package:flutter/material.dart';

/// RutaScan brand palette and theme.
///
/// The red family mirrors the landing (`#dc2626` primary, `#ef4444` bright,
/// `#f87171` soft) so the mobile app, the panel and the site feel like one
/// product.
class AppColors {
  AppColors._();

  // Brand
  static const Color brand = Color(0xFFDC2626);
  static const Color brandBright = Color(0xFFEF4444);
  static const Color brandDeep = Color(0xFF991B1B);
  static const Color brandSoft = Color(0xFFF87171);

  // Semantic
  static const Color success = Color(0xFF16A34A);
  static const Color danger = Color(0xFFDC2626);
  static const Color warning = Color(0xFFD97706);

  // Surfaces
  static const Color lightBackground = Color(0xFFF4F5F7);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE4E4E7);
  static const Color darkBackground = Color(0xFF09090B);
  static const Color darkSurface = Color(0xFF17171C);
  static const Color darkBorder = Color(0xFF27272A);

  // Compatibility aliases used across the screens.
  static const Color navy = brand;
  static const Color primary = brand;
  static const Color loadGreen = brandBright;
  static const Color deliverBlue = brandSoft;
  static const Color rejectOrange = brandDeep;
  static const Color surface = lightBackground;

  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [brandBright, brand, brandDeep],
  );

  static const LinearGradient headerGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFB91C1C), brand, Color(0xFF7F1D1D)],
  );

  /// Secondary text (hints, captions, subtitles).
  static Color muted(BuildContext context) =>
      Theme.of(context).colorScheme.onSurfaceVariant;

  /// Even lighter text for timestamps and disclaimers.
  static Color faint(BuildContext context) =>
      Theme.of(context).colorScheme.onSurface.withAlpha(120);

  /// Card background for the current brightness.
  static Color card(BuildContext context) =>
      Theme.of(context).cardTheme.color ??
      Theme.of(context).colorScheme.surface;

  /// Hairline border for the current brightness.
  static Color border(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? darkBorder
          : lightBorder;
}

ThemeData buildLightTheme() => buildAppTheme(Brightness.light);

ThemeData buildDarkTheme() => buildAppTheme(Brightness.dark);

ThemeData buildAppTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final surfaceColor = isDark ? AppColors.darkSurface : AppColors.lightSurface;
  final backgroundColor =
      isDark ? AppColors.darkBackground : AppColors.lightBackground;
  final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
  final textColor = isDark ? const Color(0xFFF4F4F5) : const Color(0xFF18181B);
  final mutedColor =
      isDark ? const Color(0xFFA1A1AA) : const Color(0xFF71717A);

  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.brand,
    brightness: brightness,
  ).copyWith(
    primary: AppColors.brand,
    onPrimary: Colors.white,
    secondary: AppColors.brandBright,
    onSecondary: Colors.white,
    error: AppColors.danger,
    onError: Colors.white,
    surface: surfaceColor,
    onSurface: textColor,
    onSurfaceVariant: mutedColor,
    outline: borderColor,
    outlineVariant: borderColor,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: backgroundColor,
  );

  final textTheme = base.textTheme
      .apply(bodyColor: textColor, displayColor: textColor)
      .copyWith(
        titleLarge: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.2,
        ),
        titleMedium: base.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
        labelLarge: base.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      );

  return base.copyWith(
    textTheme: textTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.brand,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      iconTheme: IconThemeData(color: Colors.white),
      titleTextStyle: TextStyle(
        color: Colors.white,
        fontSize: 19,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.2,
      ),
    ),
    cardTheme: CardThemeData(
      color: surfaceColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: borderColor),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surfaceColor,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      titleTextStyle: textTheme.titleLarge,
      contentTextStyle: textTheme.bodyMedium,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: surfaceColor,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    dividerTheme: DividerThemeData(color: borderColor, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? const Color(0xFF1C1C22) : const Color(0xFFF4F4F5),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: borderColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: borderColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.brand, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.danger, width: 2),
      ),
      labelStyle: TextStyle(color: mutedColor),
      hintStyle: TextStyle(color: mutedColor.withAlpha(160)),
      prefixIconColor: mutedColor,
      suffixIconColor: mutedColor,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.brand.withAlpha(80),
        disabledForegroundColor: Colors.white70,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: isDark ? Colors.white : AppColors.brandDeep,
        side: BorderSide(color: borderColor),
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.brand,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: surfaceColor,
      selectedItemColor: AppColors.brand,
      unselectedItemColor: mutedColor,
      type: BottomNavigationBarType.fixed,
      elevation: 12,
      showUnselectedLabels: true,
      selectedLabelStyle: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
      ),
      unselectedLabelStyle: const TextStyle(fontSize: 11),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: isDark ? const Color(0xFF27272A) : const Color(0xFF27272A),
      contentTextStyle: const TextStyle(color: Colors.white),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: mutedColor,
      textColor: textColor,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.brand,
    ),
    iconTheme: IconThemeData(
      color: isDark ? const Color(0xFFE4E4E7) : const Color(0xFF3F3F46),
    ),
  );
}
