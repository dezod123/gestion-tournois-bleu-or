function synchroniserEquipesMatchs() {
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  try {
    const result = synchroniserSelectionsEquipesMatchs_(adminSpreadsheet_());
    SpreadsheetApp.flush();
    adminSpreadsheet_().toast(
      result.updated + ' ligne(s) de match synchronisée(s).',
      'Équipes des matchs',
      6
    );
  } catch (error) {
    ui.alert('Synchronisation impossible', error.message || String(error), ui.ButtonSet.OK);
  }
}

function actualiserNomsEquipesMatchs() {
  // Compatibilité avec le nom de commande de la version précédente.
  return synchroniserEquipesMatchs();
}

function ensureMatchTeamNameColumns_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(APP.sheets.matches);
  if (!sheet || !sheet.getLastColumn()) return;
  migrateMatchTeamColumns_(sheet, 'Équipe domicile', 'Nom équipe domicile', 'ID équipe domicile');
  migrateMatchTeamColumns_(sheet, 'Équipe visiteuse', 'Nom équipe visiteuse', 'ID équipe visiteuse');
}

function migrateMatchTeamColumns_(sheet, legacyIdHeader, legacyNameHeader, technicalIdHeader) {
  const headers = sheetHeaders_(sheet);
  if (headers.indexOf(technicalIdHeader) >= 0) return;
  const legacyIdColumn = headers.indexOf(legacyIdHeader) + 1;
  if (!legacyIdColumn) return;
  const legacyNameColumn = headers.indexOf(legacyNameHeader) + 1;
  sheet.getRange(1, legacyIdColumn).setValue(technicalIdHeader);
  if (legacyNameColumn) {
    sheet.getRange(1, legacyNameColumn).setValue(legacyIdHeader);
  } else {
    sheet.insertColumnAfter(legacyIdColumn);
    sheet.getRange(1, legacyIdColumn + 1).setValue(legacyIdHeader);
  }
}

function styleMatchTeamNameColumns_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(APP.sheets.matches);
  if (!sheet) return;
  ['Équipe domicile', 'Équipe visiteuse', 'Équipe forfait', 'Équipe gagnante'].forEach(function(header) {
    const column = headerColumn_(sheet, header);
    sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setBackground('#ffffff');
    sheet.getRange(1, column).setNote('Sélectionnez le nom de l’équipe. L’ID voisin est rempli automatiquement lors de la synchronisation ou de la publication.');
  });
}

function refreshMatchTeamNamesFromIds_(spreadsheet) {
  const matchSheet = spreadsheet.getSheetByName(APP.sheets.matches);
  if (!matchSheet || matchSheet.getLastRow() < 2) return 0;
  const teamLookup = buildMatchTeamLookup_(rowsAsObjects_(APP.sheets.teams));
  const rowCount = matchSheet.getLastRow() - 1;
  const homeIds = matchSheet.getRange(2, headerColumn_(matchSheet, 'ID équipe domicile'), rowCount, 1).getValues();
  const awayIds = matchSheet.getRange(2, headerColumn_(matchSheet, 'ID équipe visiteuse'), rowCount, 1).getValues();
  const forfeitIds = matchSheet.getRange(2, headerColumn_(matchSheet, 'ID équipe forfait'), rowCount, 1).getValues();
  const winnerIds = matchSheet.getRange(2, headerColumn_(matchSheet, 'ID équipe gagnante'), rowCount, 1).getValues();
  const homeNames = [];
  const awayNames = [];
  const forfeitNames = [];
  const winnerNames = [];
  for (let index = 0; index < rowCount; index += 1) {
    homeNames.push([matchTeamNameForId_(homeIds[index][0], teamLookup.byId)]);
    awayNames.push([matchTeamNameForId_(awayIds[index][0], teamLookup.byId)]);
    forfeitNames.push([matchTeamNameForId_(forfeitIds[index][0], teamLookup.byId)]);
    winnerNames.push([matchTeamNameForId_(winnerIds[index][0], teamLookup.byId)]);
  }
  matchSheet.getRange(2, headerColumn_(matchSheet, 'Équipe domicile'), rowCount, 1).setValues(homeNames);
  matchSheet.getRange(2, headerColumn_(matchSheet, 'Équipe visiteuse'), rowCount, 1).setValues(awayNames);
  matchSheet.getRange(2, headerColumn_(matchSheet, 'Équipe forfait'), rowCount, 1).setValues(forfeitNames);
  matchSheet.getRange(2, headerColumn_(matchSheet, 'Équipe gagnante'), rowCount, 1).setValues(winnerNames);
  return homeIds.filter(function(row, index) { return row[0] || awayIds[index][0]; }).length;
}

