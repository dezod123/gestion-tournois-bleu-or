const SCHEDULE_MAX_POOLS = 26;
const SCHEDULE_MAX_ENCOUNTERS = 20;
const SCHEDULE_MINUTE_STEP = 5;

function genererHoraireTournoiSelectionne() {
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  let tournament;
  let preview;
  try {
    tournament = selectedTournamentForSchedule_();
    preview = buildSchedulePlan_(tournament);
  } catch (error) {
    ui.alert('Horaire non généré', error.message || String(error), ui.ButtonSet.OK);
    return;
  }

  if (!preview.poolAssignments.length && !preview.matches.length) {
    ui.alert('Horaire à jour', 'Aucun pool ni match ne doit être ajouté. Les matchs existants ont été conservés.', ui.ButtonSet.OK);
    return;
  }
  const confirmation = ui.alert(
    'Confirmer la génération de l’horaire',
    schedulePlanSummary_(preview),
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return;

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    ui.alert('Une autre opération est en cours. Réessayez dans quelques secondes.');
    return;
  }
  try {
    const currentTournament = rowsAsObjects_(APP.sheets.tournaments).find(function(row) {
      return String(row['ID tournoi'] || '').trim() === String(tournament['ID tournoi'] || '').trim();
    });
    if (!currentTournament) throw new Error('Le tournoi sélectionné est introuvable.');
    const plan = buildSchedulePlan_(currentTournament);
    applySchedulePlan_(plan);
    SpreadsheetApp.flush();
    ui.alert(
      'Horaire généré',
      plan.poolAssignments.length + ' affectation(s) de pool et ' + plan.matches.length + ' nouveau(x) match(s) ont été enregistrés.\n\n' +
        'Vérifiez l’onglet MATCHS avant de choisir Tournoi → Publier les changements.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('Horaire non généré', error.message || String(error), ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

function selectedTournamentForSchedule_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet && spreadsheet.getActiveSheet();
  const range = spreadsheet && spreadsheet.getActiveRange();
  if (!sheet || sheet.getName() !== APP.sheets.tournaments || !range || range.getRow() < 2) {
    throw new Error('Sélectionnez d’abord une cellule de la ligne du tournoi dans l’onglet TOURNOIS.');
  }
  const tournament = rowsAsObjects_(APP.sheets.tournaments).find(function(row) {
    return row.__row === range.getRow();
  });
  if (!tournament) throw new Error('La ligne sélectionnée ne contient aucun tournoi.');
  cleanScheduleId_(tournament['ID tournoi'], 'ID tournoi');
  return tournament;
}

function buildSchedulePlan_(tournament) {
  const tournamentId = cleanScheduleId_(tournament['ID tournoi'], 'ID tournoi');
  const tournamentName = String(tournament['Nom'] || tournamentId).trim();
  const timeZone = String(setting_('FUSEAU_HORAIRE', Session.getScriptTimeZone()));
  const defaultDuration = scheduleInteger_(tournament['Durée match par défaut (minutes)'], 30, 1, 240,
    'Durée de match par défaut du tournoi');
  const allDivisions = rowsAsObjects_(APP.sheets.divisions).filter(function(division) {
    return String(division['ID tournoi'] || '').trim() === tournamentId;
  });
  const activeDivisions = allDivisions.filter(function(division) { return isYes_(division['Actif']); });
  if (!activeDivisions.length) throw new Error('Le tournoi ne possède aucune division active.');

  const allTournamentTeams = rowsAsObjects_(APP.sheets.teams).filter(function(team) {
    return String(team['ID tournoi'] || '').trim() === tournamentId && isActive_(team['Statut']);
  });
  if (!allTournamentTeams.length) throw new Error('Le tournoi ne possède aucune équipe approuvée.');

  const activeDivisionIds = {};
  activeDivisions.forEach(function(division) {
    const id = cleanScheduleId_(division['ID division'], 'ID division');
    if (activeDivisionIds[id]) throw new Error('Identifiant de division en double : « ' + id + ' ».');
    activeDivisionIds[id] = true;
  });
  const approvedTeamIds = {};
  allTournamentTeams.forEach(function(team) {
    const divisionId = cleanScheduleId_(team['ID division'], 'ID division de l’équipe');
    if (!activeDivisionIds[divisionId]) {
      throw new Error('L’équipe « ' + String(team['Nom'] || team['ID équipe']) + ' » n’appartient pas à une division active du tournoi.');
    }
    const teamId = cleanScheduleId_(team['ID équipe'], 'ID équipe');
    if (approvedTeamIds[teamId]) throw new Error('Identifiant d’équipe en double : « ' + teamId + ' ».');
    approvedTeamIds[teamId] = true;
  });

  const poolAssignments = [];
  const warnings = [];
  const expectedFixtures = [];
  const assignedTeamsById = {};
  const divisionConfigById = {};

  activeDivisions.forEach(function(division) {
    const divisionId = String(division['ID division']).trim();
    const divisionName = String(division['Nom'] || divisionId).trim();
    const poolCount = scheduleInteger_(division['Nombre de pools'], 1, 1, SCHEDULE_MAX_POOLS,
      'Nombre de pools de « ' + divisionName + ' »');
    const encounters = scheduleInteger_(division['Matchs entre équipes'], 1, 1, SCHEDULE_MAX_ENCOUNTERS,
      'Matchs entre équipes de « ' + divisionName + ' »');
    const duration = scheduleInteger_(division['Durée match (minutes)'], defaultDuration, 1, 240,
      'Durée des matchs de « ' + divisionName + ' »');
    divisionConfigById[divisionId] = { id: divisionId, name: divisionName, duration: duration };

    const divisionTeams = allTournamentTeams.filter(function(team) {
      return String(team['ID division'] || '').trim() === divisionId;
    });
    if (!divisionTeams.length) {
      warnings.push('« ' + divisionName + ' » : aucune équipe approuvée, division ignorée.');
      return;
    }
    const assigned = assignTeamsToPools_(divisionTeams, poolCount, divisionName);
    assigned.assignments.forEach(function(assignment) { poolAssignments.push(assignment); });
    assigned.teams.forEach(function(team) { assignedTeamsById[team.id] = team; });

    assigned.poolLabels.forEach(function(pool) {
      const poolTeams = assigned.teams.filter(function(team) { return team.pool === pool; });
      if (poolTeams.length < 2) {
        warnings.push('« ' + divisionName + ' », pool ' + pool + ' : moins de deux équipes, aucun match généré.');
        return;
      }
      roundRobinFixtures_(poolTeams, encounters).forEach(function(fixture) {
        fixture.tournamentId = tournamentId;
        fixture.divisionId = divisionId;
        fixture.divisionName = divisionName;
        fixture.pool = pool;
        fixture.duration = duration;
        expectedFixtures.push(fixture);
      });
    });
  });

  const existingMatches = rowsAsObjects_(APP.sheets.matches).filter(function(match) {
    return String(match['ID tournoi'] || '').trim() === tournamentId;
  });
  const existingPairCounts = scheduleExistingPairCounts_(existingMatches, assignedTeamsById);
  const expectedOrdinals = {};
  const missingFixtures = expectedFixtures.filter(function(fixture) {
    const key = schedulePairKey_(fixture.divisionId, fixture.pool, fixture.homeTeamId, fixture.awayTeamId);
    expectedOrdinals[key] = (expectedOrdinals[key] || 0) + 1;
    return expectedOrdinals[key] > (existingPairCounts[key] || 0);
  });

  let scheduledMatches = [];
  if (missingFixtures.length) {
    const windows = scheduleAvailabilityWindows_(tournamentId, timeZone);
    const occupancy = scheduleExistingOccupancy_(existingMatches, allDivisions, defaultDuration, timeZone);
    validateScheduleOccupancy_(occupancy);
    scheduledMatches = scheduleFixtures_(missingFixtures, windows, occupancy);
  }

  return {
    tournamentId: tournamentId,
    tournamentName: tournamentName,
    teamCount: allTournamentTeams.length,
    existingMatchCount: existingMatches.length,
    poolAssignments: poolAssignments,
    matches: scheduledMatches,
    warnings: warnings,
    timeZone: timeZone
  };
}

function assignTeamsToPools_(teams, poolCount, divisionName) {
  const poolLabels = [];
  for (let index = 0; index < poolCount; index += 1) poolLabels.push(String.fromCharCode(65 + index));
  const counts = {};
  poolLabels.forEach(function(label) { counts[label] = 0; });
  const assignedTeams = teams.map(function(team) {
    const id = cleanScheduleId_(team['ID équipe'], 'ID équipe');
    const currentPool = normalize_(team['Pool']);
    if (currentPool && poolLabels.indexOf(currentPool) < 0) {
      throw new Error('L’équipe « ' + String(team['Nom'] || id) + ' » utilise le pool « ' + currentPool +
        ' », qui dépasse les ' + poolCount + ' pool(s) configuré(s) pour « ' + divisionName + ' ».');
    }
    if (currentPool) counts[currentPool] += 1;
    return {
      id: id,
      name: String(team['Nom'] || id).trim(),
      row: team.__row,
      pool: currentPool
    };
  });
  const assignments = [];
  assignedTeams.filter(function(team) { return !team.pool; }).sort(function(a, b) {
    return a.row - b.row;
  }).forEach(function(team) {
    const pool = poolLabels.slice().sort(function(a, b) {
      return counts[a] - counts[b] || a.localeCompare(b);
    })[0];
    team.pool = pool;
    counts[pool] += 1;
    assignments.push({ row: team.row, teamId: team.id, teamName: team.name, pool: pool });
  });
  assignedTeams.forEach(function(team) {
    const original = teams.find(function(item) { return String(item['ID équipe'] || '').trim() === team.id; });
    if (original && String(original['Pool'] || '').trim() && String(original['Pool']).trim() !== team.pool) {
      assignments.push({ row: team.row, teamId: team.id, teamName: team.name, pool: team.pool });
    }
  });
  return { teams: assignedTeams, assignments: assignments, poolLabels: poolLabels };
}

function roundRobinFixtures_(teams, encounters) {
  const rotation = teams.slice();
  if (rotation.length % 2) rotation.push(null);
  const roundCount = rotation.length - 1;
  const fixtures = [];
  for (let encounter = 0; encounter < encounters; encounter += 1) {
    const roundTeams = rotation.slice();
    for (let round = 0; round < roundCount; round += 1) {
      for (let index = 0; index < roundTeams.length / 2; index += 1) {
        let home = roundTeams[index];
        let away = roundTeams[roundTeams.length - 1 - index];
        if (!home || !away) continue;
        if ((round + index) % 2) {
          const swap = home;
          home = away;
          away = swap;
        }
        if (encounter % 2) {
          const swap = home;
          home = away;
          away = swap;
        }
        fixtures.push({
          homeTeamId: home.id,
          homeTeamName: home.name,
          awayTeamId: away.id,
          awayTeamName: away.name,
          round: encounter * roundCount + round + 1
        });
      }
      roundTeams.splice(1, 0, roundTeams.pop());
    }
  }
  return fixtures;
}

function scheduleExistingPairCounts_(matches, assignedTeamsById) {
  const counts = {};
  matches.forEach(function(match) {
    const phase = normalize_(match['Phase']);
    if (phase && phase !== 'POOL') return;
    const homeId = String(match['Équipe domicile'] || '').trim();
    const awayId = String(match['Équipe visiteuse'] || '').trim();
    const home = assignedTeamsById[homeId];
    const away = assignedTeamsById[awayId];
    if (!home || !away || home.pool !== away.pool) return;
    const divisionId = String(match['ID division'] || '').trim();
    const key = schedulePairKey_(divisionId, home.pool, homeId, awayId);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function schedulePairKey_(divisionId, pool, homeId, awayId) {
  const teams = [String(homeId), String(awayId)].sort();
  return [String(divisionId), normalize_(pool), teams[0], teams[1]].join('|');
}

function scheduleAvailabilityWindows_(tournamentId, timeZone) {
  const activeVenues = {};
  rowsAsObjects_(APP.sheets.venues).forEach(function(venue) {
    if (String(venue['ID tournoi'] || '').trim() !== tournamentId || !isYes_(venue['Actif'])) return;
    const id = cleanScheduleId_(venue['ID lieu'], 'ID lieu');
    activeVenues[id] = String(venue['Nom'] || id).trim();
  });
  const windows = [];
  rowsAsObjects_(APP.sheets.availability).forEach(function(availability) {
    if (String(availability['ID tournoi'] || '').trim() !== tournamentId || !isYes_(availability['Actif'])) return;
    const venueId = cleanScheduleId_(availability['ID lieu'], 'ID lieu de la plage horaire');
    if (!activeVenues[venueId]) {
      throw new Error('Une plage active référence un lieu inactif ou inconnu : « ' + venueId + ' ».');
    }
    const date = toIsoDate_(availability['Date'], timeZone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Une plage active possède une date invalide.');
    const start = scheduleTimeToMinutes_(availability['Heure début'], timeZone, 'Heure début');
    const end = scheduleTimeToMinutes_(availability['Heure fin'], timeZone, 'Heure fin');
    if (end <= start) throw new Error('Une plage active doit se terminer après son heure de début.');
    const pauseStartValue = availability['Pause début'];
    const pauseEndValue = availability['Pause fin'];
    const hasPauseStart = pauseStartValue !== '' && pauseStartValue != null;
    const hasPauseEnd = pauseEndValue !== '' && pauseEndValue != null;
    if (hasPauseStart !== hasPauseEnd) throw new Error('Une pause doit posséder une heure de début et une heure de fin.');
    if (!hasPauseStart) {
      windows.push({ date: date, start: start, end: end, venueId: venueId, venueName: activeVenues[venueId] });
      return;
    }
    const pauseStart = scheduleTimeToMinutes_(pauseStartValue, timeZone, 'Pause début');
    const pauseEnd = scheduleTimeToMinutes_(pauseEndValue, timeZone, 'Pause fin');
    if (pauseStart < start || pauseEnd > end || pauseEnd <= pauseStart) {
      throw new Error('La pause d’une plage active doit être comprise dans la plage et se terminer après son début.');
    }
    if (pauseStart > start) windows.push({ date: date, start: start, end: pauseStart, venueId: venueId, venueName: activeVenues[venueId] });
    if (pauseEnd < end) windows.push({ date: date, start: pauseEnd, end: end, venueId: venueId, venueName: activeVenues[venueId] });
  });
  if (!windows.length) throw new Error('Aucune plage horaire active utilisable n’est configurée pour ce tournoi.');
  return windows.sort(compareScheduleWindows_);
}

function scheduleExistingOccupancy_(matches, divisions, defaultDuration, timeZone) {
  const durations = {};
  divisions.forEach(function(division) {
    const id = String(division['ID division'] || '').trim();
    if (!id) return;
    durations[id] = scheduleInteger_(division['Durée match (minutes)'], defaultDuration, 1, 240,
      'Durée de la division « ' + String(division['Nom'] || id) + ' »');
  });
  return matches.map(function(match) {
    const date = toIsoDate_(match['Date'], timeZone);
    const venueId = String(match['ID lieu'] || '').trim();
    const homeId = String(match['Équipe domicile'] || '').trim();
    const awayId = String(match['Équipe visiteuse'] || '').trim();
    if (!date || !match['Heure'] || !venueId || !homeId || !awayId) return null;
    const start = scheduleTimeToMinutes_(match['Heure'], timeZone, 'Heure du match ' + String(match['ID match'] || ''));
    const duration = durations[String(match['ID division'] || '').trim()] || defaultDuration;
    return {
      source: String(match['ID match'] || 'match existant'), date: date, start: start, end: start + duration,
      venueId: venueId, homeTeamId: homeId, awayTeamId: awayId
    };
  }).filter(Boolean);
}

function validateScheduleOccupancy_(occupancy) {
  for (let first = 0; first < occupancy.length; first += 1) {
    for (let second = first + 1; second < occupancy.length; second += 1) {
      const a = occupancy[first];
      const b = occupancy[second];
      if (a.date !== b.date || !scheduleIntervalsOverlap_(a.start, a.end, b.start, b.end)) continue;
      const sameVenue = a.venueId === b.venueId;
      const sameTeam = [a.homeTeamId, a.awayTeamId].some(function(teamId) {
        return teamId === b.homeTeamId || teamId === b.awayTeamId;
      });
      if (sameVenue || sameTeam) {
        throw new Error('Conflit entre les matchs existants « ' + a.source + ' » et « ' + b.source + ' ». Corrigez-le avant de générer.');
      }
    }
  }
}

function scheduleFixtures_(fixtures, windows, existingOccupancy) {
  const occupancy = existingOccupancy.slice();
  const orderedFixtures = fixtures.slice().sort(function(a, b) {
    return a.round - b.round || a.divisionName.localeCompare(b.divisionName, 'fr') ||
      a.pool.localeCompare(b.pool, 'fr') || a.homeTeamName.localeCompare(b.homeTeamName, 'fr');
  });
  return orderedFixtures.map(function(fixture) {
    let placement = null;
    const candidates = scheduleCandidatesForFixture_(fixture, windows);
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      if (scheduleCandidateConflicts_(candidates[candidateIndex], occupancy)) continue;
      placement = candidates[candidateIndex];
      break;
    }
    if (!placement) {
      throw new Error('Capacité horaire insuffisante pour placer ' + fixture.homeTeamName + ' contre ' + fixture.awayTeamName +
        ' (« ' + fixture.divisionName + ' », pool ' + fixture.pool + '). Ajoutez ou élargissez des plages horaires.');
    }
    occupancy.push(placement);
    return Object.assign({}, fixture, placement);
  });
}

function scheduleCandidatesForFixture_(fixture, windows) {
  const candidates = [];
  windows.forEach(function(window) {
    for (let start = window.start; start + fixture.duration <= window.end; start += SCHEDULE_MINUTE_STEP) {
      candidates.push({
        date: window.date, start: start, end: start + fixture.duration, venueId: window.venueId,
        homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId
      });
    }
  });
  return candidates.sort(function(a, b) {
    return a.date.localeCompare(b.date) || a.start - b.start || a.venueId.localeCompare(b.venueId);
  });
}

function scheduleCandidateConflicts_(candidate, occupancy) {
  return occupancy.some(function(interval) {
    if (candidate.date !== interval.date || !scheduleIntervalsOverlap_(candidate.start, candidate.end, interval.start, interval.end)) return false;
    if (candidate.venueId === interval.venueId) return true;
    return [candidate.homeTeamId, candidate.awayTeamId].some(function(teamId) {
      return teamId === interval.homeTeamId || teamId === interval.awayTeamId;
    });
  });
}

function scheduleIntervalsOverlap_(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function compareScheduleWindows_(a, b) {
  return a.date.localeCompare(b.date) || a.start - b.start || a.venueId.localeCompare(b.venueId);
}

function scheduleTimeToMinutes_(value, timeZone, label) {
  let text = '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    text = Utilities.formatDate(value, timeZone, 'HH:mm');
  } else {
    text = String(value == null ? '' : value).trim();
  }
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error((label || 'Heure') + ' doit utiliser le format HH:mm.');
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error((label || 'Heure') + ' est invalide.');
  return hours * 60 + minutes;
}

function scheduleInteger_(value, fallback, minimum, maximum, label) {
  const resolved = value === '' || value == null ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(label + ' doit être un nombre entier entre ' + minimum + ' et ' + maximum + '.');
  }
  return resolved;
}

function cleanScheduleId_(value, label) {
  const id = String(value == null ? '' : value).trim();
  if (!id) throw new Error((label || 'Identifiant') + ' est obligatoire. Utilisez d’abord Générer les identifiants manquants.');
  return id;
}

function schedulePlanSummary_(plan) {
  const lines = [
    plan.tournamentName,
    '',
    plan.teamCount + ' équipe(s) approuvée(s)',
    plan.poolAssignments.length + ' équipe(s) à affecter automatiquement à un pool',
    plan.matches.length + ' nouveau(x) match(s) à créer',
    plan.existingMatchCount + ' match(s) existant(s) conservé(s) sans modification'
  ];
  if (plan.matches.length) {
    const chronologicalMatches = plan.matches.slice().sort(function(a, b) {
      return a.date.localeCompare(b.date) || a.start - b.start || a.venueId.localeCompare(b.venueId);
    });
    const first = chronologicalMatches[0];
    const last = chronologicalMatches[chronologicalMatches.length - 1];
    lines.push('', 'Horaire proposé : ' + first.date + ' ' + scheduleMinutesLabel_(first.start) +
      ' au ' + last.date + ' ' + scheduleMinutesLabel_(last.start));
  }
  if (plan.warnings.length) lines.push('', 'À noter :', plan.warnings.slice(0, 8).join('\n'));
  lines.push('', 'Continuer?');
  return lines.join('\n');
}

function applySchedulePlan_(plan) {
  const spreadsheet = adminSpreadsheet_();
  const teamSheet = spreadsheet.getSheetByName(APP.sheets.teams);
  const poolColumn = headerColumn_(teamSheet, 'Pool');
  plan.poolAssignments.forEach(function(assignment) {
    teamSheet.getRange(assignment.row, poolColumn).setValue(assignment.pool);
  });
  const matchObjects = plan.matches.map(function(match) {
    return {
      'ID match': newId_('MAT'),
      'ID tournoi': plan.tournamentId,
      'ID division': match.divisionId,
      'Pool': match.pool,
      'Phase': 'POOL',
      'Ronde': String(match.round),
      'Date': scheduleDateValue_(match.date),
      'Heure': scheduleTimeValue_(match.start),
      'ID lieu': match.venueId,
      'Équipe domicile': match.homeTeamId,
      'Nom équipe domicile': match.homeTeamName,
      'Équipe visiteuse': match.awayTeamId,
      'Nom équipe visiteuse': match.awayTeamName,
      'Score domicile': '',
      'Score visiteuse': '',
      'Résultat final': false,
      'Motif': '',
      'Afficher': true
    };
  });
  writeScheduleMatchRows_(matchObjects);
}

function writeScheduleMatchRows_(objects) {
  if (!objects.length) return;
  const sheet = adminSpreadsheet_().getSheetByName(APP.sheets.matches);
  const headers = sheetHeaders_(sheet);
  const width = headers.length;
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const existing = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  const availableRows = [];
  existing.forEach(function(row, index) {
    if (row.every(isEmptyBusinessValue_)) availableRows.push(index + 2);
  });
  let nextRow = lastRow + 1;
  while (availableRows.length < objects.length) {
    availableRows.push(nextRow);
    nextRow += 1;
  }
  if (nextRow - 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), nextRow - 1 - sheet.getMaxRows());

  const rows = availableRows.slice(0, objects.length).map(function(rowNumber, index) {
    const object = objects[index];
    return {
      rowNumber: rowNumber,
      values: headers.map(function(header) {
        return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '';
      })
    };
  }).sort(function(a, b) { return a.rowNumber - b.rowNumber; });

  let group = [];
  const flushGroup = function() {
    if (!group.length) return;
    sheet.getRange(group[0].rowNumber, 1, group.length, width).setValues(group.map(function(item) { return item.values; }));
    group = [];
  };
  rows.forEach(function(item) {
    if (group.length && item.rowNumber !== group[group.length - 1].rowNumber + 1) flushGroup();
    group.push(item);
  });
  flushGroup();
}

function scheduleDateValue_(isoDate) {
  const parts = String(isoDate).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function scheduleTimeValue_(minutes) {
  return new Date(1899, 11, 30, Math.floor(minutes / 60), minutes % 60, 0);
}

function scheduleMinutesLabel_(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const remainder = String(minutes % 60).padStart(2, '0');
  return hours + ':' + remainder;
}
