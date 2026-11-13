import { test, expect } from '@playwright/test';

test('ajouter un projet puis une tache, et verifier la persistance apres rechargement', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('project-name').fill('Maison');
  await page.getByTestId('add-project').click();
  await expect(page.getByTestId('project-select')).toContainText('Maison');

  await page.getByTestId('task-title').fill('Sortir les poubelles');
  await page.getByTestId('add-task').click();
  await expect(page.getByTestId('task-list')).toContainText('Sortir les poubelles');

  // Si la tache est bien dans IndexedDB (et pas juste en memoire DOM), elle doit survivre au reload.
  await page.reload();
  await expect(page.getByTestId('task-list')).toContainText('Sortir les poubelles');
});

test('modifier une tache existante', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('project-name').fill('Travail');
  await page.getByTestId('add-project').click();

  await page.getByTestId('task-title').fill('Brouillon');
  await page.getByTestId('add-task').click();

  page.once('dialog', (dialog) => dialog.accept('Version finale'));
  await page.locator('li', { hasText: 'Brouillon' }).getByRole('button', { name: 'Modifier' }).click();

  await expect(page.getByTestId('task-list')).toContainText('Version finale');
  await expect(page.getByTestId('task-list')).not.toContainText('Brouillon');
});
