import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareData, ranking } from './data.js';
const raw = JSON.parse(readFileSync(new URL('../results/team_scores.json', import.meta.url)));
test('every event retained and sessions use last event snapshot', () => {
  const data = prepareData(raw.events);
  assert.equal(data.checkpoints.length, raw.events.length);
  assert.equal(data.sessions.length, 6);
  for(const session of data.sessions) {
    const last = data.checkpoints.filter(p => p.session === session.session).at(-1);
    assert.deepEqual(session.scores, last.scores);
  }
  assert.deepEqual(data.sessions.at(-1).scores, data.checkpoints.at(-1).scores);
});
test('scores carry through all events and match final totals', () => {
  const data = prepareData(raw.events);
  for(const team of data.teams) {
    let previous = 0;
    for(const point of data.checkpoints) {
      const total = point.scores[team.code] || 0;
      assert(total >= previous);
      previous = total;
    }
    assert.equal(previous, team.total);
  }
});
test('competition rank handles ties and zero points', () => {
  assert.equal(ranking({ a:10, b:10, c:5 }, 'b'), 1);
  assert.equal(ranking({ a:10, b:10, c:5 }, 'c'), 3);
  assert.equal(ranking({ a:10 }, 'missing'), 2);
});
