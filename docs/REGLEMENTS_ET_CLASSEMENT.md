# Règlements, résultats et classement

Ce guide traduit les règlements sportifs 2026 en règles administratives du classeur. Les administrateurs saisissent seulement les résultats finaux et les événements nécessaires au classement; aucun joueur n’est suivi individuellement.

## Configuration d’une division

Dans `DIVISIONS`, chaque catégorie peut définir ses propres valeurs :

- `Minimum matchs garantis` : `3` pour le tournoi 2026;
- `Points victoire`, `Points nul`, `Points défaite` : `3`, `1`, `0`;
- `Ordre bris égalité` : `POINTS,FACE_A_FACE,DIFF,BP,BC,FAIR_PLAY,TIRAGE`;
- `Plafond différence par match` : `5` pour appliquer la limite prévue au bris d’égalité;
- `Points carton jaune` : `1`;
- `Points deuxième jaune` : `3`;
- `Points carton rouge` : `3`;
- `Durée match (minutes)` : `30`;
- `Repos minimal (minutes)` : valeur facultative, ou `0` pour le désactiver.

La durée et les valeurs restent configurables afin que le gabarit puisse servir à une autre édition.

## Matchs comptabilisés

Tous les matchs de phase `POOL` marqués `Résultat final` comptent au classement. Un résultat provisoire ou incomplet n’est pas comptabilisé. Les statistiques publiques montrent les buts réellement marqués et accordés.

Pour un forfait, choisir l’équipe dans `Équipe forfait`, cocher `Résultat final`, puis synchroniser ou publier. Le système applique automatiquement une défaite de `0–3`, inscrit le motif `Forfait` et choisit l’autre équipe comme gagnante.

## Ordre du bris d’égalité

À égalité de points, les critères sont appliqués dans cet ordre :

1. résultats face-à-face entre les équipes encore à égalité;
2. différence de buts plafonnée à `+5` ou `−5` par match pour ce calcul seulement;
3. plus grand nombre de buts marqués;
4. plus petit nombre de buts accordés;
5. plus petit total de points de fair-play;
6. résultat du tirage au sort administratif.

Lorsqu’au moins trois équipes sont à égalité, le face-à-face crée un mini-classement entre ces équipes. Dès qu’un sous-groupe est départagé, la procédure recommence au premier critère pour les équipes qui demeurent à égalité, conformément au règlement.

Le plafond ne modifie jamais le résultat officiel ni les colonnes publiques de buts pour et contre. Par exemple, un match gagné `12–0` demeure affiché `12–0`, mais contribue `+5` à la différence utilisée pour départager le classement.

## Discipline et fair-play

Ajouter un incident dans `DISCIPLINE` en choisissant le tournoi, la division, le libellé lisible du match, l’équipe et la sanction. Les identifiants techniques voisins sont remplis par la synchronisation ou la publication. Les sanctions reconnues sont :

- `CARTON JAUNE`;
- `DEUXIÈME JAUNE`;
- `CARTON ROUGE DIRECT`.

Cocher `Actif` pour que l’incident soit comptabilisé. Une ligne représente une sanction et non un joueur; la colonne `Notes` peut contenir une précision administrative privée. Pour une expulsion causée par un deuxième jaune, inscrire seulement `DEUXIÈME JAUNE` : la valeur configurée de `3` représente le total de cet événement et évite de compter aussi un carton jaune séparé.

Seules les sanctions rattachées à un match de pool final de la même division alimentent le fair-play du classement. Les notes et les incidents détaillés ne sont jamais publiés; le site affiche seulement le total `FP` par équipe.

## Tirage au sort

Si toutes les règles précédentes laissent des équipes parfaitement à égalité à la fin des pools, le système refuse de générer les séries tant que le tirage officiel n’est pas saisi.

Dans `TIRAGES_AU_SORT`, ajouter une ligne active par équipe concernée et attribuer des priorités uniques : `1` pour la première équipe tirée, `2` pour la suivante, etc. Le tournoi, la division et le pool doivent correspondre aux équipes. Relancer ensuite la publication ou la génération des séries.

## Matchs éliminatoires

Les scores saisis correspondent au résultat après les 30 minutes réglementaires. Lorsqu’ils sont égaux, sélectionner `Équipe gagnante` et cocher `Victoire aux tirs au but`. Il n’est pas nécessaire d’inscrire les trois tirs ni la mort subite. Le site indique que la victoire a été obtenue aux tirs au but et le gagnant progresse automatiquement.

La case est réservée aux matchs éliminatoires à score égal. Les matchs de pool peuvent se terminer nuls et n’utilisent jamais cette case.

## Publication

Une modification dans le classeur privé ne devient publique qu’après **Tournoi → Publier les changements**. Cette commande synchronise les sélections lisibles, valide les forfaits, sanctions, tirages et tirs au but, recalcule le classement et les séries, puis remplace l’instantané public en une seule opération.
