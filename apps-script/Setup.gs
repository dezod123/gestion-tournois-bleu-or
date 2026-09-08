function initialiserClasseur() {
  assertAdminContext_();
  const spreadsheet = SpreadsheetApp.getActive();
  if (!spreadsheet) throw new Error('Exécutez cette fonction depuis le classeur Google Sheets administratif.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_SPREADSHEET_ID', spreadsheet.getId());
  Object.keys(APP.headers).filter(function(sheetName) {
    return sheetName !== APP.sheets.publicData;
  }).forEach(function(sheetName) {
    ensureSheetSchema_(spreadsheet, sheetName, APP.headers[sheetName]);
  });
  resetRegistrationFormsForCopiedWorkbook_(spreadsheet);
  seedSettings_();
  const publicSpreadsheet = ensurePublicSpreadsheet_();
  applyValidations_();
  applyFormats_();
  protectSystemColumns_();
  stylePublicSheet_(publicSpreadsheet);
  onOpen();
  spreadsheet.toast(
    'Le classeur privé et le classeur public sont prêts. Les données existantes ont été conservées.',
    'Initialisation terminée',
    10
  );
}

function ensureSheetSchema_(spreadsheet, sheetName, requiredHeaders) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  const lastColumn = sheet.getLastColumn();
  const existingHeaders = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
    return String(value || '').trim();
  }) : [];
  const hasHeader = existingHeaders.some(function(value) { return value !== ''; });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  } else {
    const missingHeaders = requiredHeaders.filter(function(header) {
      return existingHeaders.indexOf(header) < 0;
    });
    if (missingHeaders.length) {
      const firstNewColumn = Math.max(existingHeaders.length, 1) + 1;
      sheet.getRange(1, firstNewColumn, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  }

  const width = Math.max(sheet.getLastColumn(), requiredHeaders.length);
  sheet.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#12355b').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, width);
  return sheet;
}

function seedSettings_() {
  const defaults = [
    ['VERSION_SCHEMA', '1', 'Version du contrat de données publiques'],
    ['VERSION_STRUCTURE_ADMIN', '4', 'Version de la structure du classeur administratif'],
    ['LANGUE', 'fr-CA', 'Langue principale du site'],
    ['FUSEAU_HORAIRE', 'America/Toronto', 'Fuseau utilisé pour les dates de publication'],
    ['DERNIERE_PUBLICATION', '', 'Mise à jour automatiquement'],
    ['ID_CLASSEUR_ADMIN_LIE', '', 'Permet de détecter automatiquement une copie du gabarit'],
    ['ID_CLASSEUR_PUBLIC', '', 'Identifiant du classeur ne contenant que les données publiques'],
    ['URL_CLASSEUR_PUBLIC', '', 'Lien pratique vers le classeur public'],
    ['MESSAGE_PUBLIC', '', 'Message facultatif affiché sur le site']
  ];
  const current = rowsAsObjects_(APP.sheets.settings).map(function(row) { return normalize_(row['Clé']); });
  const sheet = adminSpreadsheet_().getSheetByName(APP.sheets.settings);
  defaults.forEach(function(row) {
    if (current.indexOf(normalize_(row[0])) < 0) sheet.appendRow(row);
  });
  upsertSetting_('VERSION_STRUCTURE_ADMIN', '4', 'Version de la structure du classeur administratif');
}

function resetRegistrationFormsForCopiedWorkbook_(spreadsheet) {
  const linkedAdminId = String(setting_('ID_CLASSEUR_ADMIN_LIE', '')).trim();
  if (!linkedAdminId || linkedAdminId === spreadsheet.getId()) return;
  const sheet = spreadsheet.getSheetByName(APP.sheets.tournaments);
  const headers = ['ID formulaire inscription', 'URL formulaire inscription', 'URL modification formulaire', 'Dernière mise à jour formulaire'];
  headers.forEach(function(header) {
    const column = headerColumn_(sheet, header);
    sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).clearContent();
  });
}

function applyValidations_() {
  const spreadsheet = adminSpreadsheet_();
  const checkboxValidation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  [
    [APP.sheets.tournaments, 'Afficher'], [APP.sheets.tournaments, 'Inscriptions ouvertes'],
    [APP.sheets.divisions, 'Actif'], [APP.sheets.divisions, 'Afficher'],
    [APP.sheets.venues, 'Actif'], [APP.sheets.venues, 'Afficher'], [APP.sheets.availability, 'Actif'],
    [APP.sheets.teams, 'Afficher'], [APP.sheets.matches, 'Résultat final'],
    [APP.sheets.matches, 'Afficher'], [APP.sheets.photos, 'Afficher']
  ].forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec[0]);
    applyValidationToColumn_(sheet, spec[1], checkboxValidation);
  });
  [
    [APP.sheets.tournaments, 'Statut', ['ACTIF', 'INACTIF']],
    [APP.sheets.registrations, 'Statut', ['EN ATTENTE', 'APPROUVÉE', 'REFUSÉE']],
    [APP.sheets.teams, 'Statut', ['APPROUVÉE', 'INACTIVE']],
    [APP.sheets.matches, 'Phase', ['POOL', 'DEMI-FINALE', 'FINALE', 'AMICAL']]
  ].forEach(function(spec) {
    const validation = SpreadsheetApp.newDataValidation().requireValueInList(spec[2], true).setAllowInvalid(false).build();
    const sheet = spreadsheet.getSheetByName(spec[0]);
    applyValidationToColumn_(sheet, spec[1], validation);
  });

  const positiveNumber = SpreadsheetApp.newDataValidation().requireNumberGreaterThan(0).setAllowInvalid(false).build();
  applyValidationToColumn_(spreadsheet.getSheetByName(APP.sheets.tournaments), 'Durée match par défaut (minutes)', positiveNumber);
  applyValidationToColumn_(spreadsheet.getSheetByName(APP.sheets.divisions), 'Durée match (minutes)', positiveNumber);

  applyReferenceValidations_();
}

