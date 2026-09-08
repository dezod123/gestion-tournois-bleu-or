# Gestionnaire de tournois Bleu & Or

Gabarit réutilisable pour administrer un ou plusieurs tournois dans Google Sheets et afficher les données approuvées sur un site GitHub Pages.

## Principe

```text
Google Sheets privé
        │
        │  Menu « Tournoi → Publier les changements »
        ▼
Classeur séparé DONNEES_PUBLIQUES, publié en lecture seule
        │
        ▼
Site statique GitHub Pages
```

La saisie et les corrections dans Google Sheets ne déclenchent aucun script. Une publication explicite valide les données, recalcule les classements et remplace le dernier instantané public.

## Contenu du dépôt

- `apps-script/` : création du classeur, validations, calcul des classements et publication manuelle;
- `site/` : interface publique responsive, en français;
- `docs/` : instructions d'installation et d'exploitation;
- les fichiers DOCX/XLSX historiques restent localement comme références et sont exclus du dépôt public.

## Démarrage rapide

1. Lire [`docs/DEMARRAGE.md`](docs/DEMARRAGE.md).
2. Créer une feuille Google Sheets vide.
3. Copier les fichiers `.gs` et `appsscript.json` dans un projet Apps Script lié à la feuille.
4. Exécuter `initialiserClasseur` une fois.
5. Configurer le tournoi, puis utiliser **Tournoi → Publier les changements**.
6. Publier le classeur public créé automatiquement et reporter son URL CSV dans `site/config.js`.

Le menu Google Sheets permet aussi de créer une édition et de générer automatiquement tous les identifiants techniques. La durée des matchs et les disponibilités des lieux sont configurables; voir [`docs/IDENTIFIANTS_ET_HORAIRES.md`](docs/IDENTIFIANTS_ET_HORAIRES.md).

Un Google Form distinct peut être généré automatiquement pour chaque tournoi. Une soumission correspond à une équipe; les réponses privées sont importées en lot avant leur approbation. Le flux complet est décrit dans [`docs/INSCRIPTIONS.md`](docs/INSCRIPTIONS.md).

Pendant le développement, le site fonctionne avec les données d'exemple incluses et peut être lancé avec n'importe quel serveur HTTP statique.
