/* data/db.mjs — user data persistence (scores, results, in-progress game states).
   Zero npm dependencies: uses the built-in node:sqlite module (Node >= 22.5,
   experimental warning on 22.x, stable on 24+). Cases themselves stay as JSON
   files in data/cases/ — this DB only stores per-player runtime data.
   Lives next to its database file (data/whodunit.db, gitignored).

   If node:sqlite is unavailable (Node < 22.5), initDb() returns null and the
   server keeps running with DB-backed endpoints returning 503. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Default database file, next to this module. Override via initDb(dbPath). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_FILE = path.join(__dirname, 'whodunit.db');

let db = null;

/* ---- schema ---- */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS play_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    clues_found INTEGER NOT NULL DEFAULT 0,
    hints_used INTEGER NOT NULL DEFAULT 0,
    played_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_case ON play_sessions(case_id, score DESC);
  CREATE TABLE IF NOT EXISTS game_states (
    player_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    state TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, case_id)
  );
`;

/** Open (or create) the database. dbPath defaults to DB_FILE; pass ':memory:'
    for tests. Returns the DatabaseSync instance, or null when node:sqlite is
    missing. */
export async function initDb(dbPath = DB_FILE) {
  let DatabaseSync = null;
  try {
    ({ DatabaseSync } = await import('node:sqlite'));
  } catch {
    return null;
  }
  if (dbPath && dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

export function isDbReady() {
  return Boolean(db);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function ensurePlayer(playerId) {
  db.prepare('INSERT OR IGNORE INTO players (id, created_at) VALUES (?, ?)').run(playerId, Date.now());
}

/** Record a finished play session. Returns { score, best, newBest } where
    best/newBest are computed against this player's previous sessions for the
    case. The caller (server.js) derives `score` and `verdict` itself — this
    function only persists them. */
export function saveSession({ playerId, caseId, score, verdict, cluesFound = 0, hintsUsed = 0 }) {
  ensurePlayer(playerId);
  const prevBest = db
    .prepare('SELECT MAX(score) AS best FROM play_sessions WHERE player_id = ? AND case_id = ?')
    .get(playerId, caseId)?.best || 0;
  db.prepare(
    'INSERT INTO play_sessions (player_id, case_id, score, verdict, clues_found, hints_used, played_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(playerId, caseId, score, verdict, cluesFound, hintsUsed, Date.now());
  const best = Math.max(prevBest, score);
  return { score, best, newBest: score > prevBest };
}

/** Best score per case for a player: { caseId: score } */
export function getBests(playerId) {
  const rows = db
    .prepare('SELECT case_id, MAX(score) AS best FROM play_sessions WHERE player_id = ? GROUP BY case_id')
    .all(playerId);
  return Object.fromEntries(rows.map((r) => [r.case_id, r.best]));
}

/** All in-progress game states for a player: { caseId: { state, updatedAt } } */
export function getStates(playerId) {
  const rows = db
    .prepare('SELECT case_id, state, updated_at FROM game_states WHERE player_id = ?')
    .all(playerId);
  return Object.fromEntries(rows.map((r) => [r.case_id, { state: JSON.parse(r.state), updatedAt: r.updated_at }]));
}

/** Upsert one in-progress game state. `state` is the client's own save blob. */
export function setState(playerId, caseId, stateObj) {
  ensurePlayer(playerId);
  db.prepare(
    `INSERT INTO game_states (player_id, case_id, state, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id, case_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`
  ).run(playerId, caseId, JSON.stringify(stateObj), Date.now());
}

export function deleteState(playerId, caseId) {
  db.prepare('DELETE FROM game_states WHERE player_id = ? AND case_id = ?').run(playerId, caseId);
}

/** Top scores for a case: [{ playerId, score, verdict, playedAt }] */
export function getLeaderboard(caseId, limit = 10) {
  return db
    .prepare('SELECT player_id, score, verdict, played_at FROM play_sessions WHERE case_id = ? ORDER BY score DESC, played_at ASC LIMIT ?')
    .all(caseId, Math.max(1, Math.min(100, Number(limit) || 10)))
    .map((r) => ({ playerId: r.player_id, score: r.score, verdict: r.verdict, playedAt: r.played_at }));
}
