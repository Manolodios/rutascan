import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import 'models.dart';

/// Local SQLite database: offline scan queue, pending proof-of-delivery files
/// and the last known manifest (so drivers can work with zero signal).
class LocalDb {
  LocalDb._();

  static final LocalDb instance = LocalDb._();

  Database? _db;

  Future<Database> get _database async => _db ??= await _open();

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    final path = join(dir, 'rutascan_local.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pending_scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_uuid TEXT NOT NULL UNIQUE,
            qr_code TEXT NOT NULL,
            action TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            gps_accuracy REAL,
            scan_timestamp_utc TEXT NOT NULL,
            rejection_reason TEXT,
            rejection_notes TEXT,
            pod_signature_url TEXT,
            pod_photo_url TEXT,
            failed INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE pod_pending (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_uuid TEXT NOT NULL,
            kind TEXT NOT NULL,
            local_path TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE manifest_cache (
            id INTEGER PRIMARY KEY,
            payload TEXT NOT NULL,
            cached_at TEXT NOT NULL
          )
        ''');
      },
    );
  }

  // ------------------------------------------------------------ scan queue --
  Future<void> enqueuePendingScan(PendingScan scan) async {
    final db = await _database;
    await db.insert(
      'pending_scans',
      scan.toRow(),
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
  }

  Future<List<PendingScan>> pendingScans({bool includeFailed = false}) async {
    final db = await _database;
    final rows = await db.query(
      'pending_scans',
      where: includeFailed ? null : 'failed = 0',
      orderBy: 'id ASC',
    );
    return rows.map(PendingScan.fromRow).toList(growable: false);
  }

  Future<int> countPending() async {
    final db = await _database;
    final rows =
        await db.rawQuery('SELECT COUNT(*) AS c FROM pending_scans WHERE failed = 0');
    return (rows.first['c'] as int?) ?? 0;
  }

  Future<int> countFailed() async {
    final db = await _database;
    final rows =
        await db.rawQuery('SELECT COUNT(*) AS c FROM pending_scans WHERE failed = 1');
    return (rows.first['c'] as int?) ?? 0;
  }

  Future<void> deleteScan(String scanUuid) async {
    final db = await _database;
    await db.delete('pending_scans', where: 'scan_uuid = ?', whereArgs: [scanUuid]);
  }

  Future<void> markScanFailed(String scanUuid, String error) async {
    final db = await _database;
    await db.update(
      'pending_scans',
      {'failed': 1, 'last_error': error},
      where: 'scan_uuid = ?',
      whereArgs: [scanUuid],
    );
  }

  Future<void> clearScanFailure(String scanUuid) async {
    final db = await _database;
    await db.update(
      'pending_scans',
      {'failed': 0, 'last_error': null},
      where: 'scan_uuid = ?',
      whereArgs: [scanUuid],
    );
  }

  /// Injects a previously uploaded PoD URL into a queued scan so it travels
  /// with the offline batch. Returns false when the scan is no longer queued.
  Future<bool> injectPodUrl(String scanUuid, String kind, String url) async {
    final db = await _database;
    final column = kind == 'signature' ? 'pod_signature_url' : 'pod_photo_url';
    final updated = await db.update(
      'pending_scans',
      {column: url},
      where: 'scan_uuid = ? AND failed = 0',
      whereArgs: [scanUuid],
    );
    return updated > 0;
  }

  // ------------------------------------------------------------- pod queue --
  Future<void> addPodPending(PodPending pod) async {
    final db = await _database;
    await db.insert('pod_pending', pod.toRow());
  }

  Future<List<PodPending>> podPendings() async {
    final db = await _database;
    final rows = await db.query('pod_pending', orderBy: 'id ASC');
    return rows.map(PodPending.fromRow).toList(growable: false);
  }

  Future<int> countPodPending() async {
    final db = await _database;
    final rows = await db.rawQuery('SELECT COUNT(*) AS c FROM pod_pending');
    return (rows.first['c'] as int?) ?? 0;
  }

  Future<void> deletePodPending(int id) async {
    final db = await _database;
    await db.delete('pod_pending', where: 'id = ?', whereArgs: [id]);
  }

  // -------------------------------------------------------- manifest cache --
  Future<void> cacheManifest(String payload) async {
    final db = await _database;
    await db.insert(
      'manifest_cache',
      {
        'id': 1,
        'payload': payload,
        'cached_at': DateTime.now().toUtc().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> cachedManifest() async {
    final db = await _database;
    final rows = await db.query('manifest_cache', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return null;
    return rows.first['payload'] as String?;
  }
}
