// Relie chaque phrase Gherkin de features/*.feature a du code.
// Comme pour Vitest, fake-indexeddb fournit IndexedDB sous Node (tests uniquement).
import 'fake-indexeddb/auto';
import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import {
  openDatabase,
  addProject,
  getProjects,
  deleteProject,
  addTask,
  getTask,
  getTasksByProject,
  updateTask,
  deleteTask,
} from '../../src/db.js';

// "this" est le World Cucumber : un objet neuf par scenario, partage entre ses etapes.
Before(async function () {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('todo-app');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  this.db = await openDatabase();
  this.projets = {}; // nom du projet -> id
  this.taches = {}; // titre de la tache -> id
  this.erreur = null;
});

After(function () {
  this.db.close();
});

function idProjet(world, nom) {
  assert.ok(nom in world.projets, `Projet inconnu dans le scenario : ${nom}`);
  return world.projets[nom];
}

function idTache(world, titre) {
  assert.ok(titre in world.taches, `Tache inconnue dans le scenario : ${titre}`);
  return world.taches[titre];
}

async function titresDuProjet(world, nom) {
  const tasks = await getTasksByProject(world.db, idProjet(world, nom));
  return tasks.map((t) => t.title);
}

/* ---------- Soit ---------- */

Given('un projet nommé {string}', async function (nom) {
  this.projets[nom] = await addProject(this.db, nom);
});

Given('une tâche {string} dans le projet {string}', async function (titre, nomProjet) {
  this.taches[titre] = await addTask(this.db, { title: titre, projectId: idProjet(this, nomProjet) });
});

/* ---------- Quand ---------- */

When("j'ajoute la tâche {string} au projet {string}", async function (titre, nomProjet) {
  this.taches[titre] = await addTask(this.db, { title: titre, projectId: idProjet(this, nomProjet) });
});

When('je renomme la tâche {string} en {string}', async function (ancienTitre, nouveauTitre) {
  const id = idTache(this, ancienTitre);
  await updateTask(this.db, id, { title: nouveauTitre });
  delete this.taches[ancienTitre];
  this.taches[nouveauTitre] = id;
});

When('je marque la tâche {string} comme terminée', async function (titre) {
  await updateTask(this.db, idTache(this, titre), { done: true });
});

When('je supprime la tâche {string}', async function (titre) {
  await deleteTask(this.db, idTache(this, titre));
});

When('je supprime le projet {string}', async function (nom) {
  await deleteProject(this.db, idProjet(this, nom));
});

async function essayer(world, action) {
  try {
    await action();
  } catch (e) {
    world.erreur = e;
  }
}

When("j'essaie d'ajouter la tâche {string} sans projet", async function (titre) {
  await essayer(this, () => addTask(this.db, { title: titre, projectId: null }));
});

When("j'essaie d'ajouter la tâche {string} au projet {string}", async function (titre, nomProjet) {
  await essayer(this, () => addTask(this.db, { title: titre, projectId: idProjet(this, nomProjet) }));
});

When("j'essaie d'ajouter la tâche {string} au projet inexistant", async function (titre) {
  await essayer(this, () => addTask(this.db, { title: titre, projectId: 999 }));
});

/* ---------- Alors ---------- */

Then('le projet {string} contient {int} tâche(s)', async function (nom, nombre) {
  assert.equal((await titresDuProjet(this, nom)).length, nombre);
});

// La tache est relue directement par son id : peu importe le projet auquel elle appartient.
Then("la tâche {string} n'est pas terminée", async function (titre) {
  const tache = await getTask(this.db, idTache(this, titre));
  assert.ok(tache, `La tache ${titre} n'existe pas en base`);
  assert.equal(tache.done, false);
});

Then('la tâche {string} est terminée', async function (titre) {
  const tache = await getTask(this.db, idTache(this, titre));
  assert.ok(tache, `La tache ${titre} n'existe pas en base`);
  assert.equal(tache.done, true);
});

Then('le projet {string} contient la tâche {string}', async function (nom, titre) {
  assert.ok((await titresDuProjet(this, nom)).includes(titre));
});

Then('le projet {string} ne contient plus la tâche {string}', async function (nom, titre) {
  assert.ok(!(await titresDuProjet(this, nom)).includes(titre));
});

Then("le projet {string} n'existe plus", async function (nom) {
  const projets = await getProjects(this.db);
  assert.ok(!projets.some((p) => p.id === idProjet(this, nom)));
});

Then('aucune tâche du projet {string} ne subsiste', async function (nom) {
  assert.equal((await titresDuProjet(this, nom)).length, 0);
});

Then('une erreur {string} est levée', function (message) {
  assert.ok(this.erreur instanceof Error, 'Aucune erreur levee');
  assert.match(this.erreur.message, new RegExp(message));
});
