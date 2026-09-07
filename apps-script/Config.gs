const APP = Object.freeze({
  version: '0.1.0',
  locale: 'fr-CA',
  sheets: Object.freeze({
    settings: 'PARAMETRES',
    tournaments: 'TOURNOIS',
    divisions: 'DIVISIONS',
    venues: 'LIEUX',
    registrations: 'INSCRIPTIONS',
    teams: 'EQUIPES',
    matches: 'MATCHS',
    photos: 'PHOTOS',
    publicData: 'DONNEES_PUBLIQUES',
    publicationLog: 'JOURNAL_PUBLICATION'
  }),
  statuses: Object.freeze({
    active: 'ACTIF',
    approved: 'APPROUVÉE',
    pending: 'EN ATTENTE',
    refused: 'REFUSÉE'
  }),
  headers: Object.freeze({
    PARAMETRES: ['Clé', 'Valeur', 'Description'],
    TOURNOIS: ['ID tournoi', 'Nom', 'Édition', 'Statut', 'Afficher', 'Date début', 'Date fin', 'Lieu principal', 'Description publique'],
    DIVISIONS: ['ID division', 'ID tournoi', 'Nom', 'Actif', 'Afficher', 'Nombre de pools', 'Matchs entre équipes', 'Équipes qualifiées', 'Points victoire', 'Points nul', 'Points défaite', 'Ordre bris égalité'],
    LIEUX: ['ID lieu', 'ID tournoi', 'Nom', 'Adresse publique', 'Actif', 'Afficher'],
    INSCRIPTIONS: ['ID inscription', 'Horodatage', 'ID tournoi', 'Nom équipe', 'École', 'Adresse', 'Ville', 'Code postal', 'Responsable', 'Téléphone', 'Courriel', 'ID division', 'Nombre équipes', 'Statut', 'Notes internes'],
    EQUIPES: ['ID équipe', 'ID tournoi', 'ID division', 'Pool', 'Nom', 'École', 'Statut', 'Afficher'],
    MATCHS: ['ID match', 'ID tournoi', 'ID division', 'Pool', 'Phase', 'Ronde', 'Date', 'Heure', 'ID lieu', 'Équipe domicile', 'Équipe visiteuse', 'Score domicile', 'Score visiteuse', 'Résultat final', 'Motif', 'Afficher'],
    PHOTOS: ['ID photo', 'ID tournoi', 'URL', 'Titre', 'ID division', 'ID équipe', 'Date', 'Afficher'],
    DONNEES_PUBLIQUES: ['Type', 'ID', 'Ordre', 'Données JSON'],
    JOURNAL_PUBLICATION: ['Horodatage', 'Compte', 'Version', 'Objets publiés', 'Statut', 'Message']
  })
});