function synchroniserSelectionsEquipesMatchs_(spreadsheet) {
  const matchSheet = spreadsheet.getSheetByName(APP.sheets.matches);
  if (!matchSheet || matchSheet.getLastRow() < 2) return { updated: 0 };
  const matches = rowsAsObjects_(APP.sheets.matches);
  const teamLookup = buildMatchTeamLookup_(rowsAsObjects_(APP.sheets.teams));
  const updates = [];
  const errors = [];
  matches.forEach(function(match) {
    const hasTeams = [
      match['ID équipe domicile'], match['Équipe domicile'],
      match['ID équipe visiteuse'], match['Équipe visiteuse'],
      match['ID équipe forfait'], match['Équipe forfait'],
      match['ID équipe gagnante'], match['Équipe gagnante']
    ].some(function(value) { return String(value || '').trim(); });
    if (!matchHasBusinessData_(match) || !hasTeams) return;
    try {
      const context = {
        tournamentId: String(match['ID tournoi'] || '').trim(),
        divisionId: String(match['ID division'] || '').trim(),
        pool: normalize_(match['Pool'])
      };
      const home = resolveMatchTeamSelection_(context, match['ID équipe domicile'], match['Équipe domicile'], teamLookup);
      const away = resolveMatchTeamSelection_(context, match['ID équipe visiteuse'], match['Équipe visiteuse'], teamLookup);
      const forfeit = resolveMatchTeamSelection_(context, match['ID équipe forfait'], match['Équipe forfait'], teamLookup);
      let winner = isYes_(match['Résultat final'])
        ? resolveMatchTeamSelection_(context, match['ID équipe gagnante'], match['Équipe gagnante'], teamLookup)
        : { id: '', name: '' };
      if (home.id && away.id && home.id === away.id) throw new Error('les équipes domicile et visiteuse doivent être différentes.');
      if (forfeit.id && forfeit.id !== home.id && forfeit.id !== away.id) {
        throw new Error('l’équipe forfait doit être l’une des deux équipes du match.');
      }
      if (winner.id && winner.id !== home.id && winner.id !== away.id) {
        throw new Error('l’équipe gagnante doit être l’une des deux équipes du match.');
      }
      let homeScore = match['Score domicile'];
      let awayScore = match['Score visiteuse'];
      let reason = match['Motif'];
      if (forfeit.id) {
        homeScore = forfeit.id === home.id ? 0 : 3;
        awayScore = forfeit.id === away.id ? 0 : 3;
        reason = 'Forfait';
        if (isYes_(match['Résultat final'])) winner = forfeit.id === home.id ? away : home;
      }
      updates.push({ row: match.__row, home: home, away: away, forfeit: forfeit, winner: winner,
        homeScore: homeScore, awayScore: awayScore, reason: reason });
    } catch (error) {
      errors.push('MATCHS, ligne ' + match.__row + ' : ' + (error.message || String(error)));
    }
  });
  if (errors.length) throw new Error(errors.slice(0, 12).join('\n'));
  writeMatchTeamSelectionUpdates_(matchSheet, updates);
  return { updated: updates.length };
}

function matchHasBusinessData_(match) {
  return Object.keys(match).some(function(header) {
    return header !== '__row' && match[header] !== '' && match[header] !== false && match[header] != null;
  });
}

