export function prepareData(events) {
  const final = events.at(-1).standings;
  const teams = final.map(t => ({ code: t.club_code || t.club_name, name: t.club_name || t.club_code, total: t.total_points }));
  const points = events.map(e => Object.fromEntries(e.standings.map(t => [t.club_code || t.club_name, t.total_points])));
  const checkpoints = events.map((e, i) => ({ number: e.event_number, name: e.event_name, session: Math.floor(e.event_number / 100), scores: points[i] }));
  const sessions = checkpoints.filter((e, i) => e.session !== checkpoints[i + 1]?.session);
  return { teams, checkpoints, sessions };
}
export function ranking(scores, code) {
  const value = scores[code] || 0;
  return 1 + Object.values(scores).filter(n => n > value).length;
}
