import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:vibration/vibration.dart';

/// Scan feedback required by the warehouse UX contract:
///
/// * success = short vibration + high-pitched double-length beep
/// * error   = long vibration + low buzz
///
/// The beeps are synthesized as WAV files at startup so the app ships with
/// zero binary audio assets.
class FeedbackService {
  FeedbackService._();

  static final FeedbackService instance = FeedbackService._();

  // Success: E6-ish 1568 Hz for 130 ms. Error: low 320 Hz for 420 ms.
  static const int _successHz = 1568;
  static const int _successMs = 130;
  static const int _errorHz = 320;
  static const int _errorMs = 420;

  AudioPlayer? _player;
  String? _successPath;
  String? _errorPath;
  bool _vibratorAvailable = false;

  Future<void> init() async {
    try {
      final dir = await getTemporaryDirectory();
      _successPath = '${dir.path}/rs_beep_ok.wav';
      _errorPath = '${dir.path}/rs_beep_err.wav';
      await File(_successPath!).writeAsBytes(_synthesizeWav(_successHz, _successMs));
      await File(_errorPath!).writeAsBytes(_synthesizeWav(_errorHz, _errorMs));
      final player = AudioPlayer();
      await player.setReleaseMode(ReleaseMode.stop);
      _player = player;
    } catch (_) {
      _player = null; // audio is best-effort, never block scanning
    }
    try {
      _vibratorAvailable = (await Vibration.hasVibrator()) ?? false;
    } catch (_) {
      _vibratorAvailable = false;
    }
  }

  Future<void> success() async {
    await _play(_successPath);
    await _vibrate(120);
  }

  Future<void> error() async {
    await _play(_errorPath);
    await _vibrate(500);
  }

  Future<void> tap() => _vibrate(30);

  Future<void> _play(String? path) async {
    final player = _player;
    if (player == null || path == null) return;
    try {
      await player.stop();
      await player.play(DeviceFileSource(path));
    } catch (_) {
      // audio failures must never break the scan flow
    }
  }

  Future<void> _vibrate(int milliseconds) async {
    if (!_vibratorAvailable) return;
    try {
      await Vibration.vibrate(duration: milliseconds);
    } catch (_) {
      // ignore
    }
  }

  /// Builds a mono 16-bit PCM WAV in memory (44-byte RIFF header + samples).
  Uint8List _synthesizeWav(
    int frequencyHz,
    int durationMs, {
    int sampleRate = 22050,
    double amplitude = 0.9,
  }) {
    final sampleCount = (sampleRate * durationMs / 1000).round();
    final dataSize = sampleCount * 2;
    final data = ByteData(44 + dataSize);

    void writeAscii(int offset, String value) {
      for (var i = 0; i < value.length; i++) {
        data.setUint8(offset + i, value.codeUnitAt(i));
      }
    }

    writeAscii(0, 'RIFF');
    data.setUint32(4, 36 + dataSize, Endian.little);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    data.setUint32(16, 16, Endian.little); // fmt chunk size
    data.setUint16(20, 1, Endian.little); // PCM
    data.setUint16(22, 1, Endian.little); // mono
    data.setUint32(24, sampleRate, Endian.little);
    data.setUint32(28, sampleRate * 2, Endian.little); // byte rate
    data.setUint16(32, 2, Endian.little); // block align
    data.setUint16(34, 16, Endian.little); // bits per sample
    writeAscii(36, 'data');
    data.setUint32(40, dataSize, Endian.little);

    // 8 ms fade in/out to avoid clicks.
    final fadeSamples = math.max(1, (sampleRate * 0.008).round());
    for (var i = 0; i < sampleCount; i++) {
      final t = i / sampleRate;
      var envelope = 1.0;
      if (i < fadeSamples) envelope = i / fadeSamples;
      final remaining = sampleCount - i;
      if (remaining < fadeSamples) envelope = remaining / fadeSamples;

      final wave = math.sin(2 * math.pi * frequencyHz * t);
      var value = (wave * envelope * amplitude * 32767).round();
      if (value > 32767) value = 32767;
      if (value < -32768) value = -32768;
      data.setInt16(44 + i * 2, value, Endian.little);
    }
    return data.buffer.asUint8List();
  }
}