function applyValidationToColumn_(sheet, header, validation) {
  const column = headerColumn_(sheet, header);
  sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(validation);
}

function applyReferenceValidations_() {
  const spreadsheet = adminSpreadsheet_();
  const references = [
    [APP.sheets.divisions, 'ID tournoi', APP.sheets.tournaments, 'ID tournoi'],
    [APP.sheets.venues, 'ID tournoi', APP.sheets.tournaments, 'ID tournoi'],
    [APP.sheets.availability, 'ID tournoi', APP.sheets.tournaments, 'ID tournoi'],
    [APP.sheets.availability, 'ID lieu', APP.sheets.venues, 'ID lieu'],
    [APP.sheets.registrations, 'ID tournoi', APP.sheets.tournaments, 'ID tournoi'],
    [APP.sheets.registrations, 'ID division', APP.sheets.divisions, 'ID division'],
    [APP.sheets.teams, 'ID tournoi', APP.sheets.tournaments, 'ID tournoi'],
    [APP.sheets.teams, 'ID division', APP.sheets.divisions, 'ID division'],
    [APP.sheets.matches, 'ID tournoi', APP.sheets.tournaments, 'ID tournoi'],
    [APP.sheets.matches, 'ID division', APP.sheets.divisions, 'ID division'],
    [APP.sheets.matches, 'ID lieu', APP.sheets.venues, 'ID lieu'],
    [APP.sheets.matches, 'Équipe domicile', APP.sheets.teams, 'ID équipe'],
    [APP.sheets.matches, 'Équipe visiteuse', APP.sheets.teams, 'ID équipe'],
    [APP.sheets.photos, 'ID tournoi', APP.sheets.tournaments, 'ID tournoi'],
    [APP.sheets.photos, 'ID division', APP.sheets.divisions, 'ID division'],
    [APP.sheets.photos, 'ID équipe', APP.sheets.teams, 'ID équipe']
  ];

  references.forEach(function(spec) {
    const targetSheet = spreadsheet.getSheetByName(spec[0]);
    const sourceSheet = spreadsheet.getSheetByName(spec[2]);
    const sourceColumn = headerColumn_(sourceSheet, spec[3]);
    const sourceRange = sourceSheet.getRange(2, sourceColumn, Math.max(sourceSheet.getMaxRows() - 1, 1), 1);
    const validation = SpreadsheetApp.newDataValidation()
      .requireValueInRange(sourceRange, true)
      .setAllowInvalid(false)
      .build();
    applyValidationToColumn_(targetSheet, spec[1], validation);
  });
}

function applyFormats_() {
  const spreadsheet = adminSpreadsheet_();
  [
    [APP.sheets.tournaments, 'Date début'],
    [APP.sheets.tournaments, 'Date fin'],
    [APP.sheets.tournaments, 'Date limite inscription'],
    [APP.sheets.availability, 'Date'],
    [APP.sheets.matches, 'Date'],
    [APP.sheets.photos, 'Date']
  ].forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec[0]);
    sheet.getRange(2, headerColumn_(sheet, spec[1]), Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd');
  });
  [
    [APP.sheets.registrations, 'Horodatage'],
    [APP.sheets.registrations, 'Date traitement'],
    [APP.sheets.tournaments, 'Dernière mise à jour formulaire']
  ].forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec[0]);
    sheet.getRange(2, headerColumn_(sheet, spec[1]), Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm');
  });
  [
    [APP.sheets.availability, 'Heure début'],
    [APP.sheets.availability, 'Heure fin'],
    [APP.sheets.availability, 'Pause début'],
    [APP.sheets.availability, 'Pause fin'],
    [APP.sheets.matches, 'Heure']
  ].forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec[0]);
    sheet.getRange(2, headerColumn_(sheet, spec[1]), Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('hh:mm');
  });
}

