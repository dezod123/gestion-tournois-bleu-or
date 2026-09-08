window.TOURNAMENT_CONFIG = Object.freeze({
  // Coller ici l'URL CSV obtenue en publiant uniquement DONNEES_PUBLIQUES.
  PUBLIC_DATA_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQg34Q8M8T_h2lG8OPDPob-NroDmCyZ9UVdzzjHc0umzgqeCDapcGrEN81VLihjJ6Qy-XiLqb7rmAa8/pub?gid=0&single=true&output=csv',
  // Coller ici l'URL /exec du déploiement Apps Script. Le bouton reste masqué si la valeur est vide.
  REGISTRATION_FORM_URL: 'https://script.google.com/macros/s/AKfycbycacHyc1KoDIOOOQxpChiaWUPkoAzbinvS2Ljhv-s4myNse-fenCTugM19XMo_hdwUkw/exec',
  FALLBACK_DATA_URL: './data/exemple.csv'
});
