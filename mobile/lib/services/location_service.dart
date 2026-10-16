import 'dart:async';

import 'package:geolocator/geolocator.dart';

/// One GPS fix captured at scan time (UTC timestamp, mock flag included).
class ScanLocation {
  ScanLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.isMocked,
    required this.capturedAtUtc,
  });

  final double latitude;
  final double longitude;
  final double? accuracy;
  final bool isMocked;
  final DateTime capturedAtUtc;
}

class LocationException implements Exception {
  LocationException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// GPS capture with permission handling and mock-location detection.
class LocationService {
  LocationService._();

  /// High-accuracy fix; falls back to the last known position on timeout.
  static Future<ScanLocation> capture() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw LocationException(
        'El GPS está desactivado. Actívelo para poder escanear.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw LocationException('Permiso de ubicación denegado.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationException(
        'Permiso de ubicación bloqueado. Habilítelo en los ajustes del sistema.',
      );
    }

    Position? position;
    try {
      position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 25),
        ),
      );
    } on TimeoutException {
      position = await Geolocator.getLastKnownPosition();
    }
    if (position == null) {
      throw LocationException(
        'No se pudo obtener la ubicación. Intente de nuevo.',
      );
    }

    return ScanLocation(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      isMocked: position.isMocked,
      capturedAtUtc: DateTime.now().toUtc(),
    );
  }
}
