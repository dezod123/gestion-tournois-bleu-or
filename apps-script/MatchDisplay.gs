function actualiserNomsEquipesMatchs() {
  assertAdminContext_();
  const updated = refreshMatchTeamNames_(adminSpreadsheet_());
  SpreadsheetApp.flush();
  adminSpreadsheet_().toast(
    updated + ' ligne(s) de match actualisée(s).',
    'Noms des équipes',
    6
  );
}

function ensureMatchTeamNameColumns_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(APP.sheets.matches);
  if (!sheet || !sheet.getLastColumn()) return;
  ensureColumnAfter_(sheet, 'Équipe domicile', 'Nom équipe domicile');
  ensureColumnAfter_(sheet, 'Équipe visiteuse', 'Nom équipe visiteuse');
}

function ensureColumnAfter_(sheet, referenceHeader, newHeader) {
  const headers = sheetHeaders_(sheet);
  if (headers.indexOf(newHeader) >= 0) return;
  const referenceColumn = headers.indexOf(referenceHeader) + 1;
  if (!referenceColumn) return;
  sheet.insertColumnAfter(referenceColumn);
  sheet.getRange(1, referenceColumn + 1).setValue(newHeader);
}

function refreshMatchTeamNames_(spreadsheet) {
  const matchSheet = spreadsheet.getSheetByName(APP.sheets.matches);
  const teamSheet = spreadsheet.getSheetByName(APP.sheets.teams);
  if (!matchSheet || !teamSheet || matchSheet.getLastRow() < 2) return 0;
  const teamIndex = buildMatchTeamNameIndex_(rowsAsObjects_(APP.sheets.teams));
  const rowCount = matchSheet.getLastRow() - 1;
  const homeIds = matchSheet.getRange(2, headerColumn_(matchSheet, 'Équipe domicile'), rowCount, 1).getValues();
  const awayIds = matchSheet.getRange(2, headerColumn_(matchSheet, 'Équipe visiteuse'), rowCount, 1).getValues();
  const homeNames = [];
  const awayNames = [];
  for (let index = 0; index < rowCount; index += 1) {
    homeNames.push([matchTeamNameForId_(homeIds[index][0], teamIndex)]);
    awayNames.push([matchTeamNameForId_(awayIds[index][0], teamIndex)]);
  }
  matchSheet.getRange(2, headerColumn_(matchSheet, 'Nom équipe domicile'), rowCount, 1).setValues(homeNames);
  matchSheet.getRange(2, headerColumn_(matchSheet, 'Nom équipe visiteuse'), rowCount, 1).setValues(awayNames);
  return homeIds.filter(function(row, index) { return row[0] || awayIds[index][0]; }).length;
}

function buildMatchTeamNameIndex_(teams) {
  const index = {};
  teams.forEach(function(team) {
    const id = String(team['ID équipe'] || '').trim();
    if (!id) return;
    if (Object.prototype.hasOwnProperty.call(index, id)) {
      index[id] = '⚠ ID en double';
      return;
    }
    index[id] = String(team['Nom'] || '').trim() || '⚠ Nom manquant';
  });
  return index;
}

function matchTeamNameForId_(idValue, teamIndex) {
  const id = String(idValue || '').trim();
  if (!id) return '';
  return Object.prototype.hasOwnProperty.call(teamIndex, id) ? teamIndex[id] : '⚠ ID inconnu';
}
