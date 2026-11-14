// Couche interface : lit/ecrit via db.js (vrai IndexedDB du navigateur) et met a jour le DOM.
import {
  openDatabase,
  addProject,
  getProjects,
  deleteProject,
  addTask,
  getTasksByProject,
  updateTask,
  deleteTask,
} from './db.js';

const $ = (id) => document.getElementById(id);

const els = {
  projectList: $('project-list'),
  projectsEmpty: $('projects-empty'),
  projectForm: $('project-form'),
  projectName: $('project-name'),
  projectError: $('project-error'),
  noProject: $('no-project'),
  projectView: $('project-view'),
  projectTitle: $('project-title'),
  deleteProjectBtn: $('delete-project'),
  progressFill: $('progress-fill'),
  progressLabel: $('progress-label'),
  taskForm: $('task-form'),
  taskTitle: $('task-title'),
  taskError: $('task-error'),
  taskList: $('task-list'),
  emptyState: $('empty-state'),
  dialog: $('confirm-dialog'),
  dialogTitle: $('confirm-title'),
  dialogMessage: $('confirm-message'),
  toast: $('toast'),
};

// Etat de l'interface. La source de verite reste IndexedDB : on recharge apres chaque ecriture.
const state = {
  db: null,
  projects: [],
  counts: new Map(), // projectId -> { total, done }
  currentProjectId: null,
  tasks: [],
  editingTaskId: null,
};

// Seule preference d'affichage gardee hors IndexedDB : le dernier projet ouvert.
const LAST_PROJECT_KEY = 'todo-app:last-project';
function rememberProject(id) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, String(id));
  } catch {
    /* stockage indisponible : sans consequence */
  }
}
function recallProject() {
  try {
    return Number(localStorage.getItem(LAST_PROJECT_KEY)) || null;
  } catch {
    return null;
  }
}

/* =========================================================
   Retours utilisateur : erreurs de champ, notification, confirmation
   ========================================================= */

function showFieldError(input, errorEl, message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  input.focus();
}

function clearFieldError(input, errorEl) {
  errorEl.hidden = true;
  errorEl.textContent = '';
  input.removeAttribute('aria-invalid');
}

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 3000);
}

function confirmAction(title, message) {
  els.dialogTitle.textContent = title;
  els.dialogMessage.textContent = message;
  els.dialog.returnValue = '';
  els.dialog.showModal();
  return new Promise((resolve) => {
    els.dialog.addEventListener('close', () => resolve(els.dialog.returnValue === 'confirm'), { once: true });
  });
}

// Toute action asynchrone passe par ici : une erreur n'est jamais silencieuse.
async function safely(action, fallbackMessage = 'Une erreur est survenue.') {
  try {
    await action();
  } catch (error) {
    console.error(error);
    toast(error?.message || fallbackMessage);
  }
}

function plural(n, word) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

/* =========================================================
   Chargement depuis IndexedDB
   ========================================================= */

async function loadProjects() {
  state.projects = await getProjects(state.db);

  const lists = await Promise.all(state.projects.map((p) => getTasksByProject(state.db, p.id)));
  state.counts = new Map(
    state.projects.map((p, i) => [p.id, { total: lists[i].length, done: lists[i].filter((t) => t.done).length }]),
  );

  const exists = (id) => state.projects.some((p) => p.id === id);
  if (!exists(state.currentProjectId)) {
    const remembered = recallProject();
    state.currentProjectId = exists(remembered) ? remembered : (state.projects[0]?.id ?? null);
  }
}

async function loadTasks() {
  state.tasks =
    state.currentProjectId == null
      ? []
      : (await getTasksByProject(state.db, state.currentProjectId)).sort((a, b) => a.createdAt - b.createdAt);
}

async function reload() {
  await loadProjects();
  await loadTasks();
  render();
}

/* =========================================================
   Rendu
   ========================================================= */

function render() {
  renderProjects();
  renderTasks();
}

