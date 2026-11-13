import 'fake-indexeddb/auto';
import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { openDatabase, addProject, addTask, getTasksByProject, updateTask } from '../../src/db.js';

Before(async function () {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('todo-app');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  this.db = await openDatabase();
  this.projets = {};
  this.taches = {};
  this.erreur = null;
});

After(function () {
  this.db.close();
});

Given('un projet nommé {string}', async function (nom) {
  const id = await addProject(this.db, nom);
  this.projets[nom] = id;
});

Given('une tâche {string} dans le projet {string}', async function (titre, nomProjet) {
  const projectId = this.projets[nomProjet];
  const id = await addTask(this.db, { title: titre, projectId });
  this.taches[titre] = id;
});

When("j'ajoute la tâche {string} au projet {string}", async function (titre, nomProjet) {
  const projectId = this.projets[nomProjet];
  const id = await addTask(this.db, { title: titre, projectId });
  this.taches[titre] = id;
});

When('je renomme la tâche {string} en {string}', async function (ancienTitre, nouveauTitre) {
  const id = this.taches[ancienTitre];
  await updateTask(this.db, id, { title: nouveauTitre });
  delete this.taches[ancienTitre];
  this.taches[nouveauTitre] = id;
});

When("j'essaie d'ajouter la tâche {string} sans projet", async function (titre) {
  try {
    await addTask(this.db, { title: titre, projectId: null });
  } catch (e) {
    this.erreur = e;
  }
});

Then('le projet {string} contient {int} tâche', async function (nomProjet, nombre) {
  const projectId = this.projets[nomProjet];
  const tasks = await getTasksByProject(this.db, projectId);
  assert.equal(tasks.length, nombre);
});

Then("la tâche {string} n'est pas terminée", async function (titre) {
  const id = this.taches[titre];
  const projectId = Object.values(this.projets)[0];
  const tasks = await getTasksByProject(this.db, projectId);
  const tache = tasks.find((t) => t.id === id);
  assert.equal(tache.done, false);
});

Then('le projet {string} contient la tâche {string}', async function (nomProjet, titre) {
  const projectId = this.projets[nomProjet];
  const tasks = await getTasksByProject(this.db, projectId);
  assert.ok(tasks.some((t) => t.title === titre));
});

Then('le projet {string} ne contient plus la tâche {string}', async function (nomProjet, titre) {
  const projectId = this.projets[nomProjet];
  const tasks = await getTasksByProject(this.db, projectId);
  assert.ok(!tasks.some((t) => t.title === titre));
});

Then('une erreur est levée', function () {
  assert.ok(this.erreur instanceof Error);
});
