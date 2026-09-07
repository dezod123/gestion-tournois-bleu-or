function initialiserClasseur() {
  const spreadsheet = SpreadsheetApp.getActive();
  Object.keys(APP.headers).filter(function(sheetName) {
    return sheetName !== APP.sheets.publicData;
  }).forEach(function(sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
    const headers = APP.headers[sheetName];
    const firstRow = sheet.getRange(1, 1, 1, headers.length);
    if (firstRow.getValues()[0].every(function(value) { return value === ''; })) firstRow.setValues([headers]);
    firstRow.setFontWeight('bold').setBackground('#12355b').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  });
  seedSettings_();
  const publicSpreadsheet = ensurePublicSpreadsheet_();
  applyValidations_();
  stylePublicSheet_(publicSpreadsheet);
  onOpen();
  spreadsheet.toast(
    'Le classeur privé et le classeur public sont prêts. Les données existantes ont été conservées.',
    'Initialisation terminée',
    10
  );
}

function seedSettings_() {
  const defaults = [
    ['VERSION_SCHEMA', '1', 'Version du contrat de données publiques'],
    ['LANGUE', 'fr-CA', 'Langue principale du site'],
    ['FUSEAU_HORAIRE', 'America/Toronto', 'Fuseau utilisé pour les dates de publication'],
    ['DERNIERE_PUBLICATION', '', 'Mise à jour automatiquement'],
    ['ID_CLASSEUR_ADMIN_LIE', '', 'Permet de détecter automatiquement une copie du gabarit'],
    ['ID_CLASSEUR_PUBLIC', '', 'Identifiant du classeur ne contenant que les données publiques'],
    ['URL_CLASSEUR_PUBLIC', '', 'Lien pratique vers le classeur public'],
    ['MESSAGE_PUBLIC', '', 'Message facultatif affiché sur le site']
  ];
  const current = rowsAsObjects_(APP.sheets.settings).map(function(row) { return normalize_(row['Clé']); });
  const sheet = SpreadsheetApp.getActive().getSheetByName(APP.sheets.settings);
  defaults.forEach(function(row) {
    if (current.indexOf(normalize_(row[0])) < 0) sheet.appendRow(row);
  });
}

function applyValidations_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const checkboxValidation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  [
    [APP.sheets.tournaments, 5], [APP.sheets.divisions, 4], [APP.sheets.divisions, 5],
    [APP.sheets.venues, 5], [APP.sheets.venues, 6], [APP.sheets.teams, 8],
    [APP.sheets.matches, 14], [APP.sheets.matches, 16], [APP.sheets.photos, 8]
  ].forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec[0]);
    sheet.getRange(2, spec[1], sheet.getMaxRows() - 1, 1).setDataValidation(checkboxValidation);
  });
  [
    [APP.sheets.tournaments, 4, ['ACTIF', 'INACTIF']],
    [APP.sheets.registrations, 14, ['EN ATTENTE', 'APPROUVÉE', 'REFUSÉE']],
    [APP.sheets.teams, 7, ['APPROUVÉE', 'INACTIVE']],
    [APP.sheets.matches, 5, ['POOL', 'DEMI-FINALE', 'FINALE', 'AMICAL']]
  ].forEach(function(spec) {
    const validation = SpreadsheetApp.newDataValidation().requireValueInList(spec[2], true).setAllowInvalid(false).build();
    const sheet = spreadsheet.getSheetByName(spec[0]);
    sheet.getRange(2, spec[1], sheet.getMaxRows() - 1, 1).setDataValidation(validation);
  });
}

function ensurePublicSpreadsheet_() {
  const adminSpreadsheetId = SpreadsheetApp.getActive().getId();
  const linkedAdminId = String(setting_('ID_CLASSEUR_ADMIN_LIE', '')).trim();
  const existingId = String(setting_('ID_CLASSEUR_PUBLIC', '')).trim();
  if (existingId && linkedAdminId === adminSpreadsheetId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {
      // Le fichier a été déplacé ou supprimé : une nouvelle sortie publique sera créée ci-dessous.
    }
  }
  const adminSpreadsheet = SpreadsheetApp.getActive();
  const publicSpreadsheet = SpreadsheetApp.create(adminSpreadsheet.getName() + ' — DONNÉES PUBLIQUES');
  const sheet = publicSpreadsheet.getSheets()[0];
  sheet.setName(APP.sheets.publicData);
  sheet.getRange(1, 1, 1, APP.headers.DONNEES_PUBLIQUES.length).setValues([APP.headers.DONNEES_PUBLIQUES]);
  upsertSetting_('ID_CLASSEUR_ADMIN_LIE', adminSpreadsheetId, 'Permet de détecter automatiquement une copie du gabarit');
  upsertSetting_('ID_CLASSEUR_PUBLIC', publicSpreadsheet.getId(), 'Identifiant du classeur ne contenant que les données publiques');
  upsertSetting_('URL_CLASSEUR_PUBLIC', publicSpreadsheet.getUrl(), 'Lien pratique vers le classeur public');
  return publicSpreadsheet;
}

function stylePublicSheet_(publicSpreadsheet) {
  const sheet = publicSpreadsheet.getSheetByName(APP.sheets.publicData);
  sheet.setTabColor('#d4a72c');
  sheet.getRange('A1:D1').setNote('Généré automatiquement. Ne pas modifier manuellement. Publier uniquement cet onglet sur le Web.');
  sheet.setColumnWidth(4, 700);
}

