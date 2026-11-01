<?php
/**
 * Leaderboard for the harm reduction project game.
 *
 *   GET  board.php                      top 50 runs
 *   POST board.php {"action":"start"}   a signed run ticket: {id, ts, token}
 *   POST board.php {"action":"submit", id, ts, token, name, helped, nights}
 *   POST board.php {"action":"hello", sid}         presence: may I play, and for how long
 *   GET  board.php?game=<gid>           a live game's latest save: {data}
 *   POST board.php {"action":"save", data}             a new live game: {gid, key}
 *   POST board.php {"action":"save", gid, key, data}   the game's newer state
 *
 * Live games make the page's address its own link: the game saves here as
 * it is played, and anyone opening the address gets the city as it is now.
 * Only the browser that made a game holds its key (kept here only as a keyed
 * hash), so only it can write; everyone else gets their own copy to play on.
 * A save is the game's packed state (base64url), opaque here: the game checks
 * and clamps every field when it loads one.
 *
 * Presence keeps the server's free memory above 2 GB: while it is, everyone
 * plays. Below it, new players wait in a queue and players already in get
 * 30 minutes; the queue is let in as memory comes back. The game itself runs
 * in the browser, so this is a safety valve, not the usual case.
 *
 * Nothing the browser sends is trusted:
 * - A run ticket is signed (HMAC) with a server secret, so the start time
 *   cannot be backdated. No state is kept for tickets.
 * - A score must fit the time since the ticket: nights at most what 16x
 *   speed allows, people helped at most a generous cap per night and per
 *   second. Scores only ever go up for a run.
 * - Names: 2 to 40 letters, digits, spaces and light punctuation; a short
 *   list of slurs is refused.
 * - Per-address limits on tickets and submissions. Addresses are kept only
 *   as keyed hashes, never in the clear.
 * - Bodies over 16 KB (a save; everything else is far smaller), other methods and other content are refused.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MAX_BODY = 16384;             // a packed save is a few KB; everything else is tiny
const MAX_SAVE = 12000;             // characters of packed save
const KEEP_GAMES = 20000;
const GAME_DAYS = 90;               // a game nobody played for this long is dropped
const SECONDS_PER_NIGHT = 90;      // a game day at 16x: 1440 game minutes at 16 per second
const MAX_HELPED_PER_NIGHT = 2000; // measured about 100 on a busy night; this is twenty times that
const MAX_HELPED_PER_SECOND = 10;
const TICKET_DAYS = 90;
const TOP = 50;
const KEEP_ROWS = 5000;
const FREE_FLOOR = 2 * 1024 * 1024 * 1024; // bytes of free memory to keep
const BUSY_LIMIT = 30 * 60;                // seconds of play while busy
const SESSION_TTL = 150;                   // a session without a hello for this long has left

function out(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function secret(): string {
    $file = getenv('THEGAME_SECRET_FILE') ?: '/etc/thegame/secret';
    $s = is_readable($file) ? trim((string) file_get_contents($file)) : '';
    if (strlen($s) < 32) out(503, ['error' => 'unavailable']);
    return $s;
}

function db(): PDO {
    $path = getenv('THEGAME_DB') ?: '/var/lib/thegame/board.sqlite';
    // Wait for a lock before anything else: the game sends two requests at once on start.
    $pdo = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]);
    $pdo->exec('PRAGMA busy_timeout=5000');
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, name TEXT NOT NULL, helped INTEGER NOT NULL, nights INTEGER NOT NULL, ts INTEGER NOT NULL, updated INTEGER NOT NULL, who TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS runs_helped ON runs (helped DESC)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS hits (who TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS hits_who ON hits (who, kind, at)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, who TEXT NOT NULL, first INTEGER NOT NULL, last INTEGER NOT NULL, admitted INTEGER NOT NULL, until INTEGER)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS games (gid TEXT PRIMARY KEY, key TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, who TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS games_updated ON games (updated)');
    return $pdo;
}

/** The caller, as a keyed hash. Behind Cloudflare the real address is in CF-Connecting-IP. */
function who(string $secret): string {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return substr(hash_hmac('sha256', 'ip|' . $ip, $secret), 0, 32);
}

