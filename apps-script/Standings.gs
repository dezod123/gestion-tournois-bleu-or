function calculateStandings_(division, teams, matches) {
  const divisionId = String(division['ID division']);
  const pointsWin = toNumber_(division['Points victoire'], 3);
  const pointsDraw = toNumber_(division['Points nul'], 1);
  const pointsLoss = toNumber_(division['Points défaite'], 0);
  const standings = {};
  teams.filter(function(team) { return String(team['ID division']) === divisionId; }).forEach(function(team) {
    const id = String(team['ID équipe']);
    standings[id] = { id: divisionId + ':' + id, tournamentId: String(team['ID tournoi']), divisionId: divisionId,
      pool: String(team['Pool'] || ''), teamId: id, teamName: String(team['Nom'] || ''), played: 0, wins: 0,
      draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, difference: 0, points: 0 };
  });
  matches.filter(function(match) {
    return String(match['ID division']) === divisionId && normalize_(match['Phase'] || 'POOL') === 'POOL' && isYes_(match['Résultat final']);
  }).forEach(function(match) {
    const home = standings[String(match['ID équipe domicile'])];
    const away = standings[String(match['ID équipe visiteuse'])];
    const homeScore = toNumber_(match['Score domicile'], null);
    const awayScore = toNumber_(match['Score visiteuse'], null);
    if (!home || !away || homeScore === null || awayScore === null) return;
    home.played += 1; away.played += 1;
    home.goalsFor += homeScore; home.goalsAgainst += awayScore;
    away.goalsFor += awayScore; away.goalsAgainst += homeScore;
    if (homeScore > awayScore) { home.wins += 1; away.losses += 1; home.points += pointsWin; away.points += pointsLoss; }
    else if (awayScore > homeScore) { away.wins += 1; home.losses += 1; away.points += pointsWin; home.points += pointsLoss; }
    else { home.draws += 1; away.draws += 1; home.points += pointsDraw; away.points += pointsDraw; }
  });
  const rows = Object.keys(standings).map(function(id) {
    standings[id].difference = standings[id].goalsFor - standings[id].goalsAgainst;
    return standings[id];
  });
  const tieBreakers = String(division['Ordre bris égalité'] || 'POINTS,DIFF,BP,NOM')
    .split(',').map(normalize_).filter(Boolean);
  rows.sort(function(a, b) {
    const poolOrder = (a.pool || '').localeCompare(b.pool || '', 'fr');
    if (poolOrder) return poolOrder;
    for (let index = 0; index < tieBreakers.length; index += 1) {
      const rule = tieBreakers[index];
      let difference = 0;
      if (rule === 'POINTS' || rule === 'PTS') difference = b.points - a.points;
      else if (rule === 'DIFF' || rule === 'DIFFERENCE') difference = b.difference - a.difference;
      else if (rule === 'BP' || rule === 'BUTS POUR') difference = b.goalsFor - a.goalsFor;
      else if (rule === 'BC' || rule === 'BUTS CONTRE') difference = a.goalsAgainst - b.goalsAgainst;
      else if (rule === 'V' || rule === 'VICTOIRES') difference = b.wins - a.wins;
      else if (rule === 'NOM') difference = a.teamName.localeCompare(b.teamName, 'fr');
      if (difference) return difference;
    }
    return a.teamName.localeCompare(b.teamName, 'fr');
  });
  const poolRanks = {};
  rows.forEach(function(row) { const pool = row.pool || '_'; poolRanks[pool] = (poolRanks[pool] || 0) + 1; row.rank = poolRanks[pool]; });
  return rows;
}
