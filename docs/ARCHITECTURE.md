# Architecture V1

## Décisions structurantes

- Google Sheets est la source de vérité administrative et collaborative.
- Les catégories, tournois, lieux et règles ne sont pas codés en dur.
- Aucun traitement n'est lancé pendant la saisie.
- Une publication manuelle crée un nouvel instantané public cohérent.
- GitHub Pages ne reçoit jamais les onglets privés.
- Le site est statique et n'a pas besoin de serveur permanent.
- Plusieurs tournois actifs peuvent coexister dans le même classeur.

## Onglets

| Onglet | Rôle | Public |
|---|---|---:|
| `PARAMETRES` | Configuration globale et état de publication | Non |
| `TOURNOIS` | Éditions pouvant être actives ou archivées | Champs sélectionnés |
| `DIVISIONS` | Règles propres à chaque catégorie/division | Champs sélectionnés |
| `LIEUX` | Gymnases et terrains | Champs sélectionnés |
| `INSCRIPTIONS` | Demandes, coordonnées et approbation | Non |
| `EQUIPES` | Équipes approuvées et affectation aux pools | Champs sélectionnés |
| `MATCHS` | Horaire, scores finaux et motifs facultatifs | Champs sélectionnés |
| `PHOTOS` | Références approuvées vers Google Drive | Champs sélectionnés |
| `JOURNAL_PUBLICATION` | Historique des publications | Non |

Un second classeur Google Sheets, créé automatiquement, contient uniquement l'onglet `DONNEES_PUBLIQUES`. Il est le seul fichier publié sur le Web. Cette séparation empêche une erreur de partage d'exposer les inscriptions ou les coordonnées privées.

## Contrat public

Le classeur public `DONNEES_PUBLIQUES` contient une ligne par objet :

```text
Type | ID | Ordre | Données JSON
```

Les types V1 sont `meta`, `tournoi`, `division`, `lieu`, `equipe`, `match`, `classement` et `photo`. Cela permet d'ajouter de nouveaux champs sans casser les anciennes pages.

## Publication

`publierChangements` effectue dans une seule exécution :

1. la lecture de l'état actuel des onglets privés;
2. la validation des identifiants et références;
3. le calcul des classements à partir des résultats finaux;
4. la sélection explicite des champs autorisés;
5. le remplacement complet de l'instantané public;
6. la consignation de la date et du compte ayant publié.

Si une erreur bloquante existe, l'instantané précédent demeure intact.
