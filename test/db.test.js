import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, addProject, getProjects, addTask, getTasksByProject, updateTask } from '../src/db.js';

describe('db', () => {
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

  it('ajoute un projet et le retrouve', async () => {
    const id = await addProject(db, 'Maison');
    const projects = await getProjects(db);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id, name: 'Maison' });
  });

  it('refuse un projet sans nom', async () => {
    await expect(addProject(db, '')).rejects.toThrow();
  });

  it('ajoute une tache a un projet', async () => {
    const projectId = await addProject(db, 'Travail');
    const taskId = await addTask(db, { title: 'Ecrire le rapport', projectId });
    const tasks = await getTasksByProject(db, projectId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: taskId, title: 'Ecrire le rapport', projectId, done: false });
  });

  it('refuse une tache sans projet', async () => {
    await expect(addTask(db, { title: 'Orpheline', projectId: null })).rejects.toThrow();
  });

  it("refuse une tache sans titre", async () => {
    const projectId = await addProject(db, 'Travail');
    await expect(addTask(db, { title: '  ', projectId })).rejects.toThrow();
  });

  it("modifie le titre d'une tache existante", async () => {
    const projectId = await addProject(db, 'Travail');
    const taskId = await addTask(db, { title: 'Brouillon', projectId });
    await updateTask(db, taskId, { title: 'Version finale' });
    const tasks = await getTasksByProject(db, projectId);
    expect(tasks[0].title).toBe('Version finale');
  });

  it('marque une tache comme terminee sans toucher au reste', async () => {
    const projectId = await addProject(db, 'Travail');
    const taskId = await addTask(db, { title: 'A faire', projectId });
    await updateTask(db, taskId, { done: true });
    const tasks = await getTasksByProject(db, projectId);
    expect(tasks[0]).toMatchObject({ title: 'A faire', done: true, projectId });
  });

  it('rejette la modification d\'une tache inexistante', async () => {
    await expect(updateTask(db, 999, { title: 'x' })).rejects.toThrow();
  });

  it('isole les taches par projet', async () => {
    const p1 = await addProject(db, 'Projet A');
    const p2 = await addProject(db, 'Projet B');
    await addTask(db, { title: 'Tache A', projectId: p1 });
    await addTask(db, { title: 'Tache B', projectId: p2 });

    const tasksA = await getTasksByProject(db, p1);
    const tasksB = await getTasksByProject(db, p2);
    expect(tasksA).toHaveLength(1);
    expect(tasksB).toHaveLength(1);
    expect(tasksA[0].title).toBe('Tache A');
  });
});
