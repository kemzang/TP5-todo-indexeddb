// BDD dans le navigateur : chaque phrase Gherkin est executee par un robot
// (Playwright) qui pilote un vrai Chromium sur l'application.
// Ici, PAS de fake-indexeddb : c'est le vrai IndexedDB du navigateur.
import { BeforeAll, AfterAll, Before, After, AfterStep, Given, When, Then, setDefaultTimeout, Status } from '@cucumber/cucumber';
import { chromium, expect } from '@playwright/test';
import httpServer from 'http-server';

setDefaultTimeout(30_000);
process.noDeprecation = true; // masque un avertissement interne de http-server (sans effet sur les tests)

const PORT = 4180;
const BASE_URL = `http://localhost:${PORT}`;

let server;
let browser;

// Demarre une seule fois un serveur web qui sert l'application.
BeforeAll(async function () {
  server = httpServer.createServer({ root: '.', cache: -1, showDir: false });
  await new Promise((resolve) => server.listen(PORT, resolve));
});

AfterAll(async function () {
  await browser?.close();
  server?.close();
});

// Chaque scenario recoit un contexte de navigateur neuf (IndexedDB vide).
// Les options viennent du profil Cucumber (cucumber.cjs > worldParameters) :
// headless en CI, fenetre visible et ralentie pour la demonstration.
Before(async function () {
  const { headed = false, slowMo = 0 } = this.parameters;
  browser ??= await chromium.launch({ headless: !headed, slowMo, args: ['--window-size=1280,860'] });
  this.context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  this.page = await this.context.newPage();
});

// Mode demo : petite pause apres chaque etape pour laisser le temps de voir.
AfterStep(async function () {
  const { pauseEtape = 0 } = this.parameters;
  if (pauseEtape && this.page) await this.page.waitForTimeout(pauseEtape);
});

// En cas d'echec, une capture d'ecran est jointe au rapport HTML.
// En mode demo, on laisse le resultat final affiche quelques instants.
After(async function ({ result }) {
  if (result?.status === Status.FAILED && this.page) {
    this.attach(await this.page.screenshot({ fullPage: true }), 'image/png');
  }
  const { pauseFin = 0 } = this.parameters;
  if (pauseFin && this.page) await this.page.waitForTimeout(pauseFin);
  await this.context?.close();
});

// Saisie : instantanee en test, lettre par lettre en mode demo (comme un humain).
async function saisir(world, champ, texte) {
  const { delaiFrappe = 0 } = world.parameters;
  await champ.fill('');
  if (delaiFrappe) await champ.pressSequentially(texte, { delay: delaiFrappe });
  else await champ.fill(texte);
}

/* ---------- Raccourcis vers les elements de la page ---------- */

const testId = (world, id) => world.page.getByTestId(id);
const ligneTache = (world, titre) =>
  testId(world, 'task-list').locator('li').filter({ has: world.page.getByText(titre, { exact: true }) });
const boutonProjet = (world, nom) =>
  testId(world, 'project-list').getByRole('button').filter({ has: world.page.getByText(nom, { exact: true }) });

/* ---------- Soit ---------- */

Given("l'application est ouverte dans le navigateur", async function () {
  await this.page.goto(BASE_URL);
  await expect(this.page.getByText('Commencez par créer un projet')).toBeVisible();
});

/* ---------- Quand ---------- */

When('je crée le projet {string}', async function (nom) {
  await saisir(this, testId(this, 'project-name'), nom);
  await testId(this, 'add-project').click();
  await expect(testId(this, 'project-title')).toHaveText(nom);
});

When("j'ajoute la tâche {string}", async function (titre) {
  await saisir(this, testId(this, 'task-title'), titre);
  await testId(this, 'add-task').click();
  await expect(ligneTache(this, titre)).toBeVisible();
});

When('je renomme la tâche {string} en {string}', async function (ancien, nouveau) {
  await ligneTache(this, ancien).hover();
  await ligneTache(this, ancien).getByRole('button', { name: /Modifier/ }).click();
  const champ = testId(this, 'task-edit-input');
  await saisir(this, champ, nouveau);
  await champ.press('Enter');
});

When('je coche la tâche {string}', async function (titre) {
  await ligneTache(this, titre).getByRole('checkbox').check();
});

When('je décoche la tâche {string}', async function (titre) {
  await ligneTache(this, titre).getByRole('checkbox').uncheck();
});

