const DB_NAME = 'todo-app';
const DB_VERSION = 1;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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

export function addProject(db, name) {
  return new Promise((resolve, reject) => {
    if (!name || !name.trim()) {
      reject(new Error('Le nom du projet est requis'));
      return;
    }
    const tx = db.transaction('projects', 'readwrite');
    const request = tx.objectStore('projects').add({ name: name.trim() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getProjects(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const request = tx.objectStore('projects').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function addTask(db, { title, projectId }) {
  return new Promise((resolve, reject) => {
    if (!title || !title.trim()) {
      reject(new Error('Le titre de la tache est requis'));
      return;
    }
    if (projectId == null) {
      reject(new Error('La tache doit appartenir a un projet'));
      return;
    }
    const tx = db.transaction('tasks', 'readwrite');
    const request = tx.objectStore('tasks').add({
      title: title.trim(),
      projectId,
      done: false,
      createdAt: Date.now(),
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getTasksByProject(db, projectId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const index = tx.objectStore('tasks').index('byProject');
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function updateTask(db, id, changes) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) {
        reject(new Error('Tache introuvable : ' + id));
        return;
      }
      const updated = { ...existing, ...changes, id };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}