function chargerDonneesDemonstration() {
  const ui = SpreadsheetApp.getUi();
  const sheetNames = [APP.sheets.tournaments, APP.sheets.divisions, APP.sheets.venues, APP.sheets.teams, APP.sheets.matches];
  const containsData = sheetNames.some(function(name) { return rowsAsObjects_(name).length > 0; });
  if (containsData) {
    ui.alert('Données non ajoutées',
      'Au moins un onglet contient déjà des données. Le chargement de démonstration ne remplace jamais vos données.', ui.ButtonSet.OK);
    return;
  }
  const answer = ui.alert('Charger les données de démonstration?',
    'Un petit tournoi fictif sera ajouté afin de tester la publication.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  const spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.getSheetByName(APP.sheets.tournaments).getRange(2, 1, 1, APP.headers.TOURNOIS.length).setValues([[
    'T-DEMO', 'Tournoi Bleu & Or', 'Démonstration', 'ACTIF', true,
    new Date(2026, 10, 6), new Date(2026, 10, 8), 'École secondaire', 'Données fictives pour valider le fonctionnement.'
  ]]);
  spreadsheet.getSheetByName(APP.sheets.divisions).getRange(2, 1, 1, APP.headers.DIVISIONS.length).setValues([[
    'D-DEMO', 'T-DEMO', 'Benjamin masculin', true, true, 1, 1, 2, 3, 1, 0, 'POINTS,DIFF,BP,NOM'
  ]]);
  spreadsheet.getSheetByName(APP.sheets.venues).getRange(2, 1, 1, APP.headers.LIEUX.length).setValues([[
    'GYM-1', 'T-DEMO', 'Gymnase 1', '', true, true
  ]]);
  spreadsheet.getSheetByName(APP.sheets.teams).getRange(2, 1, 3, APP.headers.EQUIPES.length).setValues([
    ['E01', 'T-DEMO', 'D-DEMO', 'A', 'Les Aigles', 'École du Parc', 'APPROUVÉE', true],
    ['E02', 'T-DEMO', 'D-DEMO', 'A', 'Les Lynx', 'École des Sommets', 'APPROUVÉE', true],
    ['E03', 'T-DEMO', 'D-DEMO', 'A', 'Le Phénix', 'École Centrale', 'APPROUVÉE', true]
  ]);
  spreadsheet.getSheetByName(APP.sheets.matches).getRange(2, 1, 3, APP.headers.MATCHS.length).setValues([
    ['M01', 'T-DEMO', 'D-DEMO', 'A', 'POOL', '1', new Date(2026, 10, 6), new Date(1899, 11, 30, 17, 0), 'GYM-1', 'E01', 'E02', 3, 1, true, '', true],
    ['M02', 'T-DEMO', 'D-DEMO', 'A', 'POOL', '2', new Date(2026, 10, 7), new Date(1899, 11, 30, 9, 0), 'GYM-1', 'E02', 'E03', '', '', false, '', true],
    ['M03', 'T-DEMO', 'D-DEMO', 'A', 'POOL', '3', new Date(2026, 10, 7), new Date(1899, 11, 30, 11, 0), 'GYM-1', 'E03', 'E01', '', '', false, '', true]
  ]);
  ui.alert('Démonstration ajoutée', 'Vous pouvez maintenant choisir Tournoi → Publier les changements.', ui.ButtonSet.OK);
}

function reparerPositionDonneesDemonstration() {
  const spreadsheet = SpreadsheetApp.getActive();
  const moves = [
    [APP.sheets.tournaments, 'T-DEMO', 2],
    [APP.sheets.divisions, 'D-DEMO', 2],
    [APP.sheets.venues, 'GYM-1', 2],
    [APP.sheets.teams, 'E01', 2],
    [APP.sheets.teams, 'E02', 3],
    [APP.sheets.teams, 'E03', 4],
    [APP.sheets.matches, 'M01', 2],
    [APP.sheets.matches, 'M02', 3],
    [APP.sheets.matches, 'M03', 4]
  ];
  let moved = 0;
  moves.forEach(function(spec) {
    const sheetName = spec[0];
    const id = spec[1];
    const targetRow = spec[2];
    const sheet = spreadsheet.getSheetByName(sheetName);
    const row = rowsAsObjects_(sheetName).find(function(item) {
      return String(item[APP.headers[sheetName][0]] || '') === id;
    });
    if (!row || row.__row === targetRow) return;
    const targetId = sheet.getRange(targetRow, 1).getValue();
    if (targetId !== '' && targetId !== false && String(targetId) !== id) {
      throw new Error(sheetName + ' ligne ' + targetRow + ' contient déjà ' + targetId + '. Réparation annulée.');
    }
    const width = APP.headers[sheetName].length;
    const values = sheet.getRange(row.__row, 1, 1, width).getValues();
    sheet.getRange(targetRow, 1, 1, width).setValues(values);
    sheet.getRange(row.__row, 1, 1, width).clearContent();
    moved += 1;
  });
  spreadsheet.toast(moved + ' ligne(s) de démonstration replacée(s) en haut des onglets.', 'Réparation terminée', 10);
}
