// fake-indexeddb installe une implementation d'IndexedDB en memoire dans Node
// (qui n'en a pas). Utilise UNIQUEMENT par les tests : l'application, elle,
// tourne dans le navigateur avec le vrai IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openDatabase,
  addProject,
  getProjects,
  deleteProject,
  updateProject,
  addTask,
  getTask,
  getTasksByProject,
  updateTask,
  deleteTask,
} from '../src/db.js';

let db;

beforeEach(async () => {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('todo-app');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db = await openDatabase();
});

afterEach(() => {
  db.close();
});

describe('projets', () => {
  it('ajoute un projet et le retrouve', async () => {
    const id = await addProject(db, 'Maison');
    const projects = await getProjects(db);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id, name: 'Maison' });
  });

  it('nettoie les espaces autour du nom', async () => {
    await addProject(db, '   Maison  ');
    const [project] = await getProjects(db);
    expect(project.name).toBe('Maison');
  });

  it.each(['', '   ', null, undefined])('refuse un nom de projet invalide (%j)', async (name) => {
    await expect(addProject(db, name)).rejects.toThrow('Le nom du projet est requis');
    expect(await getProjects(db)).toHaveLength(0);
  });

  it('supprime un projet et toutes ses taches (cascade)', async () => {
    const p1 = await addProject(db, 'A supprimer');
    const p2 = await addProject(db, 'A garder');
    await addTask(db, { title: 'T1', projectId: p1 });
    await addTask(db, { title: 'T2', projectId: p1 });
    await addTask(db, { title: 'T3', projectId: p2 });

    const removed = await deleteProject(db, p1);

    expect(removed).toBe(2);
    expect(await getProjects(db)).toMatchObject([{ id: p2 }]);
    expect(await getTasksByProject(db, p1)).toHaveLength(0);
    expect(await getTasksByProject(db, p2)).toHaveLength(1);
  });

  it("rejette la suppression d'un projet inexistant", async () => {
    await expect(deleteProject(db, 999)).rejects.toThrow('Projet introuvable');
  });

  it('enregistre la date de creation et une description facultative', async () => {
    const avant = Date.now();
    await addProject(db, 'Cours', '  Devoirs du semestre ');
    await addProject(db, 'Sans description');
    const [cours, sans] = await getProjects(db);
    expect(cours.description).toBe('Devoirs du semestre');
    expect(cours.createdAt).toBeGreaterThanOrEqual(avant);
    expect(sans.description).toBe('');
  });

  it('modifie le nom et la description d\'un projet', async () => {
    const id = await addProject(db, 'Brouillon');
    const updated = await updateProject(db, id, { name: ' Final ', description: 'Rendu le 20' });
    expect(updated).toMatchObject({ id, name: 'Final', description: 'Rendu le 20' });
    expect(typeof updated.updatedAt).toBe('number');
    expect((await getProjects(db))[0].name).toBe('Final');
  });

  it('refuse de renommer un projet avec un nom vide', async () => {
    const id = await addProject(db, 'Garde son nom');
    await expect(updateProject(db, id, { name: '   ' })).rejects.toThrow('Le nom du projet est requis');
    expect((await getProjects(db))[0].name).toBe('Garde son nom');
  });

  it("rejette la modification d'un projet inexistant", async () => {
    await expect(updateProject(db, 999, { name: 'x' })).rejects.toThrow('Projet introuvable');
  });
});

describe('taches', () => {
  let projectId;

  beforeEach(async () => {
    projectId = await addProject(db, 'Travail');
  });

  it('ajoute une tache a un projet, non terminee par defaut', async () => {
    const taskId = await addTask(db, { title: 'Ecrire le rapport', projectId });
    const tasks = await getTasksByProject(db, projectId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: taskId, title: 'Ecrire le rapport', projectId, done: false });
    expect(typeof tasks[0].createdAt).toBe('number');
  });

  it('refuse une tache sans projet', async () => {
    await expect(addTask(db, { title: 'Orpheline', projectId: null })).rejects.toThrow(
      'La tache doit appartenir a un projet',
    );
  });

  it('refuse une tache rattachee a un projet inexistant', async () => {
    await expect(addTask(db, { title: 'Fantome', projectId: 999 })).rejects.toThrow('Projet introuvable');
    expect(await getTasksByProject(db, 999)).toHaveLength(0);
  });

  it.each(['', '   '])('refuse une tache sans titre (%j)', async (title) => {
    await expect(addTask(db, { title, projectId })).rejects.toThrow('Le titre de la tache est requis');
  });

  it("modifie le titre d'une tache existante", async () => {
    const taskId = await addTask(db, { title: 'Brouillon', projectId });
    await updateTask(db, taskId, { title: '  Version finale ' });
    expect((await getTask(db, taskId)).title).toBe('Version finale');
  });

  it('enregistre la date de modification, sans toucher a la date de creation', async () => {
    const taskId = await addTask(db, { title: 'Datee', projectId });
    const creee = await getTask(db, taskId);
    expect(creee.updatedAt).toBeUndefined();
    const modifiee = await updateTask(db, taskId, { done: true });
    expect(modifiee.createdAt).toBe(creee.createdAt);
    expect(modifiee.updatedAt).toBeGreaterThanOrEqual(creee.createdAt);
  });

  it('refuse de renommer une tache avec un titre vide', async () => {
    const taskId = await addTask(db, { title: 'Brouillon', projectId });
    await expect(updateTask(db, taskId, { title: '  ' })).rejects.toThrow();
    expect((await getTask(db, taskId)).title).toBe('Brouillon');
  });

  it('marque une tache comme terminee puis la rouvre, sans toucher au reste', async () => {
    const taskId = await addTask(db, { title: 'A faire', projectId });
    await updateTask(db, taskId, { done: true });
    expect(await getTask(db, taskId)).toMatchObject({ title: 'A faire', done: true, projectId });
    await updateTask(db, taskId, { done: false });
    expect((await getTask(db, taskId)).done).toBe(false);
  });

  it("ne permet pas de changer l'id ni le projet via updateTask", async () => {
    const taskId = await addTask(db, { title: 'Stable', projectId });
    const updated = await updateTask(db, taskId, { id: 42, projectId: 777 });
    expect(updated).toMatchObject({ id: taskId, projectId });
  });

  it("rejette la modification d'une tache inexistante", async () => {
    await expect(updateTask(db, 999, { title: 'x' })).rejects.toThrow('Tache introuvable');
  });

  it('supprime une tache', async () => {
    const keep = await addTask(db, { title: 'Garder', projectId });
    const remove = await addTask(db, { title: 'Supprimer', projectId });
    await deleteTask(db, remove);
    const tasks = await getTasksByProject(db, projectId);
    expect(tasks.map((t) => t.id)).toEqual([keep]);
  });

  it("rejette la suppression d'une tache inexistante", async () => {
    await expect(deleteTask(db, 999)).rejects.toThrow('Tache introuvable');
  });

  it('isole les taches par projet', async () => {
    const autre = await addProject(db, 'Autre');
    await addTask(db, { title: 'Tache A', projectId });
    await addTask(db, { title: 'Tache B', projectId: autre });

    const tasksA = await getTasksByProject(db, projectId);
    const tasksB = await getTasksByProject(db, autre);
    expect(tasksA.map((t) => t.title)).toEqual(['Tache A']);
    expect(tasksB.map((t) => t.title)).toEqual(['Tache B']);
  });
});