When('je supprime la tâche {string}', async function (titre) {
  await ligneTache(this, titre).hover();
  await ligneTache(this, titre).getByRole('button', { name: /Supprimer/ }).click();
});

When('je supprime le projet {string} en {word}', async function (nom, choix) {
  await boutonProjet(this, nom).click();
  await testId(this, 'delete-project').click();
  await expect(testId(this, 'confirm-dialog')).toBeVisible();
  await testId(this, choix === 'confirmant' ? 'confirm-ok' : 'confirm-cancel').click();
  await expect(testId(this, 'confirm-dialog')).toBeHidden();
});

When('je sélectionne le projet {string}', async function (nom) {
  await boutonProjet(this, nom).click();
  await expect(testId(this, 'project-title')).toHaveText(nom);
});

When('je recharge la page', async function () {
  await this.page.reload();
});

When('je saisis le texte {string} dans le champ {word} et je valide', async function (texte, champ) {
  const [input, bouton] = champ === 'projet' ? ['project-name', 'add-project'] : ['task-title', 'add-task'];
  await saisir(this, testId(this, input), texte);
  await testId(this, bouton).click();
});

When('je modifie le projet avec le nom {string} et la description {string}', async function (nom, description) {
  await testId(this, 'edit-project').click();
  await saisir(this, testId(this, 'project-edit-name'), nom);
  await saisir(this, testId(this, 'project-edit-description'), description);
  await testId(this, 'project-edit-save').click();
  await expect(testId(this, 'project-dialog')).toBeHidden();
});

When('je choisis le filtre {string}', async function (nom) {
  const filtre = { Toutes: 'filter-all', 'En attente': 'filter-todo', Terminées: 'filter-done' }[nom];
  await testId(this, filtre).click();
  await expect(testId(this, filtre)).toHaveAttribute('aria-selected', 'true');
});

When('je recherche {string}', async function (texte) {
  await saisir(this, testId(this, 'task-search'), texte);
});

/* ---------- Alors ---------- */

Then('la description du projet est {string}', async function (description) {
  await expect(testId(this, 'project-description')).toHaveText(description);
});

Then('la tâche {string} affiche sa date de création', async function (titre) {
  await expect(ligneTache(this, titre)).toContainText(/Créée le \d{1,2} \S+ \d{4}/);
});

Then('la tâche {string} affiche sa date de modification', async function (titre) {
  await expect(ligneTache(this, titre)).toContainText(/Modifiée le .+ à \d{2}:\d{2}/);
});

Then('la tâche {string} a le statut {string}', async function (titre, statut) {
  await expect(ligneTache(this, titre).locator('.status-chip')).toHaveText(statut);
});


Then('le projet actif est {string}', async function (nom) {
  await expect(testId(this, 'project-title')).toHaveText(nom);
});

Then('je vois la tâche {string}', async function (titre) {
  await expect(ligneTache(this, titre)).toBeVisible();
});

Then('je ne vois plus la tâche {string}', async function (titre) {
  await expect(ligneTache(this, titre)).toHaveCount(0);
});

Then('je vois {int} tâche(s) dans la liste', async function (nombre) {
  await expect(testId(this, 'task-list').locator('li')).toHaveCount(nombre);
});

Then('la liste des tâches est vide', async function () {
  await expect(testId(this, 'task-list').locator('li')).toHaveCount(0);
  await expect(testId(this, 'empty-state')).toBeVisible();
});

Then('la progression indique {string}', async function (texte) {
  await expect(testId(this, 'progress-label')).toHaveText(texte);
});

Then('la tâche {string} est barrée', async function (titre) {
  await expect(ligneTache(this, titre)).toHaveClass(/\bdone\b/);
  await expect(ligneTache(this, titre).getByRole('checkbox')).toBeChecked();
});

Then("la tâche {string} n'est pas barrée", async function (titre) {
  await expect(ligneTache(this, titre)).not.toHaveClass(/\bdone\b/);
  await expect(ligneTache(this, titre).getByRole('checkbox')).not.toBeChecked();
});

Then("le projet {string} n'apparaît plus", async function (nom) {
  await expect(boutonProjet(this, nom)).toHaveCount(0);
});

Then("le message d'erreur {string} s'affiche", async function (message) {
  await expect(this.page.getByRole('alert').filter({ hasText: message })).toBeVisible();
});
