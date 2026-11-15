// Couche d'acces aux donnees (IndexedDB).
// Aucune dependance au DOM : ce module est teste sous Node avec fake-indexeddb
// et utilise tel quel par l'application dans le navigateur (vrai IndexedDB).

const DB_NAME = 'todo-app';
const DB_VERSION = 1;

// Transforme une IDBRequest (API a callbacks) en Promise.
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Resout quand la transaction est reellement validee (commit) sur le disque.
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction annulee'));
  });
}

function requireText(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Appele uniquement a la creation de la base ou lors d'un changement de version.
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('tasks')) {
        const tasks = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
        tasks.createIndex('byProject', 'projectId');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ---------- Projets ---------- */

function cleanDescription(description) {
  return typeof description === 'string' ? description.trim() : '';
}

export async function addProject(db, name, description = '') {
  const cleanName = requireText(name, 'Le nom du projet est requis');
  const tx = db.transaction('projects', 'readwrite');
  const id = await promisify(
    tx.objectStore('projects').add({
      name: cleanName,
      description: cleanDescription(description),
      createdAt: Date.now(),
    }),
  );
  await transactionDone(tx);
  return id;
}

export function getProjects(db) {
  const tx = db.transaction('projects', 'readonly');
  return promisify(tx.objectStore('projects').getAll());
}

// Modifie le nom et/ou la description d'un projet (lecture + ecriture atomiques).
export async function updateProject(db, id, changes) {
  const patch = {};
  if ('name' in changes) patch.name = requireText(changes.name, 'Le nom du projet est requis');
  if ('description' in changes) patch.description = cleanDescription(changes.description);

  const tx = db.transaction('projects', 'readwrite');
  const done = transactionDone(tx);
  const store = tx.objectStore('projects');

  const existing = await promisify(store.get(id));
  if (!existing) {
    tx.abort();
    await done.catch(() => {});
    throw new Error('Projet introuvable : ' + id);
  }

  const updated = { ...existing, ...patch, id, updatedAt: Date.now() };
  store.put(updated);
  await done;
  return updated;
}

// Supprime un projet ET toutes ses taches dans une seule transaction :
// soit tout est supprime, soit rien (pas de taches orphelines).
export async function deleteProject(db, projectId) {
  const tx = db.transaction(['projects', 'tasks'], 'readwrite');
  const done = transactionDone(tx);
  const projects = tx.objectStore('projects');
  const tasks = tx.objectStore('tasks');

  const existing = await promisify(projects.get(projectId));
  if (!existing) {
    tx.abort();
    await done.catch(() => {});
    throw new Error('Projet introuvable : ' + projectId);
  }

  const taskIds = await promisify(tasks.index('byProject').getAllKeys(projectId));
  for (const id of taskIds) tasks.delete(id);
  projects.delete(projectId);

  await done;
  return taskIds.length;
}

/* ---------- Taches ---------- */

// Verifie que le projet existe dans la meme transaction que l'ajout (integrite referentielle).
export async function addTask(db, { title, projectId }) {
  const cleanTitle = requireText(title, 'Le titre de la tache est requis');
  if (projectId == null) {
    throw new Error('La tache doit appartenir a un projet');
  }

  const tx = db.transaction(['projects', 'tasks'], 'readwrite');
  const done = transactionDone(tx);

  const project = await promisify(tx.objectStore('projects').get(projectId));
  if (!project) {
    tx.abort();
    await done.catch(() => {});
    throw new Error('Projet introuvable : ' + projectId);
  }

  const id = await promisify(
    tx.objectStore('tasks').add({
      title: cleanTitle,
      projectId,
      done: false,
      createdAt: Date.now(),
    }),
  );
  await done;
  return id;
}

export function getTask(db, id) {
  const tx = db.transaction('tasks', 'readonly');
  return promisify(tx.objectStore('tasks').get(id));
}

export function getTasksByProject(db, projectId) {
  const tx = db.transaction('tasks', 'readonly');
  return promisify(tx.objectStore('tasks').index('byProject').getAll(projectId));
}

// Lecture + ecriture dans la meme transaction : la mise a jour est atomique.
export async function updateTask(db, id, changes) {
  const patch = { ...changes };
  if ('title' in patch) {
    patch.title = requireText(patch.title, 'Le titre de la tache est requis');
  }
  if ('done' in patch) {
    patch.done = Boolean(patch.done);
  }
  delete patch.projectId; // une tache ne change pas de projet via cette fonction

  const tx = db.transaction('tasks', 'readwrite');
  const done = transactionDone(tx);
  const store = tx.objectStore('tasks');

  const existing = await promisify(store.get(id));
  if (!existing) {
    tx.abort();
    await done.catch(() => {});
    throw new Error('Tache introuvable : ' + id);
  }

  const updated = { ...existing, ...patch, id, updatedAt: Date.now() };
  store.put(updated);
  await done;
  return updated;
}

export async function deleteTask(db, id) {
  const tx = db.transaction('tasks', 'readwrite');
  const done = transactionDone(tx);
  const store = tx.objectStore('tasks');

  const existing = await promisify(store.get(id));
  if (!existing) {
    tx.abort();
    await done.catch(() => {});
    throw new Error('Tache introuvable : ' + id);
  }

  store.delete(id);
  await done;
}
