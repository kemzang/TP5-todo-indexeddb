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
- `features/taches.feature` : scénarios **BDD** en Gherkin (Cucumber.js), en français,
  exécutés sur la couche données.
- `features/navigateur/` : scénarios **BDD exécutés dans le navigateur** : un robot
  (Playwright) ouvre Chromium et crée, modifie, coche et supprime lui-même projets
  et tâches en suivant les phrases Gherkin.
- `e2e/` : tests **E2E** (Playwright) dans un vrai navigateur, avec vérification
  de la persistance par rechargement de page.
- `.github/workflows/ci.yml` : exécute les 4 suites à chaque `push`, puis les tests de performance k6.

## Vrai IndexedDB ou fake-indexeddb ?

| Contexte | Environnement | IndexedDB utilisé |
|---|---|---|
| Application | Navigateur | **Vrai** IndexedDB (visible dans DevTools > Application) |
| Tests E2E (Playwright) et BDD navigateur (Cucumber + Playwright) | Vrai Chromium | **Vrai** IndexedDB |
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
npm run test         # TDD - Vitest (21 tests)
npm run test:bdd     # BDD - Cucumber.js sur la couche données (8 scénarios)
npm run test:bdd:ui  # BDD - Cucumber.js piloté dans Chromium (11 scénarios)
npm run test:e2e     # E2E - Playwright (9 tests, vrai navigateur)
npm run test:all     # toutes les suites
```

## Démonstration : le robot utilise l'application

```bash
npm run demo
```

Une fenêtre Chromium s'ouvre et le robot exécute les scénarios de
`features/navigateur/` au ralenti, pendant que le terminal affiche chaque étape
Gherkin.

## Tests de performance (k6)

```bash
npm run perf:charge      # charge HTTP : 0 → 50 utilisateurs virtuels (montée, palier, descente)
npm run perf:navigateur  # k6 pilote Chromium : 50 tâches ajoutées, rechargement, suppression
npm run perf             # les deux
npm run report:perf      # ouvre les rapports HTML k6
```

- `perf/charge.js` : seuils `p(95)<300ms`, `p(99)<800ms`, moins de 1 % d'erreurs.
  L'application n'ayant pas d'API (données dans IndexedDB, côté navigateur), la charge
  porte sur le service des fichiers statiques.
- `perf/navigateur.js` : seuils sur les Web Vitals (FCP, LCP, CLS), sur le temps d'ajout
  d'une tâche (mesuré dans la page) et sur le rechargement d'un projet de 50 tâches.
- Un seuil violé fait échouer k6 (code de sortie non nul), donc la CI.
- En local, k6 tourne dans l'image Docker officielle `grafana/k6:latest-with-browser`
  (Chromium inclus). Avec un k6 installé localement : `K6_MODE=local npm run perf`.

## Profilage (CPU, mémoire)

```bash
npm run profil           # le robot utilise l'appli pendant que Chrome enregistre un profil
npm run profil:visible   # idem, en voyant le navigateur
```

- `reports/profil-performance.json` : à ouvrir dans Chrome, F12 > **Performance** >
  « Charger le profil ». On y retrouve CPU (Scripting, Rendering, Painting),
  mémoire (JS heap, nœuds, écouteurs), captures d'écran et arbre d'appels.
- Détection de fuite mémoire : 6 cycles (créer un projet, 20 tâches, supprimer) dans la
  même page ; mémoire JS, écouteurs et éléments du DOM doivent rester stables, et aucune
  tâche ne doit rester dans la zone masquée. Sinon le script échoue (code 1), donc la CI.
- Ce test a détecté un vrai défaut, corrigé depuis : après la suppression d'un projet,
  ses tâches restaient dans le DOM masqué avec leurs écouteurs.

## Rapports HTML

```bash
npm run report:unit    # Vitest
npm run report:bdd     # Cucumber (couche données)
npm run report:bdd:ui  # Cucumber (navigateur)
npm run report:e2e     # Playwright (captures d'écran + traces)
```

## Lancer l'application

```bash
npx http-server . -p 4173
```

Puis ouvrir `http://localhost:4173` et inspecter l'onglet Application >
IndexedDB > `todo-app` des DevTools pour voir les données réellement stockées.
