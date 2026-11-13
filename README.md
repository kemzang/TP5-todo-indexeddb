# TP5 - Application To-Do (IndexedDB)

Application JavaScript pur (sans framework). Les taches sont rattachees a des
projets et persistees dans IndexedDB, la base de donnees native du navigateur.

## Structure

- `index.html`, `src/app.js`, `src/style.css` - l'application elle-meme.
- `src/db.js` - la couche d'acces aux donnees (IndexedDB), isolee du DOM pour
  pouvoir etre testee sans navigateur.
- `test/` - tests unitaires **TDD** (Vitest + `fake-indexeddb` pour simuler
  IndexedDB sous Node, sans navigateur).
- `features/` - scenarios **BDD** en Gherkin (Cucumber.js) decrivant le
  comportement attendu en langage naturel, executes contre la meme couche
  `db.js`.
- `e2e/` - tests **E2E** (Playwright) qui pilotent un vrai navigateur et
  verifient la persistance dans le vrai IndexedDB (via un rechargement de
  page).
- `.github/workflows/ci.yml` - execute les 3 suites a chaque `push`.

## Installation

```bash
npm install
npx playwright install chromium
```

## Lancer les tests

```bash
npm run test       # TDD - Vitest
npm run test:bdd    # BDD - Cucumber.js
npm run test:e2e    # E2E - Playwright (vrai navigateur)
npm run test:all     # les trois suites
```

## Lancer l'application

```bash
npx http-server . -p 4173
```

Puis ouvrir `http://localhost:4173` et inspecter l'onglet Application >
IndexedDB > `todo-app` des DevTools pour voir les donnees reellement stockees.
