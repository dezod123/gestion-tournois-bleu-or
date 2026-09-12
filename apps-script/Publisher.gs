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
    synchroniserReferencesAdministratives_(adminSpreadsheet_());
    SpreadsheetApp.flush();
    synchroniserSelectionsEquipesMatchs_(adminSpreadsheet_());
    SpreadsheetApp.flush();
    mettreAJourSeriesAutomatiques_();
    SpreadsheetApp.flush();
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
  const disciplineIncidents = rowsAsObjects_(APP.sheets.discipline).filter(function(row) {
    return tournamentIds.has(String(row['ID tournoi'])) && divisionIds.has(String(row['ID division'])) && isYes_(row['Actif']);
  });
  const drawDecisions = rowsAsObjects_(APP.sheets.tieBreakDraws).filter(function(row) {
    return tournamentIds.has(String(row['ID tournoi'])) && divisionIds.has(String(row['ID division'])) && isYes_(row['Actif']);
  });
  const errors = validatePublicData_(tournaments, divisions, teams, matches, photos, divisionIds, teamIds,
    disciplineIncidents, drawDecisions);
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
      venueId: String(row['ID lieu'] || ''), homeTeamId: String(row['ID équipe domicile']), awayTeamId: String(row['ID équipe visiteuse']),
      homeScore: finalResult ? toNumber_(row['Score domicile'], null) : null,
      awayScore: finalResult ? toNumber_(row['Score visiteuse'], null) : null,
      final: finalResult, reason: finalResult ? String(row['Motif'] || '') : '',
      forfeitTeamId: finalResult ? String(row['ID équipe forfait'] || '') : '',
      penaltyShootout: finalResult && isYes_(row['Victoire aux tirs au but']),
      seriesCode: String(row['Code série'] || ''), homeSource: String(row['Source domicile'] || ''),
      awaySource: String(row['Source visiteuse'] || ''),
      winnerTeamId: finalResult ? String(row['ID équipe gagnante'] || '') : '' }));
  });
  divisions.forEach(function(division) {
    calculateStandings_(division, teams, matches, disciplineIncidents, drawDecisions).forEach(function(row, index) {
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

function validatePublicData_(tournaments, divisions, teams, matches, photos, divisionIds, teamIds, disciplineIncidents, drawDecisions) {
  const errors = [];
  const teamById = {};
  const divisionById = {};
  teams.forEach(function(team) { teamById[String(team['ID équipe'] || '').trim()] = team; });
  divisions.forEach(function(division) { divisionById[String(division['ID division'] || '').trim()] = division; });
  validateUniqueIds_(tournaments, 'ID tournoi', APP.sheets.tournaments, errors);
  validateUniqueIds_(divisions, 'ID division', APP.sheets.divisions, errors);
  validateUniqueIds_(teams, 'ID équipe', APP.sheets.teams, errors);
  validateUniqueIds_(matches, 'ID match', APP.sheets.matches, errors);
  validateUniqueIds_(photos, 'ID photo', APP.sheets.photos, errors);
  validateUniqueIds_((disciplineIncidents || []).filter(function(row) { return isYes_(row['Actif']); }),
    'ID incident', APP.sheets.discipline, errors);
  validateUniqueIds_((drawDecisions || []).filter(function(row) { return isYes_(row['Actif']); }),
    'ID tirage', APP.sheets.tieBreakDraws, errors);
  matches.forEach(function(match) {
    const label = APP.sheets.matches + ' ligne ' + match.__row;
    const home = String(match['ID équipe domicile'] || '');
    const away = String(match['ID équipe visiteuse'] || '');
    const generatedPlayoff = Boolean(String(match['Code série'] || '').trim() &&
      String(match['Source domicile'] || '').trim() && String(match['Source visiteuse'] || '').trim());
    if (home && !teamIds.has(home)) errors.push(label + ' : équipe domicile inconnue (' + home + ').');
    if (away && !teamIds.has(away)) errors.push(label + ' : équipe visiteuse inconnue (' + away + ').');
    if (!home && !generatedPlayoff) errors.push(label + ' : équipe domicile obligatoire.');
    if (!away && !generatedPlayoff) errors.push(label + ' : équipe visiteuse obligatoire.');
    if (home && home === away) errors.push(label + ' : une équipe ne peut pas jouer contre elle-même.');
    if (isYes_(match['Résultat final'])) {
      const homeScore = toNumber_(match['Score domicile'], null);
      const awayScore = toNumber_(match['Score visiteuse'], null);
      if (homeScore === null || awayScore === null || homeScore < 0 || awayScore < 0) {
        errors.push(label + ' : un résultat final exige deux scores positifs ou nuls.');
      }
      if (!home || !away) errors.push(label + ' : un résultat final exige deux équipes connues.');
      const winnerId = String(match['ID équipe gagnante'] || '').trim();
      const forfeitId = String(match['ID équipe forfait'] || '').trim();
      const penaltyShootout = isYes_(match['Victoire aux tirs au but']);
      if (winnerId && winnerId !== home && winnerId !== away) errors.push(label + ' : équipe gagnante invalide.');
      if (forfeitId && forfeitId !== home && forfeitId !== away) errors.push(label + ' : équipe forfait invalide.');
      if (forfeitId && !((forfeitId === home && homeScore === 0 && awayScore === 3) ||
          (forfeitId === away && homeScore === 3 && awayScore === 0))) {
        errors.push(label + ' : un forfait doit produire une défaite 0-3 pour l’équipe forfait.');
      }
      const scoreWinnerId = homeScore > awayScore ? home : (awayScore > homeScore ? away : '');
      if (scoreWinnerId && winnerId && winnerId !== scoreWinnerId) errors.push(label + ' : l’équipe gagnante contredit le score.');
      if (normalize_(match['Phase']) !== 'POOL' && homeScore === awayScore && !winnerId) {
        errors.push(label + ' : sélectionnez l’équipe gagnante du match éliminatoire à égalité.');
      }
      if (penaltyShootout && (normalize_(match['Phase']) === 'POOL' || homeScore !== awayScore || !winnerId)) {
        errors.push(label + ' : la case « Victoire aux tirs au but » exige un match éliminatoire à égalité et une équipe gagnante.');
      }
      if (normalize_(match['Phase']) !== 'POOL' && homeScore === awayScore && winnerId && !penaltyShootout) {
        errors.push(label + ' : cochez « Victoire aux tirs au but » pour ce match éliminatoire à égalité.');
      }
    }
  });
  (disciplineIncidents || []).filter(function(row) { return isYes_(row['Actif']); }).forEach(function(incident) {
    const label = APP.sheets.discipline + ' ligne ' + incident.__row;
    const divisionId = String(incident['ID division'] || '').trim();
    const teamId = String(incident['ID équipe'] || '').trim();
    const sanction = normalize_(incident['Sanction']).replace(/[-_]/g, ' ');
    const matchId = String(incident['ID match'] || '').trim();
    const tournamentId = String(incident['ID tournoi'] || '').trim();
    const team = teamById[teamId];
    const division = divisionById[divisionId];
    const disciplineMatch = matches.find(function(match) { return String(match['ID match'] || '').trim() === matchId; });
    if (!divisionIds.has(divisionId)) errors.push(label + ' : division active inconnue.');
    if (!teamIds.has(teamId)) errors.push(label + ' : équipe active inconnue.');
    if (team && String(team['ID division'] || '').trim() !== divisionId) {
      errors.push(label + ' : l’équipe ne fait pas partie de la division sélectionnée.');
    }
    if (division && String(division['ID tournoi'] || '').trim() !== tournamentId) {
      errors.push(label + ' : le tournoi ne correspond pas à la division sélectionnée.');
    }
    if (!disciplineMatch || normalize_(disciplineMatch['Phase'] || 'POOL') !== 'POOL' ||
        String(disciplineMatch['ID division'] || '').trim() !== divisionId ||
        !isYes_(disciplineMatch['Résultat final'])) {
      errors.push(label + ' : un match préliminaire final de la même division est obligatoire.');
    } else if (teamId !== String(disciplineMatch['ID équipe domicile'] || '').trim() &&
        teamId !== String(disciplineMatch['ID équipe visiteuse'] || '').trim()) {
      errors.push(label + ' : l’équipe sanctionnée ne participe pas au match sélectionné.');
    }
    if (['CARTON JAUNE', 'DEUXIEME JAUNE', 'CARTON ROUGE DIRECT'].indexOf(sanction) < 0) {
      errors.push(label + ' : sanction invalide.');
    }
  });
  const drawKeys = {};
  (drawDecisions || []).filter(function(row) { return isYes_(row['Actif']); }).forEach(function(decision) {
    const label = APP.sheets.tieBreakDraws + ' ligne ' + decision.__row;
    const divisionId = String(decision['ID division'] || '').trim();
    const teamId = String(decision['ID équipe'] || '').trim();
    const tournamentId = String(decision['ID tournoi'] || '').trim();
    const pool = normalize_(decision['Pool']);
    const team = teamById[teamId];
    const division = divisionById[divisionId];
    const priority = toNumber_(decision['Priorité'], null);
    if (!divisionIds.has(divisionId)) errors.push(label + ' : division active inconnue.');
    if (!teamIds.has(teamId)) errors.push(label + ' : équipe active inconnue.');
    if (team && String(team['ID division'] || '').trim() !== divisionId) {
      errors.push(label + ' : l’équipe ne fait pas partie de la division sélectionnée.');
    }
    if (team && pool && normalize_(team['Pool']) !== pool) {
      errors.push(label + ' : le pool ne correspond pas à celui de l’équipe.');
    }
    if (division && String(division['ID tournoi'] || '').trim() !== tournamentId) {
      errors.push(label + ' : le tournoi ne correspond pas à la division sélectionnée.');
    }
    if (priority === null || priority <= 0 || !Number.isInteger(priority)) errors.push(label + ' : priorité entière positive obligatoire.');
    const key = [divisionId, pool, priority].join('|');
    if (drawKeys[key]) errors.push(label + ' : cette priorité de tirage est déjà utilisée dans le même classement.');
    drawKeys[key] = true;
  });
  photos.forEach(function(photo) {
    const label = APP.sheets.photos + ' ligne ' + photo.__row;
    const url = String(photo['URL'] || '').trim();
    const divisionId = String(photo['ID division'] || '').trim();
    const teamId = String(photo['ID équipe'] || '').trim();
    if (!/^https:\/\/\S+$/i.test(url)) errors.push(label + ' : une URL HTTPS est obligatoire.');
    if (divisionId && !divisionIds.has(divisionId)) errors.push(label + ' : division publique inconnue (' + divisionId + ').');
    if (teamId && !teamIds.has(teamId)) errors.push(label + ' : équipe publique inconnue (' + teamId + ').');
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