/**
 * Starts a transaction holding the write lock from its first statement. A
 * transaction that reads first and writes later fails at once (no waiting)
 * when another request wrote in between; one that writes first waits its turn.
 */
function begin_write(PDO $db): void {
    $db->beginTransaction();
    $db->exec('DELETE FROM hits WHERE 0');
}

/** At most `limit` hits of `kind` in `window` seconds per caller; records this one. */
function limit(PDO $db, string $who, string $kind, int $limit, int $window): void {
    $now = time();
    begin_write($db);
    $db->prepare('DELETE FROM hits WHERE at < ?')->execute([$now - 86400]);
    $q = $db->prepare('SELECT COUNT(*) FROM hits WHERE who = ? AND kind = ? AND at > ?');
    $q->execute([$who, $kind, $now - $window]);
    $count = (int) $q->fetchColumn();
    $q->closeCursor();
    if ($count >= $limit) { $db->commit(); out(429, ['error' => 'slow down']); }
    $db->prepare('INSERT INTO hits (who, kind, at) VALUES (?, ?, ?)')->execute([$who, $kind, $now]);
    $db->commit();
}

function ticket(string $secret, string $id, int $ts): string {
    return hash_hmac('sha256', "run|$id|$ts", $secret);
}

function clean_name(mixed $name): string {
    if (!is_string($name)) out(400, ['error' => 'name']);
    $n = trim((string) preg_replace('/\s+/u', ' ', $name));
    $len = mb_strlen($n);
    if ($len < 2 || $len > 40 || !preg_match("/^[\\p{L}\\p{N} .,'&()\\-]+$/u", $n)) out(400, ['error' => 'name']);
    $flat = mb_strtolower((string) preg_replace('/[^\p{L}]/u', '', $n));
    foreach (['nigger', 'nigga', 'faggot', 'kike', 'retard', 'tranny', 'junkie', 'cunt', 'hitler', 'nazi'] as $bad) {
        if (str_contains($flat, $bad)) out(400, ['error' => 'name']);
    }
    return $n;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && isset($_GET['game'])) {
    $gid = $_GET['game'];
    if (!is_string($gid) || !preg_match('/^[0-9a-f]{24}$/', $gid)) out(400, ['error' => 'game']);
    $q = db()->prepare('SELECT data FROM games WHERE gid = ?');
    $q->execute([$gid]);
    $data = $q->fetchColumn();
    if ($data === false) out(404, ['error' => 'no such game']);
    out(200, ['data' => $data]);
}

if ($method === 'GET') {
    $db = db();
    $rows = $db->query('SELECT name, helped, nights FROM runs ORDER BY helped DESC, updated ASC LIMIT ' . TOP)->fetchAll(PDO::FETCH_ASSOC);
    header('Cache-Control: public, max-age=30');
    out(200, ['top' => array_map(fn ($r) => ['name' => $r['name'], 'helped' => (int) $r['helped'], 'nights' => (int) $r['nights']], $rows)]);
}

if ($method !== 'POST') out(405, ['error' => 'method']);
if (!str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) out(415, ['error' => 'type']);
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) out(413, ['error' => 'size']);
$in = json_decode($raw, true);
if (!is_array($in)) out(400, ['error' => 'json']);

$secret = secret();
$db = db();
$who = who($secret);
$now = time();

if (($in['action'] ?? '') === 'start') {
    limit($db, $who, 'start', 20, 86400);
    $id = bin2hex(random_bytes(12));
    out(200, ['id' => $id, 'ts' => $now, 'token' => ticket($secret, $id, $now)]);
}