function buildMatchTeamLookup_(teams) {
  const byId = {};
  const all = [];
  teams.forEach(function(team) {
    const id = String(team['ID équipe'] || '').trim();
    if (!id) return;
    const entry = {
      id: id,
      name: String(team['Nom'] || '').trim(),
      tournamentId: String(team['ID tournoi'] || '').trim(),
      divisionId: String(team['ID division'] || '').trim(),
      pool: normalize_(team['Pool'])
    };
    if (Object.prototype.hasOwnProperty.call(byId, id)) byId[id] = null;
    else byId[id] = entry;
    all.push(entry);
  });
  return { byId: byId, all: all };
}

function resolveMatchTeamSelection_(context, idValue, nameValue, teamLookup) {
  const id = String(idValue || '').trim();
  const name = String(nameValue || '').trim();
  const idTeam = id && Object.prototype.hasOwnProperty.call(teamLookup.byId, id) ? teamLookup.byId[id] : null;
  if (!name) return { id: '', name: '' };
  if (!context.tournamentId || !context.divisionId) {
    throw new Error('sélectionnez le tournoi et la division avant les noms d’équipes.');
  }
  const candidates = teamLookup.all.filter(function(team) {
    return normalize_(team.name) === normalize_(name) && matchTeamFitsContext_(team, context);
  });
  if (candidates.length === 1) return { id: candidates[0].id, name: candidates[0].name };
  if (candidates.length > 1) {
    const current = candidates.find(function(team) { return team.id === id; });
    if (current) return { id: current.id, name: current.name };
    throw new Error('le nom « ' + name + ' » correspond à plusieurs équipes dans ce contexte. Utilisez des noms d’équipes uniques.');
  }
  const nameExistsElsewhere = teamLookup.all.some(function(team) { return normalize_(team.name) === normalize_(name); });
  if (!nameExistsElsewhere && idTeam && matchTeamFitsContext_(idTeam, context)) {
    // Le nom de l’équipe a probablement été modifié dans EQUIPES; l’ID existant demeure prioritaire.
    return { id: idTeam.id, name: idTeam.name };
  }
  throw new Error('le nom d’équipe « ' + name + ' » ne correspond à aucune équipe du tournoi et de la division sélectionnés.');
}

function matchTeamFitsContext_(team, context) {
  if (context.tournamentId && team.tournamentId !== context.tournamentId) return false;
  if (context.divisionId && team.divisionId !== context.divisionId) return false;
  if (context.pool && team.pool && team.pool !== context.pool) return false;
  return true;
}

function writeMatchTeamSelectionUpdates_(sheet, updates) {
  if (!updates.length) return;
  const rowCount = sheet.getLastRow() - 1;
  const specs = [
    ['ID équipe domicile', function(update) { return update.home.id; }],
    ['Équipe domicile', function(update) { return update.home.name; }],
    ['ID équipe visiteuse', function(update) { return update.away.id; }],
    ['Équipe visiteuse', function(update) { return update.away.name; }],
    ['ID équipe forfait', function(update) { return update.forfeit.id; }],
    ['Équipe forfait', function(update) { return update.forfeit.name; }],
    ['Score domicile', function(update) { return update.homeScore; }],
    ['Score visiteuse', function(update) { return update.awayScore; }],
    ['Motif', function(update) { return update.reason; }],
    ['ID équipe gagnante', function(update) { return update.winner.id; }],
    ['Équipe gagnante', function(update) { return update.winner.name; }]
  ];
  const updateByRow = {};
  updates.forEach(function(update) { updateByRow[update.row] = update; });
  specs.forEach(function(spec) {
    const column = headerColumn_(sheet, spec[0]);
    const values = sheet.getRange(2, column, rowCount, 1).getValues();
    for (let index = 0; index < rowCount; index += 1) {
      const update = updateByRow[index + 2];
      if (update) values[index][0] = spec[1](update);
    }
    sheet.getRange(2, column, rowCount, 1).setValues(values);
  });
}

function matchTeamNameForId_(idValue, teamIndex) {
  const id = String(idValue || '').trim();
  if (!id) return '';
  if (!Object.prototype.hasOwnProperty.call(teamIndex, id)) return '⚠ ID inconnu';
  if (!teamIndex[id]) return '⚠ ID en double';
  return teamIndex[id].name || '⚠ Nom manquant';
}
