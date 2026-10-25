import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareData, ranking } from './data.js';
const raw = JSON.parse(readFileSync(new URL('../results/team_scores.json', import.meta.url)));
test('every event retained and sessions use last event snapshot', () => {
  const data = prepareData(raw.events);
  assert.equal(data.checkpoints.length, raw.events.length);
  assert.equal(data.sessions.length, 7);
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
test('gender score filters separate Open and Female and leave Mixed in combined', () => {
  const data = prepareData(raw.events);
  const combinedEvent = raw.events.find(event => event.event_number === 101);
  assert(combinedEvent.gender_points_awarded.open.length > 0);
  assert(combinedEvent.gender_points_awarded.female.length > 0);

  const mixedEvent = raw.events.find(event => event.event_number === 709);
  assert(mixedEvent.points_awarded.length > 0);
  assert.equal(mixedEvent.gender_points_awarded.open.length, 0);
  assert.equal(mixedEvent.gender_points_awarded.female.length, 0);

  for (const category of ['open', 'female']) {
    for (const team of data.teams) {
      let previous = 0;
      for (const checkpoint of data.checkpoints) {
        const score = checkpoint.genderScores[category][team.code] || 0;
        assert(score >= previous);
        assert(score <= (checkpoint.scores[team.code] || 0));
        previous = score;
      }
    }
  }
});
test('competition rank handles ties and zero points', () => {
  assert.equal(ranking({ a:10, b:10, c:5 }, 'b'), 1);
  assert.equal(ranking({ a:10, b:10, c:5 }, 'c'), 3);
  assert.equal(ranking({ a:10 }, 'missing'), 2);
});