function renderProjects() {
  els.projectList.replaceChildren(
    ...state.projects.map((project) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-item';
      btn.dataset.projectId = project.id;
      btn.setAttribute('aria-current', String(project.id === state.currentProjectId));
      btn.innerHTML = '<svg aria-hidden="true"><use href="#i-folder"/></svg>';

      const name = document.createElement('span');
      name.className = 'project-name';
      name.textContent = project.name; // textContent : pas d'injection HTML possible
      name.title = project.name;

      const count = state.counts.get(project.id) ?? { total: 0, done: 0 };
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = count.total - count.done;
      badge.title = `${plural(count.total - count.done, 'tâche')} restante(s)`;

      btn.append(name, badge);
      btn.addEventListener('click', () => selectProject(project.id));
      li.append(btn);
      return li;
    }),
  );
  els.projectsEmpty.hidden = state.projects.length > 0;
}

// N'ecrit le titre de l'onglet que s'il change (evite des ecritures inutiles a chaque rendu).
function setTitle(title) {
  if (document.title !== title) document.title = title;
}

function renderTasks() {
  const project = state.projects.find((p) => p.id === state.currentProjectId);
  els.noProject.hidden = Boolean(project);
  els.projectView.hidden = !project;
  if (!project) {
    // Vider la liste : sinon les anciennes taches (et leurs ecouteurs) restent
    // en memoire dans la zone masquee. Defaut detecte par le profilage memoire.
    els.taskList.replaceChildren();
    setTitle('Mes tâches');
    return;
  }

  els.projectTitle.textContent = project.name;
  setTitle(`${project.name} · Mes tâches`);

  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.done).length;
  els.progressFill.style.width = total ? `${(done / total) * 100}%` : '0';
  els.progressLabel.textContent = total ? `${done} / ${total} terminée${done > 1 ? 's' : ''}` : 'Aucune tâche';

  els.taskList.replaceChildren(...state.tasks.map(renderTask));
  els.emptyState.hidden = total > 0;
}

function iconButton(icon, label, extraClass = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `icon-btn ${extraClass}`.trim();
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.innerHTML = `<svg aria-hidden="true"><use href="#${icon}"/></svg>`;
  return btn;
}

function renderTask(task) {
  const li = document.createElement('li');
  li.className = 'task-item' + (task.done ? ' done' : '');
  li.dataset.taskId = task.id;

  if (task.id === state.editingTaskId) {
    li.classList.add('editing');
    li.append(renderEditForm(task));
    return li;
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.done;
  checkbox.setAttribute('aria-label', `Marquer « ${task.title} » comme terminée`);
  checkbox.addEventListener('change', () =>
    safely(async () => {
      await updateTask(state.db, task.id, { done: checkbox.checked });
      await reload();
      focusInTask(task.id, '.task-checkbox');
    }),
  );

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;
  title.addEventListener('dblclick', () => startEditing(task.id));

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = iconButton('i-edit', `Modifier la tâche « ${task.title} »`);
  editBtn.addEventListener('click', () => startEditing(task.id));

  const deleteBtn = iconButton('i-trash', `Supprimer la tâche « ${task.title} »`, 'danger');
  deleteBtn.addEventListener('click', () =>
    safely(async () => {
      await deleteTask(state.db, task.id);
      await reload();
      toast('Tâche supprimée');
    }),
  );

  actions.append(editBtn, deleteBtn);
  li.append(checkbox, title, actions);
  return li;
}

// Edition directement dans la ligne (Entree = enregistrer, Echap = annuler).
function renderEditForm(task) {
  const form = document.createElement('form');
  form.className = 'task-edit-form';
  form.noValidate = true;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.title;
  input.maxLength = 200;
  input.setAttribute('aria-label', 'Nouveau titre de la tâche');
  input.dataset.testid = 'task-edit-input';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') stopEditing();
  });
  input.addEventListener('input', () => input.removeAttribute('aria-invalid'));

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'btn btn-primary';
  save.textContent = 'Enregistrer';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-secondary';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', stopEditing);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const newTitle = input.value.trim();
    if (!newTitle) {
      input.setAttribute('aria-invalid', 'true');
      toast('Le titre ne peut pas être vide.');
      input.focus();
      return;
    }
    safely(async () => {
      if (newTitle !== task.title) await updateTask(state.db, task.id, { title: newTitle });
      state.editingTaskId = null;
      await reload();
      focusInTask(task.id, '.task-title');
    });
  });

  form.append(input, save, cancel);
  queueMicrotask(() => {
    input.focus();
    input.select();
  });
  return form;
}

