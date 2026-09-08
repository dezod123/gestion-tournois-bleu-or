function publierChangements() {
  assertAdminContext_();
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('Publier les changements?',
    'Cette action remplacera les données actuellement visibles sur le site public.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    ui.alert('Une autre publication est déjà en cours. Réessayez dans quelques secondes.');
    return;
  }
  try {
    refreshMatchTeamNames_(adminSpreadsheet_());
    const snapshot = buildPublicSnapshot_();
    if (snapshot.errors.length) {
      appendPublicationLog_('ERREUR', snapshot.errors.join(' | '), 0);
      ui.alert('Publication annulée', snapshot.errors.slice(0, 12).join('\n'), ui.ButtonSet.OK);
      return;
    }
    writePublicSnapshot_(snapshot.rows);
    const timeZone = String(setting_('FUSEAU_HORAIRE', Session.getScriptTimeZone()));
    const publishedAt = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
    upsertSetting_('DERNIERE_PUBLICATION', publishedAt, 'Mise à jour automatiquement');
    appendPublicationLog_('SUCCÈS', 'Publication terminée', snapshot.rows.length);
    SpreadsheetApp.flush();
    ui.alert('Publication réussie', snapshot.rows.length + ' objets publics ont été mis à jour.', ui.ButtonSet.OK);
  } catch (error) {
    appendPublicationLog_('ERREUR', error.message || String(error), 0);
    ui.alert('Erreur de publication', error.message || String(error), ui.ButtonSet.OK);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function buildPublicSnapshot_() {
  const timeZone = String(setting_('FUSEAU_HORAIRE', Session.getScriptTimeZone()));
  const tournaments = rowsAsObjects_(APP.sheets.tournaments).filter(function(row) {
    return isActive_(row['Statut']) && isYes_(row['Afficher']);
  });
  const tournamentIds = new Set(tournaments.map(function(row) { return String(row['ID tournoi']); }));
  const divisions = rowsAsObjects_(APP.sheets.divisions).filter(function(row) {
    return tournamentIds.has(String(row['ID tournoi'])) && isYes_(row['Actif']) && isYes_(row['Afficher']);
  });
  const divisionIds = new Set(divisions.map(function(row) { return String(row['ID division']); }));
  const venues = rowsAsObjects_(APP.sheets.venues).filter(function(row) {
    return tournamentIds.has(String(row['ID tournoi'])) && isYes_(row['Actif']) && isYes_(row['Afficher']);
  });
  const teams = rowsAsObjects_(APP.sheets.teams).filter(function(row) {
    return tournamentIds.has(String(row['ID tournoi'])) && divisionIds.has(String(row['ID division'])) &&
      isActive_(row['Statut']) && isYes_(row['Afficher']);
  });
  const teamIds = new Set(teams.map(function(row) { return String(row['ID équipe']); }));
  const matches = rowsAsObjects_(APP.sheets.matches).filter(function(row) {
    return tournamentIds.has(String(row['ID tournoi'])) && divisionIds.has(String(row['ID division'])) && isYes_(row['Afficher']);
  });
  const photos = rowsAsObjects_(APP.sheets.photos).filter(function(row) {
    return tournamentIds.has(String(row['ID tournoi'])) && isYes_(row['Afficher']);
  });
  const errors = validatePublicData_(tournaments, divisions, teams, matches, teamIds);
  if (errors.length) return { errors: errors, rows: [] };

  const publishedAt = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const rows = [publicRow_('meta', 'publication', 0, {
    schemaVersion: String(setting_('VERSION_SCHEMA', '1')),
    applicationVersion: APP.version,
    publishedAt: publishedAt,
    locale: String(setting_('LANGUE', APP.locale)),
    message: String(setting_('MESSAGE_PUBLIC', ''))
  })];
  tournaments.forEach(function(row, index) {
    const registrationDeadline = toIsoDate_(row['Date limite inscription'], timeZone);
    const registrationUrl = String(row['URL formulaire inscription'] || '').trim();
    rows.push(publicRow_('tournoi', row['ID tournoi'], index, { id: String(row['ID tournoi']), name: String(row['Nom']),
      edition: String(row['Édition'] || ''), startDate: toIsoDate_(row['Date début'], timeZone),
      endDate: toIsoDate_(row['Date fin'], timeZone), mainVenue: String(row['Lieu principal'] || ''),
      description: String(row['Description publique'] || ''),
      defaultMatchDurationMinutes: toNumber_(row['Durée match par défaut (minutes)'], null),
      registrationsOpen: isYes_(row['Inscriptions ouvertes']), registrationDeadline: registrationDeadline,
      registrationUrl: /^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(registrationUrl) ? registrationUrl : '' }));
  });
  divisions.forEach(function(row, index) {
    rows.push(publicRow_('division', row['ID division'], index, { id: String(row['ID division']),
      tournamentId: String(row['ID tournoi']), name: String(row['Nom']), poolCount: toNumber_(row['Nombre de pools'], 1),
      qualifiers: toNumber_(row['Équipes qualifiées'], 0),
      matchDurationMinutes: toNumber_(row['Durée match (minutes)'], null) }));
  });
  venues.forEach(function(row, index) {
    rows.push(publicRow_('lieu', row['ID lieu'], index, { id: String(row['ID lieu']), tournamentId: String(row['ID tournoi']),
      name: String(row['Nom']), address: String(row['Adresse publique'] || '') }));
  });
  teams.forEach(function(row, index) {
    rows.push(publicRow_('equipe', row['ID équipe'], index, { id: String(row['ID équipe']), tournamentId: String(row['ID tournoi']),
      divisionId: String(row['ID division']), pool: String(row['Pool'] || ''), name: String(row['Nom']), school: String(row['École'] || '') }));
  });
  matches.forEach(function(row, index) {
    const finalResult = isYes_(row['Résultat final']);
    rows.push(publicRow_('match', row['ID match'], index, { id: String(row['ID match']), tournamentId: String(row['ID tournoi']),
      divisionId: String(row['ID division']), pool: String(row['Pool'] || ''), phase: String(row['Phase'] || 'POOL'),
      round: String(row['Ronde'] || ''), date: toIsoDate_(row['Date'], timeZone), time: toTime_(row['Heure'], timeZone),
      venueId: String(row['ID lieu'] || ''), homeTeamId: String(row['Équipe domicile']), awayTeamId: String(row['Équipe visiteuse']),
      homeScore: finalResult ? toNumber_(row['Score domicile'], null) : null,
      awayScore: finalResult ? toNumber_(row['Score visiteuse'], null) : null,
      final: finalResult, reason: finalResult ? String(row['Motif'] || '') : '' }));
  });
  divisions.forEach(function(division) {
    calculateStandings_(division, teams, matches).forEach(function(row, index) {
      rows.push(publicRow_('classement', row.id, index, row));
    });
  });
  photos.forEach(function(row, index) {
    rows.push(publicRow_('photo', row['ID photo'], index, { id: String(row['ID photo']), tournamentId: String(row['ID tournoi']),
      url: String(row['URL']), title: String(row['Titre'] || ''), divisionId: String(row['ID division'] || ''),
      teamId: String(row['ID équipe'] || ''), date: toIsoDate_(row['Date'], timeZone) }));
  });
  return { errors: [], rows: rows };
}

function validatePublicData_(tournaments, divisions, teams, matches, teamIds) {
  const errors = [];
  validateUniqueIds_(tournaments, 'ID tournoi', APP.sheets.tournaments, errors);
  validateUniqueIds_(divisions, 'ID division', APP.sheets.divisions, errors);
  validateUniqueIds_(teams, 'ID équipe', APP.sheets.teams, errors);
  validateUniqueIds_(matches, 'ID match', APP.sheets.matches, errors);
  matches.forEach(function(match) {
    const label = APP.sheets.matches + ' ligne ' + match.__row;
    const home = String(match['Équipe domicile'] || '');
    const away = String(match['Équipe visiteuse'] || '');
    if (!teamIds.has(home)) errors.push(label + ' : équipe domicile inconnue (' + home + ').');
    if (!teamIds.has(away)) errors.push(label + ' : équipe visiteuse inconnue (' + away + ').');
    if (home && home === away) errors.push(label + ' : une équipe ne peut pas jouer contre elle-même.');
    if (isYes_(match['Résultat final'])) {
      const homeScore = toNumber_(match['Score domicile'], null);
      const awayScore = toNumber_(match['Score visiteuse'], null);
      if (homeScore === null || awayScore === null || homeScore < 0 || awayScore < 0) {
        errors.push(label + ' : un résultat final exige deux scores positifs ou nuls.');
      }
    }
  });
  return errors;
}

function validateUniqueIds_(rows, key, sheetName, errors) {
  const seen = {};
  rows.forEach(function(row) {
    const id = String(row[key] || '').trim();
    if (!id) errors.push(sheetName + ' ligne ' + row.__row + ' : ' + key + ' est obligatoire.');
    else if (seen[id]) errors.push(sheetName + ' : identifiant en double ' + id + '.');
    seen[id] = true;
  });
}

function publicRow_(type, id, order, data) { return [type, String(id), order, jsonString_(data)]; }

function writePublicSnapshot_(rows) {
  const publicSpreadsheetId = String(setting_('ID_CLASSEUR_PUBLIC', '')).trim();
  if (!publicSpreadsheetId) throw new Error('ID_CLASSEUR_PUBLIC est vide. Exécutez initialiserClasseur.');
  const publicSpreadsheet = SpreadsheetApp.openById(publicSpreadsheetId);
  const sheet = publicSpreadsheet.getSheetByName(APP.sheets.publicData);
  if (!sheet) throw new Error('Onglet public manquant : ' + APP.sheets.publicData);
  const headers = APP.headers.DONNEES_PUBLIQUES;
  const values = [headers].concat(rows);
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#12355b').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(4, 700);
}

function appendPublicationLog_(status, message, count) {
  const sheet = adminSpreadsheet_().getSheetByName(APP.sheets.publicationLog);
  if (!sheet) return;
  sheet.appendRow([new Date(), Session.getActiveUser().getEmail() || 'Compte Google autorisé', APP.version, count, status, message]);
}
