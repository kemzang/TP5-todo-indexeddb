// Trois profils Cucumber :
//  - default    : scenarios metier executes sur la couche donnees (db.js + fake-indexeddb)
//  - navigateur : scenarios executes par un robot dans un vrai Chromium (Playwright)
//  - demo       : comme "navigateur", mais fenetre visible et actions ralenties
const navigateur = {
  paths: ['features/navigateur/**/*.feature'],
  import: ['features/navigateur/steps/**/*.js'],
  format: ['progress', 'html:reports/cucumber-navigateur.html'],
  worldParameters: { headed: false, slowMo: 0 },
};

module.exports = {
  default: {
    paths: ['features/*.feature'],
    import: ['features/step_definitions/**/*.js'],
    format: ['progress', 'html:reports/cucumber-report.html'],
  },
  navigateur,
  demo: {
    ...navigateur,
    format: ['@cucumber/pretty-formatter', 'html:reports/cucumber-navigateur.html'],
    // Reglages de vitesse (en millisecondes) : augmenter pour ralentir davantage
    worldParameters: {
      headed: true,
      slowMo: 600, // pause avant chaque action du robot (clic, frappe...)
      delaiFrappe: 90, // delai entre chaque lettre tapee
      pauseEtape: 1000, // pause apres chaque phrase Gherkin
      pauseFin: 2500, // pause a la fin de chaque scenario, avant de fermer
    },
    parallel: 0,
  },
};