function startEditing(taskId) {
  state.editingTaskId = taskId;
  renderTasks();
}

function stopEditing() {
  const id = state.editingTaskId;
  state.editingTaskId = null;
  renderTasks();
  focusInTask(id, '.icon-btn');
}

function focusInTask(taskId, selector) {
  const el = els.taskList.querySelector(`[data-task-id="${taskId}"] ${selector}`);
  if (el) {
    if (selector === '.task-title') el.tabIndex = -1;
    el.focus();
  }
}

/* =========================================================
   Actions
   ========================================================= */

async function selectProject(id) {
  state.currentProjectId = id;
  state.editingTaskId = null;
  rememberProject(id);
  clearFieldError(els.taskTitle, els.taskError);
  await safely(async () => {
    await loadTasks();
    render();
  });
}

els.projectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = els.projectName.value.trim();
  if (!name) {
    showFieldError(els.projectName, els.projectError, 'Donnez un nom au projet.');
    return;
  }
  if (state.projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    showFieldError(els.projectName, els.projectError, 'Un projet porte déjà ce nom.');
    return;
  }
  // On vide le champ tout de suite (et non apres l'ecriture) pour ne pas effacer
  // une saisie faite pendant l'enregistrement ; on la restaure en cas d'echec.
  els.projectName.value = '';
  clearFieldError(els.projectName, els.projectError);
  safely(async () => {
    try {
      const id = await addProject(state.db, name);
      state.currentProjectId = id;
      rememberProject(id);
    } catch (error) {
      if (!els.projectName.value) els.projectName.value = name;
      throw error;
    }
    await reload();
    els.taskTitle.focus();
  });
});

els.taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = els.taskTitle.value.trim();
  if (!title) {
    showFieldError(els.taskTitle, els.taskError, 'Saisissez un titre pour la tâche.');
    return;
  }
  els.taskTitle.value = '';
  clearFieldError(els.taskTitle, els.taskError);
  safely(async () => {
    try {
      await addTask(state.db, { title, projectId: state.currentProjectId });
    } catch (error) {
      if (!els.taskTitle.value) els.taskTitle.value = title;
      throw error;
    }
    await reload();
    els.taskTitle.focus();
  });
});

els.projectName.addEventListener('input', () => clearFieldError(els.projectName, els.projectError));
els.taskTitle.addEventListener('input', () => clearFieldError(els.taskTitle, els.taskError));

els.deleteProjectBtn.addEventListener('click', () =>
  safely(async () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;
    const n = state.counts.get(project.id)?.total ?? 0;
    const ok = await confirmAction(
      `Supprimer « ${project.name} » ?`,
      n
        ? `Le projet et ses ${plural(n, 'tâche')} seront définitivement supprimés.`
        : 'Ce projet vide sera définitivement supprimé.',
    );
    if (!ok) return;
    await deleteProject(state.db, project.id);
    state.currentProjectId = null;
    await reload();
    toast(`Projet « ${project.name} » supprimé`);
  }),
);

/* =========================================================
   Demarrage
   ========================================================= */

async function init() {
  try {
    state.db = await openDatabase();
    await reload();
  } catch (error) {
    console.error(error);
    toast("Impossible d'ouvrir la base de données locale (IndexedDB).");
  }
}

init();
