// Tests de bout en bout : un vrai Chromium pilote l'application servie par http-server.
// Ici, PAS de fake-indexeddb : c'est le vrai IndexedDB du navigateur qui est utilise.
// Chaque test recoit un contexte de navigateur neuf, donc une base vide.
import { test, expect } from '@playwright/test';

async function creerProjet(page, nom) {
  await page.getByTestId('project-name').fill(nom);
  await page.getByTestId('add-project').click();
  await expect(page.getByTestId('project-title')).toHaveText(nom);
}

async function creerTache(page, titre) {
  await page.getByTestId('task-title').fill(titre);
  await page.getByTestId('add-task').click();
  await expect(tache(page, titre)).toBeVisible();
}

const tache = (page, titre) => page.getByTestId('task-list').locator('li', { hasText: titre });
const projet = (page, nom) => page.getByTestId('project-list').getByRole('button', { name: nom });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('ajouter un projet puis une tache, et verifier la persistance apres rechargement', async ({ page }) => {
  await creerProjet(page, 'Maison');
  await creerTache(page, 'Sortir les poubelles');

  // Si la tache est bien dans IndexedDB (et pas juste dans le DOM), elle survit au rechargement.
  await page.reload();
  await expect(page.getByTestId('project-title')).toHaveText('Maison');
  await expect(page.getByTestId('task-list')).toContainText('Sortir les poubelles');
});

test('modifier une tache existante (edition en ligne)', async ({ page }) => {
  await creerProjet(page, 'Travail');
  await creerTache(page, 'Brouillon');

  await tache(page, 'Brouillon').getByRole('button', { name: /Modifier/ }).click();
  const champ = page.getByTestId('task-edit-input');
  await champ.fill('Version finale');
  await champ.press('Enter');

  await expect(page.getByTestId('task-list')).toContainText('Version finale');
  await expect(page.getByTestId('task-list')).not.toContainText('Brouillon');

  await page.reload();
  await expect(page.getByTestId('task-list')).toContainText('Version finale');
});

test("annuler l'edition avec Echap ne modifie rien", async ({ page }) => {
  await creerProjet(page, 'Travail');
  await creerTache(page, 'Original');

  await tache(page, 'Original').getByRole('button', { name: /Modifier/ }).click();
  await page.getByTestId('task-edit-input').fill('Ne doit pas etre garde');
  await page.getByTestId('task-edit-input').press('Escape');

  await expect(page.getByTestId('task-list')).toContainText('Original');
  await expect(page.getByTestId('task-list')).not.toContainText('Ne doit pas etre garde');
});

test('cocher une tache la marque terminee et cet etat persiste', async ({ page }) => {
  await creerProjet(page, 'Maison');
  await creerTache(page, 'Faire la vaisselle');
  await creerTache(page, 'Passer l\'aspirateur');

  const ligne = tache(page, 'Faire la vaisselle');
  await ligne.getByRole('checkbox').check();

  await expect(ligne).toHaveClass(/done/);
  await expect(page.getByTestId('progress-label')).toHaveText('1 / 2 terminée');

  await page.reload();
  await expect(tache(page, 'Faire la vaisselle').getByRole('checkbox')).toBeChecked();
  await expect(tache(page, 'Passer l\'aspirateur').getByRole('checkbox')).not.toBeChecked();

  // Decocher la remet a faire
  await tache(page, 'Faire la vaisselle').getByRole('checkbox').uncheck();
  await expect(tache(page, 'Faire la vaisselle')).not.toHaveClass(/done/);
});

test('supprimer une tache', async ({ page }) => {
  await creerProjet(page, 'Maison');
  await creerTache(page, 'A garder');
  await creerTache(page, 'A supprimer');

  await tache(page, 'A supprimer').getByRole('button', { name: /Supprimer/ }).click();

  await expect(page.getByTestId('task-list')).not.toContainText('A supprimer');
  await page.reload();
  await expect(page.getByTestId('task-list')).toContainText('A garder');
  await expect(page.getByTestId('task-list')).not.toContainText('A supprimer');
});

test('supprimer un projet demande confirmation et supprime ses taches', async ({ page }) => {
  await creerProjet(page, 'Vacances');
  await creerTache(page, 'Reserver le train');
  await creerProjet(page, 'Travail');
  await creerTache(page, 'Reunion');

  await projet(page, 'Vacances').click();

  // Annuler : rien n'est supprime
  await page.getByTestId('delete-project').click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('1 tâche');
  await page.getByTestId('confirm-cancel').click();
  await expect(projet(page, 'Vacances')).toBeVisible();

  // Confirmer : le projet disparait
  await page.getByTestId('delete-project').click();
  await page.getByTestId('confirm-ok').click();
  await expect(projet(page, 'Vacances')).toHaveCount(0);
  await expect(page.getByTestId('project-title')).toHaveText('Travail');

  await page.reload();
  await expect(projet(page, 'Vacances')).toHaveCount(0);
  await expect(page.getByTestId('task-list')).toContainText('Reunion');
});

test('des saisies rapides successives ne se perdent pas', async ({ page }) => {
  // Regression : le champ etait vide apres l'ecriture, effacant une saisie faite entre-temps.
  for (const nom of ['Un', 'Deux', 'Trois']) {
    await page.getByTestId('project-name').fill(nom);
    await page.getByTestId('project-name').press('Enter');
  }
  await expect(page.getByTestId('project-list').locator('li')).toHaveCount(3);
});

test('les taches sont isolees par projet', async ({ page }) => {
  await creerProjet(page, 'A');
  await creerTache(page, 'Tache du projet A');
  await creerProjet(page, 'B');

  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByTestId('task-list')).not.toContainText('Tache du projet A');

  await projet(page, 'A').click();
  await expect(page.getByTestId('task-list')).toContainText('Tache du projet A');
});

test('affiche un message clair pour une saisie vide ou faite uniquement d\'espaces', async ({ page }) => {
  await page.getByTestId('project-name').fill('    ');
  await page.getByTestId('add-project').click();
  await expect(page.getByTestId('project-error')).toHaveText('Donnez un nom au projet.');
  await expect(page.getByTestId('project-list').locator('li')).toHaveCount(0);

  await creerProjet(page, 'Maison');
  await expect(page.getByTestId('project-error')).toBeHidden();

  await page.getByTestId('project-name').fill('maison');
  await page.getByTestId('add-project').click();
  await expect(page.getByTestId('project-error')).toHaveText('Un projet porte déjà ce nom.');

  await page.getByTestId('task-title').fill('   ');
  await page.getByTestId('add-task').click();
  await expect(page.getByTestId('task-error')).toHaveText('Saisissez un titre pour la tâche.');
  await expect(page.getByTestId('task-list').locator('li')).toHaveCount(0);
});
