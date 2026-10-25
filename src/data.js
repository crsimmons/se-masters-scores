export function prepareData(events) {
  const final = events.at(-1).standings;
  const teams = final.map(t => ({ code: t.club_code || t.club_name, name: t.club_name || t.club_code, total: t.total_points }));
  const genderTotals = { open: {}, female: {} };
  const checkpoints = events.map(e => {
    const scores = Object.fromEntries(e.standings.map(t => [t.club_code || t.club_name, t.total_points]));
    for (const category of Object.keys(genderTotals)) {
      for (const award of e.gender_points_awarded?.[category] || []) {
        const code = award.club_code || award.club_name;
        genderTotals[category][code] = (genderTotals[category][code] || 0) + award.points;
      }
    }
    return {
      number: e.event_number,
      name: e.event_name,
      session: Math.floor(e.event_number / 100),
      scores,
      genderScores: {
        combined: scores,
        open: { ...genderTotals.open },
        female: { ...genderTotals.female },
      },
      genderContributors: {
        open: (e.gender_points_awarded?.open || []).length > 0,
        female: (e.gender_points_awarded?.female || []).length > 0,
      },
    };
  });
  const sessions = checkpoints.filter((e, i) => e.session !== checkpoints[i + 1]?.session);
  return { teams, checkpoints, sessions };
}
export function genderCheckpoints(checkpoints, gender) {
  return gender === 'combined' ? checkpoints : checkpoints.filter(checkpoint => checkpoint.genderContributors[gender]);
}
export function ranking(scores, code) {
  const value = scores[code] || 0;
  return 1 + Object.values(scores).filter(n => n > value).length;
}
