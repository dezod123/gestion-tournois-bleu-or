(function () {
  'use strict';
  const state = { data: null, tournamentId: '', divisionId: 'all', teamId: 'all', matchStatus: 'all' };
  const elements = {};
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements(); bindEvents();
    try {
      state.data = await loadData();
      if (!state.data.tournoi.length) throw new Error('Aucun tournoi public n’a été trouvé.');
      state.tournamentId = state.data.tournoi[0].id;
      populateFilters(); render();
    } catch (error) {
      showStatus('Impossible de charger les données du tournoi. ' + error.message, true);
      elements.publicationDate.textContent = 'Données indisponibles';
    }
  }

  function cacheElements() {
    ['tournament-name','tournament-details','publication-date','registration-link','status','tournament-filter','division-filter','team-filter',
      'match-status-filter','summary-cards','upcoming-matches','matches','standings-content','teams-content'].forEach(function (id) {
      elements[toCamel(id)] = document.getElementById(id);
    });
  }

  function configureRegistrationLink(tournament) {
    const url = safeExternalUrl(tournament && tournament.registrationUrl);
    const deadlineOpen = !tournament.registrationDeadline || new Date() <= new Date(tournament.registrationDeadline + 'T23:59:59');
    const isOpen = Boolean(tournament.registrationsOpen && deadlineOpen && url);
    elements.registrationLink.hidden = !isOpen;
    if (isOpen) elements.registrationLink.href = url;
    else elements.registrationLink.removeAttribute('href');
  }

  function bindEvents() {
    elements.tournamentFilter.addEventListener('change', function (event) {
      state.tournamentId = event.target.value; state.divisionId = 'all'; state.teamId = 'all'; populateFilters(); render();
    });
    elements.divisionFilter.addEventListener('change', function (event) {
      state.divisionId = event.target.value; state.teamId = 'all'; populateTeamFilter(); render();
    });
    elements.teamFilter.addEventListener('change', function (event) { state.teamId = event.target.value; render(); });
    elements.matchStatusFilter.addEventListener('change', function (event) { state.matchStatus = event.target.value; renderMatches(); });
    document.querySelectorAll('.tab').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (tab) { tab.classList.remove('is-active'); });
        document.querySelectorAll('.panel').forEach(function (panel) { panel.classList.remove('is-active'); });
        button.classList.add('is-active'); document.getElementById(button.dataset.tab).classList.add('is-active');
      });
    });
  }

  async function loadData() {
    const config = window.TOURNAMENT_CONFIG || {};
    const baseUrl = config.PUBLIC_DATA_URL || config.FALLBACK_DATA_URL || './data/exemple.csv';
    const response = await fetch(baseUrl + (baseUrl.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Réponse HTTP ' + response.status + '.');
    const grouped = { meta: [], tournoi: [], division: [], lieu: [], equipe: [], match: [], classement: [], photo: [] };
    parseCsv(await response.text()).slice(1).forEach(function (row) {
      if (!grouped[row[0]] || !row[3]) return;
      try { grouped[row[0]].push(JSON.parse(row[3])); } catch (error) { /* Ligne publique invalide ignorée. */ }
    });
    grouped.publication = grouped.meta[0] || {};
    return grouped;
  }

  function parseCsv(text) {
    const rows = []; let row = []; let field = ''; let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else field += character;
      } else if (character === '"') quoted = true;
      else if (character === ',') { row.push(field); field = ''; }
      else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += character;
    }
    if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }

  function populateFilters() {
    fillSelect(elements.tournamentFilter, state.data.tournoi, state.tournamentId, false, 'Tous les tournois');
    fillSelect(elements.divisionFilter, state.data.division.filter(function (item) { return item.tournamentId === state.tournamentId; }), state.divisionId, true, 'Toutes les divisions');
    populateTeamFilter();
  }

  function populateTeamFilter() {
    const teams = state.data.equipe.filter(function (item) {
      return item.tournamentId === state.tournamentId && (state.divisionId === 'all' || item.divisionId === state.divisionId);
    });
    fillSelect(elements.teamFilter, teams, state.teamId, true, 'Toutes les équipes');
  }

  function fillSelect(select, items, selected, includeAll, allLabel) {
    const options = includeAll ? [{ id: 'all', name: allLabel }] : [];
    options.push.apply(options, items);
    select.innerHTML = options.map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '"' + (item.id === selected ? ' selected' : '') + '>' + escapeHtml(item.name) + '</option>';
    }).join('');
  }

  function render() {
    const tournament = state.data.tournoi.find(function (item) { return item.id === state.tournamentId; });
    if (!tournament) return;
    elements.tournamentName.textContent = tournament.name;
    elements.tournamentDetails.textContent = [tournament.edition, formatDateRange(tournament.startDate, tournament.endDate), tournament.mainVenue].filter(Boolean).join(' · ');
    configureRegistrationLink(tournament);
    elements.publicationDate.textContent = state.data.publication.publishedAt ? 'Dernière publication : ' + formatDateTime(state.data.publication.publishedAt) : 'Date de publication inconnue';
    if (state.data.publication.message) showStatus(state.data.publication.message, false); else elements.status.hidden = true;
    renderSummary(); renderMatches(); renderStandings(); renderTeams();
  }

  function filteredTeams() {
    return state.data.equipe.filter(function (team) {
      return team.tournamentId === state.tournamentId && (state.divisionId === 'all' || team.divisionId === state.divisionId) && (state.teamId === 'all' || team.id === state.teamId);
    });
  }

  function filteredMatches(ignoreStatus) {
    return state.data.match.filter(function (match) {
      const teamMatch = state.teamId === 'all' || match.homeTeamId === state.teamId || match.awayTeamId === state.teamId;
      const statusMatch = ignoreStatus || state.matchStatus === 'all' || (state.matchStatus === 'final' ? match.final : !match.final);
      return match.tournamentId === state.tournamentId && (state.divisionId === 'all' || match.divisionId === state.divisionId) && teamMatch && statusMatch;
    }).sort(compareMatches);
  }

  function renderSummary() {
    const teams = filteredTeams(); const matches = filteredMatches(true);
    const finalMatches = matches.filter(function (match) { return match.final; });
    const goals = finalMatches.reduce(function (total, match) { return total + (match.homeScore || 0) + (match.awayScore || 0); }, 0);
    elements.summaryCards.innerHTML = [summaryCard(teams.length,'Équipes'),summaryCard(finalMatches.length,'Matchs terminés'),
      summaryCard(matches.length - finalMatches.length,'Matchs à venir'),summaryCard(goals,'Buts marqués')].join('');
    renderMatchList(elements.upcomingMatches, matches.filter(function (match) { return !match.final; }).slice(0,6), 'Aucun match à venir dans cette sélection.');
  }

  function summaryCard(value, label) { return '<article class="summary-card"><strong>' + value + '</strong><span>' + escapeHtml(label) + '</span></article>'; }
  function renderMatches() { renderMatchList(elements.matches, filteredMatches(false), 'Aucun match dans cette sélection.'); }

  function renderMatchList(container, matches, emptyMessage) {
    if (!matches.length) { container.innerHTML = empty(emptyMessage); return; }
    const teamIndex = Object.fromEntries(state.data.equipe.map(function (team) { return [team.id,team]; }));
    const venueIndex = Object.fromEntries(state.data.lieu.map(function (venue) { return [venue.id,venue]; }));
    const divisionIndex = Object.fromEntries(state.data.division.map(function (division) { return [division.id,division]; }));
    container.innerHTML = matches.map(function (match) {
      const home = teamIndex[match.homeTeamId] || { name: match.homeTeamId };
      const away = teamIndex[match.awayTeamId] || { name: match.awayTeamId };
      const division = divisionIndex[match.divisionId] || { name: '' };
      const venue = venueIndex[match.venueId] || { name: '' };
      const status = match.final ? '<span class="badge">Final</span>' : escapeHtml(match.time || 'Heure à confirmer');
      return '<article class="match-card"><div class="match-card__meta"><span>' + escapeHtml(formatDate(match.date)) + '</span><span>' + status + '</span></div>' +
        '<div class="match-card__body">' + matchTeam(home.name,match.final ? match.homeScore : '–') + matchTeam(away.name,match.final ? match.awayScore : '–') + '</div>' +
        '<div class="match-card__footer">' + escapeHtml([division.name,match.pool ? 'Pool ' + match.pool : '',venue.name].filter(Boolean).join(' · ')) + '</div></article>';
    }).join('');
  }

  function matchTeam(name, score) { return '<div class="match-team"><span>' + escapeHtml(name) + '</span><strong class="score">' + escapeHtml(score) + '</strong></div>'; }

  function renderStandings() {
    const divisions = state.data.division.filter(function (division) { return division.tournamentId === state.tournamentId && (state.divisionId === 'all' || division.id === state.divisionId); });
    const blocks = [];
    divisions.forEach(function (division) {
      const rows = state.data.classement.filter(function (row) { return row.divisionId === division.id && (state.teamId === 'all' || row.teamId === state.teamId); });
      unique(rows.map(function (row) { return row.pool || ''; })).forEach(function (pool) {
        const poolRows = rows.filter(function (row) { return (row.pool || '') === pool; });
        if (!poolRows.length) return;
        blocks.push('<article class="standing-block"><h3>' + escapeHtml(division.name + (pool ? ' — Pool ' + pool : '')) + '</h3><div class="table-scroll"><table><thead><tr>' +
          '<th>Rang</th><th>Équipe</th><th>PJ</th><th>V</th><th>N</th><th>D</th><th>BP</th><th>BC</th><th>Diff</th><th>Pts</th></tr></thead><tbody>' +
          poolRows.map(standingRow).join('') + '</tbody></table></div></article>');
      });
    });
    elements.standingsContent.innerHTML = blocks.join('') || empty('Aucun classement dans cette sélection.');
  }

  function standingRow(row) {
    return '<tr><td>' + row.rank + '</td><td>' + escapeHtml(row.teamName) + '</td><td>' + row.played + '</td><td>' + row.wins + '</td><td>' + row.draws + '</td><td>' + row.losses + '</td><td>' + row.goalsFor + '</td><td>' + row.goalsAgainst + '</td><td>' + signed(row.difference) + '</td><td><strong>' + row.points + '</strong></td></tr>';
  }

  function renderTeams() {
    const divisionIndex = Object.fromEntries(state.data.division.map(function (division) { return [division.id,division]; }));
    elements.teamsContent.innerHTML = filteredTeams().map(function (team) {
      const division = divisionIndex[team.divisionId] || { name: '' };
      return '<article class="team-card"><h3>' + escapeHtml(team.name) + '</h3><p>' + escapeHtml([team.school,division.name,team.pool ? 'Pool ' + team.pool : ''].filter(Boolean).join(' · ')) + '</p></article>';
    }).join('') || empty('Aucune équipe dans cette sélection.');
  }

  function compareMatches(a,b) { return (a.date + a.time + a.id).localeCompare(b.date + b.time + b.id); }
  function unique(values) { return values.filter(function (value,index) { return values.indexOf(value) === index; }); }
  function signed(value) { return value > 0 ? '+' + value : String(value); }
  function empty(message) { return '<p class="empty">' + escapeHtml(message) + '</p>'; }
  function toCamel(value) { return value.replace(/-([a-z])/g, function (_,letter) { return letter.toUpperCase(); }); }
  function formatDate(value) { if (!value) return 'Date à confirmer'; return new Intl.DateTimeFormat('fr-CA',{ weekday:'short',day:'numeric',month:'short' }).format(new Date(value + 'T12:00:00')); }
  function formatDateRange(start,end) { if (!start) return ''; return !end || end === start ? formatDate(start) : formatDate(start) + ' au ' + formatDate(end); }
  function formatDateTime(value) { return new Intl.DateTimeFormat('fr-CA',{ dateStyle:'long',timeStyle:'short' }).format(new Date(value)); }
  function showStatus(message,isError) { elements.status.textContent = message; elements.status.hidden = false; elements.status.classList.toggle('is-error',Boolean(isError)); }
  function safeExternalUrl(value) { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch (error) { return ''; } }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g,function (character) { return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]; }); }
})();