if (($in['action'] ?? '') === 'save') {
    $data = $in['data'] ?? null;
    if (!is_string($data) || strlen($data) > MAX_SAVE || !preg_match('/^[A-Za-z0-9_-]+$/', $data)) out(400, ['error' => 'data']);
    $gid = $in['gid'] ?? null;
    if ($gid === null) {
        // A new game: its address and the key that lets only this browser write to it.
        limit($db, $who, 'newgame', 40, 86400);
        $gid = bin2hex(random_bytes(12));
        $key = bin2hex(random_bytes(16));
        begin_write($db);
        $db->prepare('INSERT INTO games (gid, key, data, updated, who) VALUES (?, ?, ?, ?, ?)')->execute([$gid, hash_hmac('sha256', "game|$key", $secret), $data, $now, $who]);
        // Keep the table small: games left alone for long, and the oldest past the cap.
        $db->prepare('DELETE FROM games WHERE updated < ?')->execute([$now - GAME_DAYS * 86400]);
        $db->exec('DELETE FROM games WHERE gid IN (SELECT gid FROM games ORDER BY updated DESC LIMIT -1 OFFSET ' . KEEP_GAMES . ')');
        $db->commit();
        out(200, ['gid' => $gid, 'key' => $key]);
    }
    $key = $in['key'] ?? null;
    if (!is_string($gid) || !preg_match('/^[0-9a-f]{24}$/', $gid) || !is_string($key) || !preg_match('/^[0-9a-f]{32}$/', $key)) out(400, ['error' => 'game']);
    limit($db, $who, 'save', 30, 60);
    begin_write($db);
    $q = $db->prepare('SELECT key FROM games WHERE gid = ?');
    $q->execute([$gid]);
    $stored = $q->fetchColumn();
    $q->closeCursor();
    if ($stored === false) { $db->rollBack(); out(404, ['error' => 'no such game']); }
    if (!hash_equals((string) $stored, hash_hmac('sha256', "game|$key", $secret))) { $db->rollBack(); out(403, ['error' => 'not yours']); }
    $db->prepare('UPDATE games SET data = ?, updated = ? WHERE gid = ?')->execute([$data, $now, $gid]);
    $db->commit();
    out(200, ['ok' => true]);
}

/** Free memory in bytes, or null where it cannot be read (then nobody is held back). */
function free_memory(): ?int {
    // Tests can pretend the server is short (THEGAME_FREE_BYTES); never set in production.
    $forced = getenv('THEGAME_FREE_BYTES');
    if ($forced !== false && $forced !== '') return (int) $forced;
    $info = @file_get_contents('/proc/meminfo');
    if ($info === false || !preg_match('/^MemAvailable:\s+(\d+) kB/m', $info, $m)) return null;
    return (int) $m[1] * 1024;
}

