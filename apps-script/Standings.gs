function calculateStandings_(division, teams, matches, disciplineIncidents, drawDecisions) {
  const divisionId = String(division['ID division']);
  const pointsWin = toNumber_(division['Points victoire'], 3);
  const pointsDraw = toNumber_(division['Points nul'], 1);
  const pointsLoss = toNumber_(division['Points défaite'], 0);
  const differenceCapValue = toNumber_(division['Plafond différence par match'], null);
  const differenceCap = differenceCapValue !== null && differenceCapValue > 0 ? differenceCapValue : null;
  const standings = {};
  teams.filter(function(team) { return String(team['ID division']) === divisionId; }).forEach(function(team) {
    const id = String(team['ID équipe']);
    standings[id] = { id: divisionId + ':' + id, tournamentId: String(team['ID tournoi']), divisionId: divisionId,
      pool: String(team['Pool'] || ''), teamId: id, teamName: String(team['Nom'] || ''), played: 0, wins: 0,
      draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, difference: 0, tieBreakDifference: 0,
      fairPlayPoints: 0, points: 0, tieBreakPending: false };
  });
  const allPoolMatches = matches.filter(function(match) {
    return String(match['ID division']) === divisionId && normalize_(match['Phase'] || 'POOL') === 'POOL';
  });
  const preliminaryComplete = allPoolMatches.length > 0 && allPoolMatches.every(function(match) {
    return isYes_(match['Résultat final']) && toNumber_(match['Score domicile'], null) !== null &&
      toNumber_(match['Score visiteuse'], null) !== null;
  });
  const poolMatches = allPoolMatches.filter(function(match) {
    return String(match['ID division']) === divisionId && normalize_(match['Phase'] || 'POOL') === 'POOL' && isYes_(match['Résultat final']);
  });
  poolMatches.forEach(function(match) {
    const home = standings[String(match['ID équipe domicile'])];
    const away = standings[String(match['ID équipe visiteuse'])];
    const homeScore = toNumber_(match['Score domicile'], null);
    const awayScore = toNumber_(match['Score visiteuse'], null);
    if (!home || !away || homeScore === null || awayScore === null) return;
    home.played += 1; away.played += 1;
    home.goalsFor += homeScore; home.goalsAgainst += awayScore;
    away.goalsFor += awayScore; away.goalsAgainst += homeScore;
    const rawDifference = homeScore - awayScore;
    const rankingDifference = differenceCap === null
      ? rawDifference
      : Math.max(-differenceCap, Math.min(differenceCap, rawDifference));
    home.tieBreakDifference += rankingDifference;
    away.tieBreakDifference -= rankingDifference;
    if (homeScore > awayScore) { home.wins += 1; away.losses += 1; home.points += pointsWin; away.points += pointsLoss; }
    else if (awayScore > homeScore) { away.wins += 1; home.losses += 1; away.points += pointsWin; home.points += pointsLoss; }
    else { home.draws += 1; away.draws += 1; home.points += pointsDraw; away.points += pointsDraw; }
  });
  const poolMatchIds = {};
  poolMatches.forEach(function(match) { poolMatchIds[String(match['ID match'] || '').trim()] = true; });
  applyFairPlayPoints_(division, standings, disciplineIncidents || [], poolMatchIds);
  const rows = Object.keys(standings).map(function(id) {
    standings[id].difference = standings[id].goalsFor - standings[id].goalsAgainst;
    return standings[id];
  });
  const byPool = {};
  rows.forEach(function(row) {
    const pool = normalize_(row.pool);
    if (!byPool[pool]) byPool[pool] = [];
    byPool[pool].push(row);
  });
  const ranked = [];
  Object.keys(byPool).sort(function(a, b) { return a.localeCompare(b, 'fr'); }).forEach(function(pool) {
    rankStandingsForScope_(division, byPool[pool], poolMatches, drawDecisions || [], pool).forEach(function(row, index) {
      row.rank = index + 1;
      ranked.push(row);
    });
  });
  if (!preliminaryComplete) ranked.forEach(function(row) { row.tieBreakPending = false; });
   return ranked;
}

function applyFairPlayPoints_(division, standings, incidents, poolMatchIds) {
  const divisionId = String(division['ID division'] || '').trim();
  incidents.forEach(function(incident) {
    if (String(incident['ID division'] || '').trim() !== divisionId || !isYes_(incident['Actif'])) return;
    if (!poolMatchIds[String(incident['ID match'] || '').trim()]) return;
    const standing = standings[String(incident['ID équipe'] || '').trim()];
    if (!standing) return;
    standing.fairPlayPoints += disciplinePenaltyPoints_(division, incident['Sanction']);
  });
}

function disciplinePenaltyPoints_(division, sanction) {
  const normalized = normalize_(sanction).replace(/[-_]/g, ' ');
  if (normalized === 'CARTON JAUNE' || normalized === 'JAUNE') return toNumber_(division['Points carton jaune'], 1);
  if (normalized === 'DEUXIEME JAUNE' || normalized === '2E JAUNE' || normalized === 'SECOND JAUNE') {
    return toNumber_(division['Points deuxième jaune'], 3);
  }
  if (normalized === 'CARTON ROUGE' || normalized === 'CARTON ROUGE DIRECT' || normalized === 'ROUGE') {
    return toNumber_(division['Points carton rouge'], 3);
  }
  return 0;
}

