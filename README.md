# TP5 - Application To-Do (IndexedDB)

Application JavaScript pur (sans framework). Les tâches sont rattachées à des
projets et persistées dans **IndexedDB**, la base de données native du navigateur.

## Fonctionnalités

- Créer, sélectionner et supprimer des projets (la suppression d'un projet
  supprime aussi ses tâches, dans une seule transaction, après confirmation).
- Ajouter, renommer (édition en ligne : Entrée pour valider, Échap pour annuler),
  cocher/décocher et supprimer des tâches.
- Progression par projet, compteur de tâches restantes.
- Messages d'erreur visibles (saisie vide ou faite d'espaces, nom de projet en double,
  erreur de base de données) : aucune erreur silencieuse.
- Thème clair/sombre automatique, mise en page adaptée au mobile, accessible au clavier.

## Structure

- `index.html`, `src/app.js`, `src/style.css` : l'application (interface).
- `src/db.js` : la couche d'accès aux données (IndexedDB), isolée du DOM pour
  pouvoir être testée sans navigateur.
- `test/` : tests unitaires **TDD** (Vitest).
- `features/` : scénarios **BDD** en Gherkin (Cucumber.js), en français.
- `e2e/` : tests **E2E** (Playwright) dans un vrai navigateur, avec vérification
  de la persistance par rechargement de page.
- `.github/workflows/ci.yml` : exécute les 3 suites à chaque `push`.

## Vrai IndexedDB ou fake-indexeddb ?

| Contexte | Environnement | IndexedDB utilisé |
|---|---|---|
| Application | Navigateur | **Vrai** IndexedDB (visible dans DevTools > Application) |
| Tests E2E (Playwright) | Vrai Chromium | **Vrai** IndexedDB |
| Tests TDD (Vitest) et BDD (Cucumber) | Node.js | `fake-indexeddb` (en mémoire) |

Node.js ne fournit pas IndexedDB. `fake-indexeddb` en est une implémentation
conforme à la spécification, chargée uniquement par les fichiers de test
(`import 'fake-indexeddb/auto'`). Le code de `src/db.js` est identique dans les
deux cas.

## Installation

```bash
npm install
npx playwright install chromium
```

## Lancer les tests

```bash
npm run test       # TDD - Vitest (21 tests)
npm run test:bdd   # BDD - Cucumber.js (8 scénarios)
npm run test:e2e   # E2E - Playwright (9 tests, vrai navigateur)
npm run test:all   # les trois suites
```

## Lancer l'application

```bash
npx http-server . -p 4173
```

Puis ouvrir `http://localhost:4173` et inspecter l'onglet Application >
IndexedDB > `todo-app` des DevTools pour voir les données réellement stockées.
