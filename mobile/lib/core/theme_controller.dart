import 'package:flutter/material.dart';

/// Holds the user's appearance choice and notifies [MaterialApp] when it
/// changes. Persistence lives in [SessionStore] so it survives restarts.
class ThemeController extends ChangeNotifier {
  ThemeController._();

  static final ThemeController instance = ThemeController._();

  ThemeMode _mode = ThemeMode.system;

  ThemeMode get mode => _mode;

  static ThemeMode parse(String? raw) {
    switch (raw) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  static String serialize(ThemeMode mode) => mode.name;

  /// Applies a mode without persisting (used at boot after loading storage).
  void hydrate(String? raw) {
    final next = parse(raw);
    if (next == _mode) return;
    _mode = next;
    notifyListeners();
  }

  void setMode(ThemeMode mode) {
    if (mode == _mode) return;
    _mode = mode;
    notifyListeners();
  }
}