if (($in['action'] ?? '') === 'hello') {
    $sid = $in['sid'] ?? null;
    if (!is_string($sid) || !preg_match('/^[0-9a-f]{24}$/', $sid)) out(400, ['error' => 'sid']);
    limit($db, $who, 'hello', 12, 60);
    $db->prepare('DELETE FROM sessions WHERE last < ?')->execute([$now - SESSION_TTL]);
    $free = free_memory();
    $busy = $free !== null && $free < FREE_FLOOR;
    begin_write($db);
    $q = $db->prepare('SELECT admitted, until, first FROM sessions WHERE sid = ?');
    $q->execute([$sid]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        // Per address, at most a few sessions, so nobody can fill the queue.
        $c = $db->prepare('SELECT COUNT(*) FROM sessions WHERE who = ?');
        $c->execute([$who]);
        if ((int) $c->fetchColumn() >= 4) { $db->rollBack(); out(429, ['error' => 'too many sessions']); }
        $waiting = (int) $db->query('SELECT COUNT(*) FROM sessions WHERE admitted = 0')->fetchColumn();
        $admit = !$busy && $waiting === 0;
        $db->prepare('INSERT INTO sessions (sid, who, first, last, admitted, until) VALUES (?, ?, ?, ?, ?, NULL)')->execute([$sid, $who, $now, $now, $admit ? 1 : 0]);
        $row = ['admitted' => $admit ? 1 : 0, 'until' => null, 'first' => $now];
    } else {
        $db->prepare('UPDATE sessions SET last = ? WHERE sid = ?')->execute([$now, $sid]);
    }
    if ($busy) {
        // Busy: everyone already playing gets a time limit, if they have none yet.
        $db->prepare('UPDATE sessions SET until = ? WHERE admitted = 1 AND until IS NULL')->execute([$now + BUSY_LIMIT]);
    } else {
        // Room again: let the queue in, oldest first.
        $db->exec('UPDATE sessions SET admitted = 1 WHERE admitted = 0');
    }
    // Time is up: back of the queue.
    $db->prepare('UPDATE sessions SET admitted = 0, until = NULL, first = ? WHERE sid = ? AND until IS NOT NULL AND until < ?')->execute([$now, $sid, $now]);
    $q->execute([$sid]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    $db->commit();
    if ((int) $row['admitted'] === 1) out(200, ['admit' => true, 'until' => $row['until'] !== null ? (int) $row['until'] : null, 'now' => $now]);
    $pos = $db->prepare('SELECT COUNT(*) + 1 FROM sessions WHERE admitted = 0 AND first < ?');
    $pos->execute([(int) $row['first']]);
    out(200, ['admit' => false, 'position' => (int) $pos->fetchColumn(), 'now' => $now]);
}

if (($in['action'] ?? '') !== 'submit') out(400, ['error' => 'action']);
limit($db, $who, 'submit', 1, 20);
limit($db, $who, 'submitDay', 120, 86400);

$id = $in['id'] ?? null;
$ts = $in['ts'] ?? null;
$token = $in['token'] ?? null;
if (!is_string($id) || !preg_match('/^[0-9a-f]{24}$/', $id) || !is_int($ts) || !is_string($token)) out(400, ['error' => 'ticket']);
if (!hash_equals(ticket($secret, $id, $ts), $token)) out(403, ['error' => 'ticket']);
if ($ts > $now + 60 || $ts < $now - TICKET_DAYS * 86400) out(403, ['error' => 'ticket']);

$helped = $in['helped'] ?? null;
$nights = $in['nights'] ?? null;
if (!is_int($helped) || !is_int($nights) || $helped < 0 || $nights < 0) out(400, ['error' => 'score']);
$elapsed = max(0, $now - $ts);
// What the time since the ticket allows, at the fastest speed, with room to spare.
if ($nights > intdiv($elapsed, SECONDS_PER_NIGHT) + 1) out(422, ['error' => 'too fast']);
if ($helped > ($nights + 1) * MAX_HELPED_PER_NIGHT || $helped > ($elapsed + 60) * MAX_HELPED_PER_SECOND) out(422, ['error' => 'too many']);
$name = clean_name($in['name'] ?? null);

begin_write($db);
$q = $db->prepare('SELECT helped FROM runs WHERE id = ?');
$q->execute([$id]);
$prev = $q->fetchColumn();
if ($prev !== false && (int) $prev > $helped) {
    $db->rollBack();
    out(409, ['error' => 'lower than before']);
}
$db->prepare('INSERT INTO runs (id, name, helped, nights, ts, updated, who) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, helped = excluded.helped, nights = excluded.nights, updated = excluded.updated')
    ->execute([$id, $name, $helped, $nights, $ts, $now, $who]);
// Keep the table small: drop the lowest runs past the cap.
$db->exec('DELETE FROM runs WHERE id IN (SELECT id FROM runs ORDER BY helped DESC LIMIT -1 OFFSET ' . KEEP_ROWS . ')');
$db->commit();

$rank = $db->prepare('SELECT COUNT(*) + 1 FROM runs WHERE helped > ?');
$rank->execute([$helped]);
out(200, ['ok' => true, 'rank' => (int) $rank->fetchColumn()]);
