const ID_ENTITIES = Object.freeze([
  { sheet: 'TOURNOIS', header: 'ID tournoi', prefix: 'TRN' },
  { sheet: 'DIVISIONS', header: 'ID division', prefix: 'DIV' },
  { sheet: 'LIEUX', header: 'ID lieu', prefix: 'LIEU' },
  { sheet: 'PLAGES_HORAIRES', header: 'ID plage', prefix: 'PLG' },
  { sheet: 'INSCRIPTIONS', header: 'ID inscription', prefix: 'INS' },
  { sheet: 'EQUIPES', header: 'ID équipe', prefix: 'EQ' },
  { sheet: 'MATCHS', header: 'ID match', prefix: 'MAT' },
  { sheet: 'PHOTOS', header: 'ID photo', prefix: 'PHO' }
]);

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid().toUpperCase();
}

function rowContainsBusinessData_(row, idColumnIndex) {
  return row.some(function(value, index) {
    return index !== idColumnIndex && !isEmptyBusinessValue_(value);
  });
}

function genererIdentifiantsManquants() {
  assertAdminContext_();
  const spreadsheet = adminSpreadsheet_();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    SpreadsheetApp.getUi().alert('Une autre opération est en cours. Réessayez dans quelques secondes.');
    return;
  }

  let generated = 0;
  const updates = [];
  try {
    ID_ENTITIES.forEach(function(entity) {
      const sheet = spreadsheet.getSheetByName(entity.sheet);
      if (!sheet) throw new Error('Onglet manquant : ' + entity.sheet + '. Exécutez d’abord l’initialisation.');
      const headers = sheetHeaders_(sheet);
      const idColumn = headers.indexOf(entity.header);
      if (idColumn < 0) throw new Error('Colonne manquante dans ' + entity.sheet + ' : ' + entity.header);
      const lastRow = Math.max(sheet.getLastRow(), 2);
      const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      const seen = {};
      let changed = false;

      values.forEach(function(row, index) {
        const id = String(row[idColumn] || '').trim();
        if (id) {
          const key = normalize_(id);
          if (seen[key]) {
            throw new Error(entity.sheet + ' : identifiant en double « ' + id + ' » aux lignes ' + seen[key] + ' et ' + (index + 2) + '.');
          }
          seen[key] = index + 2;
          return;
        }
        if (!rowContainsBusinessData_(row, idColumn)) return;

        let newId = newId_(entity.prefix);
        while (seen[normalize_(newId)]) newId = newId_(entity.prefix);
        row[idColumn] = newId;
        seen[normalize_(newId)] = index + 2;
        generated += 1;
        changed = true;
      });

      if (changed) updates.push({ sheet: sheet, values: values, width: headers.length });
    });
    updates.forEach(function(update) {
      update.sheet.getRange(2, 1, update.values.length, update.width).setValues(update.values);
    });
    SpreadsheetApp.flush();
    spreadsheet.toast(
      generated ? generated + ' identifiant(s) généré(s).' : 'Tous les identifiants sont déjà présents.',
      'Identifiants',
      8
    );
  } finally {
    lock.releaseLock();
  }
}

function creerNouvelleEdition() {
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  const namePrompt = ui.prompt('Nouvelle édition', 'Nom public du tournoi :', ui.ButtonSet.OK_CANCEL);
  if (namePrompt.getSelectedButton() !== ui.Button.OK) return;
  const name = namePrompt.getResponseText().trim();
  if (!name) {
    ui.alert('Le nom du tournoi est obligatoire.');
    return;
  }

  const editionPrompt = ui.prompt(
    'Nouvelle édition',
    'Nom de l’édition (par exemple 2027 ou Automne 2027) :',
    ui.ButtonSet.OK_CANCEL
  );
  if (editionPrompt.getSelectedButton() !== ui.Button.OK) return;
  const edition = editionPrompt.getResponseText().trim();
  if (!edition) {
    ui.alert('Le nom de l’édition est obligatoire.');
    return;
  }

  const id = newId_('TRN');
  const row = writeObjectRow_(APP.sheets.tournaments, {
    'ID tournoi': id,
    'Nom': name,
    'Édition': edition,
    'Statut': 'INACTIF',
    'Afficher': false,
    'Durée match par défaut (minutes)': 30,
    'Inscriptions ouvertes': false
  });
  const spreadsheet = adminSpreadsheet_();
  const tournamentSheet = spreadsheet.getSheetByName(APP.sheets.tournaments);
  spreadsheet.setActiveSheet(tournamentSheet);
  spreadsheet.setActiveRange(tournamentSheet.getRange(row, headerColumn_(tournamentSheet, 'Nom')));
  spreadsheet.toast(
    'Édition créée à la ligne ' + row + '. Complétez les dates et la configuration avant de l’activer.',
    'Nouvelle édition',
    10
  );
}

function protectSystemColumns_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const protectedColumns = ID_ENTITIES.concat([
    { sheet: APP.sheets.teams, header: 'ID inscription source' },
    { sheet: APP.sheets.registrations, header: 'ID soumission' },
    { sheet: APP.sheets.registrations, header: 'Horodatage' },
    { sheet: APP.sheets.registrations, header: 'Date traitement' },
    { sheet: APP.sheets.registrations, header: 'Compte traitement' }
  ]);

  protectedColumns.forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec.sheet);
    if (!sheet) return;
    const column = headerColumn_(sheet, spec.header);
    const description = 'SYSTEME:' + spec.sheet + ':' + spec.header;
    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(protection) {
      if (protection.getDescription() === description && protection.canEdit()) protection.remove();
    });
    const range = sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1);
    range.setBackground('#eef1f4');
    range.protect().setDescription(description).setWarningOnly(true);
    sheet.getRange(1, column).setNote('Colonne gérée automatiquement par le système. Ne pas modifier un identifiant existant.');
  });
}