function rankStandingsForScope_(division, rows, matches, drawDecisions, pool) {
  const groups = groupStandingRowsByValue_(rows, function(row) { return row.points; }, true);
  const ranked = [];
  groups.forEach(function(group) {
    if (group.length === 1) ranked.push(group[0]);
    else ranked.push.apply(ranked, resolveStandingTie_(division, group, matches, drawDecisions, pool, 0));
  });
  return ranked;
}

function resolveStandingTie_(division, rows, matches, drawDecisions, pool, depth) {
  if (rows.length < 2) return rows.slice();
  if (depth > 20) return markPendingDraw_(rows);
  const rules = standingTieBreakRules_(division);
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (rule === 'POINTS' || rule === 'PTS') continue;
    let values = {};
    let descending = true;
    if (rule === 'FACE_A_FACE' || rule === 'FACE A FACE' || rule === 'H2H') {
      values = headToHeadPoints_(division, rows, matches);
    } else if (rule === 'DIFF' || rule === 'DIFFERENCE') {
      rows.forEach(function(row) { values[row.teamId] = row.tieBreakDifference; });
    } else if (rule === 'BP' || rule === 'BUTS POUR') {
      rows.forEach(function(row) { values[row.teamId] = row.goalsFor; });
    } else if (rule === 'BC' || rule === 'BUTS CONTRE') {
      descending = false;
      rows.forEach(function(row) { values[row.teamId] = row.goalsAgainst; });
    } else if (rule === 'FAIR PLAY' || rule === 'FAIR_PLAY' || rule === 'DISCIPLINE') {
      descending = false;
      rows.forEach(function(row) { values[row.teamId] = row.fairPlayPoints; });
    } else if (rule === 'TIRAGE' || rule === 'TIRAGE AU SORT') {
      descending = false;
      rows.forEach(function(row) { values[row.teamId] = standingDrawPriority_(row, drawDecisions, pool); });
      if (rows.some(function(row) { return values[row.teamId] === null; }) ||
          new Set(rows.map(function(row) { return values[row.teamId]; })).size !== rows.length) {
        return markPendingDraw_(rows);
      }
    } else if (rule === 'NOM') {
      return rows.slice().sort(function(a, b) { return a.teamName.localeCompare(b.teamName, 'fr'); });
    } else {
      continue;
    }
    const partitions = groupStandingRowsByValue_(rows, function(row) { return values[row.teamId]; }, descending);
    if (partitions.length === 1) continue;
    const resolved = [];
    partitions.forEach(function(partition) {
      if (partition.length === 1) resolved.push(partition[0]);
      else resolved.push.apply(resolved, resolveStandingTie_(division, partition, matches, drawDecisions, pool, depth + 1));
    });
    return resolved;
  }
  return markPendingDraw_(rows);
}

function standingTieBreakRules_(division) {
  return String(division['Ordre bris égalité'] || 'POINTS,FACE_A_FACE,DIFF,BP,BC,FAIR_PLAY,TIRAGE')
    .split(',').map(normalize_).filter(Boolean);
}

function headToHeadPoints_(division, rows, matches) {
  const ids = {};
  const values = {};
  rows.forEach(function(row) { ids[row.teamId] = true; values[row.teamId] = 0; });
  const win = toNumber_(division['Points victoire'], 3);
  const draw = toNumber_(division['Points nul'], 1);
  const loss = toNumber_(division['Points défaite'], 0);
  matches.forEach(function(match) {
    if (!isYes_(match['Résultat final']) || normalize_(match['Phase'] || 'POOL') !== 'POOL') return;
    const home = String(match['ID équipe domicile'] || '').trim();
    const away = String(match['ID équipe visiteuse'] || '').trim();
    if (!ids[home] || !ids[away]) return;
    const homeScore = toNumber_(match['Score domicile'], null);
    const awayScore = toNumber_(match['Score visiteuse'], null);
    if (homeScore === null || awayScore === null) return;
    if (homeScore > awayScore) { values[home] += win; values[away] += loss; }
    else if (awayScore > homeScore) { values[away] += win; values[home] += loss; }
    else { values[home] += draw; values[away] += draw; }
  });
  return values;
}

function standingDrawPriority_(standing, decisions, pool) {
  const divisionId = String(standing.divisionId || '').trim();
  const teamId = String(standing.teamId || '').trim();
  const normalizedPool = normalize_(pool || standing.pool);
  const candidates = decisions.filter(function(decision) {
    return isYes_(decision['Actif']) && String(decision['ID division'] || '').trim() === divisionId &&
      String(decision['ID équipe'] || '').trim() === teamId;
  });
  const exact = candidates.find(function(decision) { return normalize_(decision['Pool']) === normalizedPool; });
  const fallback = candidates.find(function(decision) { return !normalize_(decision['Pool']); });
  const value = toNumber_((exact || fallback || {})['Priorité'], null);
  return value !== null && value > 0 ? value : null;
}

function groupStandingRowsByValue_(rows, valueBuilder, descending) {
  const ordered = rows.slice().sort(function(a, b) {
    const first = valueBuilder(a);
    const second = valueBuilder(b);
    const numeric = descending ? second - first : first - second;
    return numeric || a.teamName.localeCompare(b.teamName, 'fr');
  });
  const groups = [];
  ordered.forEach(function(row) {
    const value = valueBuilder(row);
    const last = groups[groups.length - 1];
    if (!last || last.value !== value) groups.push({ value: value, rows: [row] });
    else last.rows.push(row);
  });
  return groups.map(function(group) { return group.rows; });
}

function markPendingDraw_(rows) {
  return rows.slice().sort(function(a, b) { return a.teamName.localeCompare(b.teamName, 'fr'); }).map(function(row) {
    row.tieBreakPending = true;
    return row;
  });
}
