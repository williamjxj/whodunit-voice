import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, closeDb, saveSession, getBests, getStates, setState, deleteState, getLeaderboard, isDbReady } from '../data/db.mjs';

const CASE = 'jade-pavilion';
const P1 = 'p-11111111';
const P2 = 'p-22222222';

test('initDb opens an in-memory database', async () => {
  const db = await initDb(':memory:');
  assert.ok(db, 'node:sqlite should be available');
  assert.ok(isDbReady());
});

test('saveSession returns best/newBest and persists rows', async () => {
  const first = saveSession({ playerId: P1, caseId: CASE, score: 120, verdict: 'solved_thin', cluesFound: 4, hintsUsed: 0 });
  assert.deepEqual(first, { score: 120, best: 120, newBest: true });

  const worse = saveSession({ playerId: P1, caseId: CASE, score: 90, verdict: 'wrong', cluesFound: 2, hintsUsed: 1 });
  assert.equal(worse.newBest, false);
  assert.equal(worse.best, 120);

  const better = saveSession({ playerId: P1, caseId: CASE, score: 165, verdict: 'solved_brilliant', cluesFound: 5, hintsUsed: 0 });
  assert.equal(better.newBest, true);
  assert.equal(better.best, 165);

  assert.deepEqual(getBests(P1), { [CASE]: 165 });
});

test('scores are per player, not global', async () => {
  saveSession({ playerId: P2, caseId: CASE, score: 200, verdict: 'solved_brilliant' });
  assert.deepEqual(getBests(P1), { [CASE]: 165 });
  assert.deepEqual(getBests(P2), { [CASE]: 200 });
});

test('getStates roundtrips stored JSON and setState upserts', async () => {
  setState(P1, CASE, { v: 2, foundClues: ['c1', 'c2'], score: 40, conversations: { a: [{ role: 'user', content: 'hi' }] } });
  const states = getStates(P1);
  assert.equal(states[CASE].state.v, 2);
  assert.deepEqual(states[CASE].state.foundClues, ['c1', 'c2']);
  assert.equal(states[CASE].state.score, 40);
  assert.ok(states[CASE].updatedAt > 0);

  // upsert replaces, does not duplicate
  setState(P1, CASE, { v: 2, foundClues: ['c1'], score: 25 });
  assert.equal(Object.keys(getStates(P1)).length, 1);
  assert.equal(getStates(P1)[CASE].state.score, 25);

  // another player is isolated
  assert.equal(getStates(P2)[CASE], undefined);
});

test('deleteState removes only the given case', async () => {
  setState(P1, 'sterling-affair', { score: 10 });
  deleteState(P1, CASE);
  const states = getStates(P1);
  assert.equal(states[CASE], undefined);
  assert.ok(states['sterling-affair']);
  deleteState(P1, 'sterling-affair');
  assert.deepEqual(getStates(P1), {});
});

test('getLeaderboard orders by score desc, ties by played_at asc, respects limit', async () => {
  // P1: 165, P2: 200 for CASE; add a third
  const P3 = 'p-33333333';
  saveSession({ playerId: P3, caseId: CASE, score: 165, verdict: 'solved_thin' });

  const top = getLeaderboard(CASE, 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].playerId, P2);
  assert.equal(top[0].score, 200);
  assert.equal(top[1].playerId, P1, '165 (earlier) beats 165 (later) on tiebreak');
  assert.equal(top[1].verdict, 'solved_brilliant');

  const all = getLeaderboard(CASE);
  assert.equal(all.length, 5, '3 sessions in test 2 + 1 in test 3 + 1 here');
  assert.equal(all[0].score, 200);

  // different case is independent
  assert.deepEqual(getLeaderboard('sterling-affair'), []);
});

test('closeDb cleans up and isDbReady reports false', async () => {
  closeDb();
  assert.equal(isDbReady(), false);
});