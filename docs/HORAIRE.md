# Génération de l’horaire

## Portée de cette version

Le générateur construit les matchs de poules d’un tournoi à partir des équipes approuvées et des plages disponibles. Les rondes éliminatoires utilisent ensuite la configuration distincte de `FORMULES_SERIES`; elles peuvent être créées et faire progresser leurs gagnants automatiquement. Voir [`SERIES.md`](SERIES.md).

Le générateur ne modifie et ne supprime jamais un match existant. Les matchs déjà présents dans `MATCHS`, y compris ceux dont le résultat est final, comptent dans le nombre de confrontations demandé afin d’éviter les doublons.

## Configuration requise

### Dans `TOURNOIS`

- `Durée match par défaut (minutes)` : durée utilisée lorsqu’une division ne possède pas sa propre durée.

### Dans `DIVISIONS`

- `Actif` : la division doit être cochée;
- `Nombre de pools` : de 1 à 26;
- `Matchs entre équipes` : nombre de fois où chaque paire d’équipes d’un même pool doit se rencontrer;
- `Minimum matchs garantis` : minimum vérifié pour chaque équipe avant toute génération (3 en 2026);
- `Repos minimal (minutes)` : délai facultatif entre la fin d’un match et le début du suivant pour une même équipe; `0` le désactive;
- `Durée match (minutes)` : valeur facultative qui remplace la durée du tournoi.

### Dans `EQUIPES`

Seules les équipes dont le statut est `APPROUVÉE` participent. Un pool déjà inscrit est conservé. Les pools doivent être nommés `A`, `B`, `C`, etc. Lorsqu’une équipe n’a pas encore de pool, le générateur l’affecte au pool qui contient le moins d’équipes, sans déplacer les équipes déjà affectées.

### Dans `LIEUX` et `PLAGES_HORAIRES`

Chaque plage active doit référencer un lieu actif du même tournoi et contenir :

- une date;
- une heure de début;
- une heure de fin;
- facultativement, un début et une fin de pause.

Créer une ligne par date et par lieu. Deux lieux peuvent être disponibles au même moment : le générateur y placera des matchs en parallèle lorsque les équipes concernées sont différentes.

## Procédure

1. Vérifier les divisions, équipes, lieux et plages horaires.
2. Utiliser **Tournoi → Générer les identifiants manquants** si des lignes administratives n’ont pas encore d’identifiant.
3. Dans `TOURNOIS`, sélectionner une cellule de la ligne du tournoi.
4. Choisir **Tournoi → Générer l’horaire du tournoi sélectionné**.
5. Lire le résumé : affectations de pools, nouveaux matchs, matchs existants conservés et avertissements.
6. Confirmer la génération.
7. Vérifier et, au besoin, déplacer manuellement les lignes produites dans `MATCHS`.
8. Choisir **Tournoi → Publier les changements** seulement lorsque l’horaire est prêt à être affiché.

La commande peut être relancée après l’approbation de nouvelles équipes. Elle calcule alors uniquement les confrontations manquantes.

Pour créer ou modifier un match manuellement, l’administrateur choisit `Équipe domicile` et `Équipe visiteuse` dans les listes déroulantes de noms. Les colonnes voisines `ID équipe domicile` et `ID équipe visiteuse` conservent les identifiants officiels et sont gérées par le système. La commande **Tournoi → Synchroniser les équipes dans MATCHS** résout les noms immédiatement; la publication effectue aussi cette synchronisation automatiquement.

Le tournoi et la division doivent être choisis avant les noms. Le système vérifie le tournoi, la division et le pool afin d’éviter une association avec une équipe homonyme d’un autre contexte. Deux équipes portant exactement le même nom dans le même contexte doivent être renommées de façon distincte.

## Règles de placement

Le moteur :

- génère un tournoi toutes rondes dans chaque pool;
- alterne autant que possible domicile et visiteur lors des confrontations répétées;
- respecte la durée de chaque division;
- ne place rien pendant une pause;
- ne place jamais deux matchs au même lieu au même moment;
- ne place jamais une équipe dans deux matchs au même moment;
- respecte le repos minimal configuré pour la division;
- refuse une structure de pools qui ne garantit pas le nombre minimal de matchs;
- considère les matchs existants comme des périodes déjà occupées;
- conserve les scores, résultats et horaires déjà saisis.

## Messages à corriger

- **Capacité horaire insuffisante** : ajouter une plage, prolonger une plage ou activer un autre lieu.
- **Lieu inactif ou inconnu** : corriger `ID lieu` dans `PLAGES_HORAIRES` ou activer le lieu.
- **Conflit entre des matchs existants** : corriger les heures ou les lieux des matchs indiqués avant de relancer.
- **Pool hors configuration** : corriger le pool de l’équipe ou augmenter `Nombre de pools`.
- **Minimum garanti non atteint** : augmenter `Matchs entre équipes` ou modifier le nombre de pools.
- **Division inactive** : activer la division ou corriger l’équipe qui y est rattachée.

## Limites intentionnelles

Cette première version ne gère pas :

- la disponibilité individuelle des équipes;
- les préférences d’heures;
- les déplacements entre lieux;
- l’optimisation avancée d’un horaire déjà construit.

Après génération, `MATCHS` demeure la source officielle et reste entièrement modifiable par les administrateurs avant publication.