function ensurePublicSpreadsheet_() {
  const adminSpreadsheetId = adminSpreadsheet_().getId();
  const linkedAdminId = String(setting_('ID_CLASSEUR_ADMIN_LIE', '')).trim();
  const existingId = String(setting_('ID_CLASSEUR_PUBLIC', '')).trim();
  if (existingId && linkedAdminId === adminSpreadsheetId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {
      // Le fichier a été déplacé ou supprimé : une nouvelle sortie publique sera créée ci-dessous.
    }
  }
  const adminSpreadsheet = adminSpreadsheet_();
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
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  const sheetNames = [
    APP.sheets.tournaments, APP.sheets.divisions, APP.sheets.venues,
    APP.sheets.availability, APP.sheets.teams, APP.sheets.matches
  ];
  const containsData = sheetNames.some(function(name) { return rowsAsObjects_(name).length > 0; });
  if (containsData) {
    ui.alert('Données non ajoutées',
      'Au moins un onglet contient déjà des données. Le chargement de démonstration ne remplace jamais vos données.', ui.ButtonSet.OK);
    return;
  }
  const answer = ui.alert('Charger les données de démonstration?',
    'Un petit tournoi fictif sera ajouté afin de tester la publication.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  writeObjectRow_(APP.sheets.tournaments, {
    'ID tournoi': 'T-DEMO', 'Nom': 'Tournoi Bleu & Or', 'Édition': 'Démonstration',
    'Statut': 'ACTIF', 'Afficher': true, 'Date début': new Date(2026, 10, 6),
    'Date fin': new Date(2026, 10, 8), 'Lieu principal': 'École secondaire',
    'Description publique': 'Données fictives pour valider le fonctionnement.',
    'Durée match par défaut (minutes)': 30, 'Inscriptions ouvertes': true,
    'Date limite inscription': new Date(2026, 9, 15), 'Frais inscription': 150,
    'Instructions paiement': 'Paiement à confirmer avec l’organisation.',
    'Courriel contact inscriptions': 'tournoi@example.com'
  }, 2);
  writeObjectRow_(APP.sheets.divisions, {
    'ID division': 'D-DEMO', 'ID tournoi': 'T-DEMO', 'Nom': 'Benjamin masculin',
    'Actif': true, 'Afficher': true, 'Nombre de pools': 1, 'Matchs entre équipes': 1,
    'Équipes qualifiées': 2, 'Points victoire': 3, 'Points nul': 1,
    'Points défaite': 0, 'Ordre bris égalité': 'POINTS,DIFF,BP,NOM'
  }, 2);
  writeObjectRow_(APP.sheets.venues, {
    'ID lieu': 'GYM-1', 'ID tournoi': 'T-DEMO', 'Nom': 'Gymnase 1',
    'Adresse publique': '', 'Actif': true, 'Afficher': true
  }, 2);
  writeObjectRow_(APP.sheets.availability, {
    'ID plage': 'PLG-DEMO', 'ID tournoi': 'T-DEMO', 'ID lieu': 'GYM-1',
    'Date': new Date(2026, 10, 6), 'Heure début': new Date(1899, 11, 30, 16, 30),
    'Heure fin': new Date(1899, 11, 30, 21, 30), 'Actif': true,
    'Notes': 'Plage fictive pour tester le générateur d’horaire.'
  }, 2);
  [
    ['E01', 'Les Aigles', 'École du Parc'],
    ['E02', 'Les Lynx', 'École des Sommets'],
    ['E03', 'Le Phénix', 'École Centrale']
  ].forEach(function(team, index) {
    writeObjectRow_(APP.sheets.teams, {
      'ID équipe': team[0], 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO',
      'Pool': 'A', 'Nom': team[1], 'École': team[2], 'Statut': 'APPROUVÉE', 'Afficher': true
    }, index + 2);
  });
  [
    ['M01', '1', new Date(2026, 10, 6), new Date(1899, 11, 30, 17, 0), 'E01', 'E02', 3, 1, true],
    ['M02', '2', new Date(2026, 10, 7), new Date(1899, 11, 30, 9, 0), 'E02', 'E03', '', '', false],
    ['M03', '3', new Date(2026, 10, 7), new Date(1899, 11, 30, 11, 0), 'E03', 'E01', '', '', false]
  ].forEach(function(match, index) {
    writeObjectRow_(APP.sheets.matches, {
      'ID match': match[0], 'ID tournoi': 'T-DEMO', 'ID division': 'D-DEMO',
      'Pool': 'A', 'Phase': 'POOL', 'Ronde': match[1], 'Date': match[2], 'Heure': match[3],
      'ID lieu': 'GYM-1', 'Équipe domicile': match[4], 'Équipe visiteuse': match[5],
      'Score domicile': match[6], 'Score visiteuse': match[7], 'Résultat final': match[8], 'Afficher': true
    }, index + 2);
  });
  ui.alert('Démonstration ajoutée', 'Vous pouvez maintenant choisir Tournoi → Publier les changements.', ui.ButtonSet.OK);
}

function reparerPositionDonneesDemonstration() {
  assertAdminContext_();
  const spreadsheet = SpreadsheetApp.getActive();
  const moves = [
    [APP.sheets.tournaments, 'T-DEMO', 2],
    [APP.sheets.divisions, 'D-DEMO', 2],
    [APP.sheets.venues, 'GYM-1', 2],
    [APP.sheets.availability, 'PLG-DEMO', 2],
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
