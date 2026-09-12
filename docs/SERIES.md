# Séries éliminatoires configurables

Le nombre total d’équipes inscrites n’impose aucune structure fixe. Chaque division indique son nombre de pools et son nombre d’équipes qualifiées, puis `FORMULES_SERIES` décrit où ces équipes sont placées.

La publication manuelle exécute la chaîne suivante :

```text
Résultats finaux des pools
        ↓
Classement de la division
        ↓
Sources définies dans FORMULES_SERIES
        ↓
Matchs éliminatoires dans MATCHS
        ↓
Gagnants → ronde suivante → finale → champion
```

## Créer une formule standard

1. Dans `DIVISIONS`, régler `Nombre de pools` et `Équipes qualifiées`.
2. Sélectionner une cellule de cette division.
3. Choisir **Tournoi → Créer la formule de séries de la division sélectionnée**.
4. Confirmer l’aperçu proposé.
5. Vérifier les lignes créées dans `FORMULES_SERIES`.

Le générateur standard prend en charge :

- un seul pool avec de 2 à 32 équipes qualifiées;
- un nombre impair de qualifiés grâce aux exemptions accordées aux meilleures positions;
- deux pools avec deux qualifiés, soit `A1` contre `B1` en finale;
- deux pools avec quatre qualifiés, soit `A1–B2` et `B1–A2` en demi-finales.

Ainsi, une division de cinq équipes peut indiquer quatre qualifiés et obtenir automatiquement `1–4`, `2–3`, puis la finale. Une division peut également qualifier trois, cinq, six ou sept équipes : le tableau est complété jusqu’à la prochaine puissance de deux et les meilleures têtes de série reçoivent une exemption.

Lorsque plusieurs pools rendent le placement ambigu, le système refuse d’inventer les confrontations. Les administrateurs définissent alors la formule souhaitée directement dans `FORMULES_SERIES`.

## Comprendre FORMULES_SERIES

Chaque ligne représente un match du tableau :

| Champ | Exemple | Rôle |
|---|---|---|
| `Code match` | `SF1` | Code court, unique dans la division |
| `Phase` | `DEMI-FINALE` | Section publique du tableau |
| `Ordre` | `1` | Ordre de résolution des dépendances |
| `Source domicile` | `1er général` | Origine de la première équipe |
| `Source visiteuse` | `4e général` | Origine de la deuxième équipe |
| `Actif` | case cochée | Inclut la règle dans l’automatisation |

Les sources acceptées sont :

- `1er général`, `2e général`, etc.;
- `1er pool A`, `2e pool B`, etc.;
- `Gagnant SF1`, où `SF1` est le code d’un match d’ordre inférieur.

Exemple pour quatre qualifiés dans un seul pool :

| Code | Phase | Ordre | Domicile | Visiteuse |
|---|---|---:|---|---|
| `SF1` | `DEMI-FINALE` | 1 | `1er général` | `4e général` |
| `SF2` | `DEMI-FINALE` | 2 | `2e général` | `3e général` |
| `F` | `FINALE` | 3 | `Gagnant SF1` | `Gagnant SF2` |

Une formule doit contenir exactement une finale et utiliser exactement le nombre de places indiqué dans `Équipes qualifiées`. Une même place de classement ne peut pas être utilisée deux fois.

## Génération et progression

La commande **Générer / mettre à jour les séries** permet de vérifier immédiatement le tableau. La même mise à jour est exécutée automatiquement au début de **Publier les changements**.

Avant que tous les matchs de pools soient finaux, les matchs éliminatoires peuvent être publiés avec leurs sources, par exemple « Gagnant SF1 ». Dès que la ronde préliminaire est terminée, les noms des équipes qualifiées remplacent automatiquement ces sources.

Après un résultat éliminatoire final :

- si les scores sont différents, le gagnant est déterminé automatiquement;
- si les scores sont égaux après les trois tirs au but puis, au besoin, la mort subite, l’administrateur sélectionne `Équipe gagnante` et coche `Victoire aux tirs au but` dans `MATCHS`;
- la prochaine publication place automatiquement le gagnant dans le match suivant;
- le gagnant de la finale devient automatiquement le champion public.

La case ne sert pas à inscrire chaque tir. Elle confirme seulement que l’égalité au score réglementaire a été départagée selon la procédure prévue. La publication refuse une équipe gagnante avec un score égal si cette case n’est pas cochée, et refuse aussi la case sur un match de pool ou un score non égal.

## Égalité complète au classement

Le classement applique les critères configurés jusqu’au fair-play. Si plusieurs équipes demeurent parfaitement à égalité une fois tous leurs matchs de pool terminés, la génération des séries est bloquée afin de ne pas choisir arbitrairement un qualifié.

L’administrateur effectue alors le tirage au sort prévu par le règlement et inscrit une ligne active par équipe concernée dans `TIRAGES_AU_SORT`. Une priorité plus petite est mieux classée : `1` précède `2`, puis `3`. Les priorités doivent être uniques pour le tournoi, la division et le pool concernés. La publication reprend ensuite automatiquement le classement et les séries.

Les colonnes `Date`, `Heure` et `Lieu` des matchs créés restent modifiables. Elles sont laissées vides au départ afin que les administrateurs puissent réserver les créneaux appropriés.

## Corrections et sécurité

Un score peut être corrigé tant que le match suivant n’est pas déjà final. Le système recalcule alors le gagnant et met à jour la ronde suivante. Si la correction changerait un participant d’un match déjà marqué final, la publication est bloquée afin de ne pas réécrire silencieusement l’historique.

Les identifiants techniques, les codes de liaison et les sources ne sont jamais envoyés au public autrement que sous la forme minimale nécessaire à l’affichage du tableau. Les coordonnées d’inscription demeurent privées.
