import { openDatabase, addProject, getProjects, addTask, getTasksByProject, updateTask } from './db.js';

let db;
let currentProjectId = null;

async function init() {
  db = await openDatabase();
  await refreshProjects();
}

async function refreshProjects() {
  const projects = await getProjects(db);
  const select = document.getElementById('project-select');
  select.innerHTML = '';
  for (const p of projects) {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    select.appendChild(option);
  }
  if (projects.length > 0) {
    const stillExists = projects.some((p) => p.id === currentProjectId);
    currentProjectId = stillExists ? currentProjectId : projects[projects.length - 1].id;
    select.value = currentProjectId;
  } else {
    currentProjectId = null;
  }
  await refreshTasks();
}

async function refreshTasks() {
  const list = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  list.innerHTML = '';
  if (currentProjectId == null) {
    emptyState.hidden = true;
    return;
  }
  const tasks = await getTasksByProject(db, Number(currentProjectId));
  emptyState.hidden = tasks.length > 0;

  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'task-item' + (t.done ? ' done' : '');
    li.dataset.taskId = t.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = t.done;
    checkbox.addEventListener('change', async () => {
      await updateTask(db, t.id, { done: checkbox.checked });
      li.classList.toggle('done', checkbox.checked);
    });

    const titleSpan = document.createElement('span');
    titleSpan.textContent = t.title;
    titleSpan.className = 'task-title';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'task-edit';
    editBtn.textContent = 'Modifier';
    editBtn.addEventListener('click', async () => {
      const nouveauTitre = prompt('Nouveau titre :', t.title);
      if (nouveauTitre && nouveauTitre.trim()) {
        await updateTask(db, t.id, { title: nouveauTitre.trim() });
        await refreshTasks();
      }
    });

    li.append(checkbox, titleSpan, editBtn);
    list.appendChild(li);
  }
}

document.getElementById('project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('project-name');
  await addProject(db, input.value);
  input.value = '';
  await refreshProjects();
});

document.getElementById('project-select').addEventListener('change', async (e) => {
  currentProjectId = Number(e.target.value);
  await refreshTasks();
});

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('task-title');
  if (currentProjectId == null) {
    alert("Cree d'abord un projet");
    return;
  }
  await addTask(db, { title: input.value, projectId: currentProjectId });
  input.value = '';
  await refreshTasks();
});

init();
