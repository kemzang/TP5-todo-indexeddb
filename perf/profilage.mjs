// PROFILAGE automatique : un robot (Playwright) utilise l'application pendant que
// Chromium enregistre un profil de performance, comme l'onglet "Performance" des DevTools.
//
//   node perf/profilage.mjs             (navigateur invisible)
//   node perf/profilage.mjs --visible   (on voit le robot travailler)
//
// Produit :
//   reports/profil-performance.json  -> a ouvrir dans Chrome : F12 > Performance >
//                                       bouton "Charger le profil" (fleche vers le haut)
//   reports/profil-resume.json       -> duree des etapes + resultat du test de fuite memoire
// et affiche un resume dans le terminal. Code de sortie 1 si une fuite memoire est detectee.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import httpServer from 'http-server';

process.noDeprecation = true;

const VISIBLE = process.argv.includes('--visible');
const PORT = 4210;
const NB_TACHES = 100;
const FICHIER_PROFIL = 'reports/profil-performance.json';
const FICHIER_RESUME = 'reports/profil-resume.json';

// Categories utilisees par l'onglet Performance des DevTools (CPU, rendu, captures, memoire).
const CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.screenshot',
  'disabled-by-default-v8.cpu_profiler',
  'v8.execute',
  'blink.user_timing',
  'loading',
  'latencyInfo',
];

mkdirSync('reports', { recursive: true });
const server = httpServer.createServer({ root: '.', cache: -1, showDir: false });
await new Promise((ok) => server.listen(PORT, ok));

const browser = await chromium.launch({ headless: !VISIBLE, slowMo: VISIBLE ? 40 : 0 });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');

// Lit les compteurs internes de Chromium (memes donnees que les courbes des DevTools).
async function metriques() {
  await cdp.send('HeapProfiler.collectGarbage'); // mesure la memoire reellement retenue
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
  return {
    memoireJS_Mo: +(m.JSHeapUsedSize / 1024 / 1024).toFixed(2),
    noeudsDOM: m.Nodes,
    ecouteurs: m.JSEventListeners,
    documents: m.Documents,
    tempsScript_ms: Math.round(m.ScriptDuration * 1000),
    tempsLayout_ms: Math.round(m.LayoutDuration * 1000),
    tempsStyle_ms: Math.round(m.RecalcStyleDuration * 1000),
    tempsTotalTaches_ms: Math.round(m.TaskDuration * 1000),
  };
}

const etapes = [];
async function etape(nom, action) {
  const debut = performance.now();
  await action();
  const duree = Math.round(performance.now() - debut);
  etapes.push({ etape: nom, duree_ms: duree });
  console.log(`  ✓ ${nom.padEnd(42)} ${String(duree).padStart(6)} ms`);
}

const tid = (id) => page.getByTestId(id);
const lignes = () => tid('task-list').locator('li');

console.log(`\nProfilage de l'application (${VISIBLE ? 'visible' : 'invisible'})\n`);

await page.goto(`http://localhost:${PORT}`);
await browser.startTracing(page, { path: FICHIER_PROFIL, screenshots: true, categories: CATEGORIES });

await etape('Créer le projet "Profilage"', async () => {
  await tid('project-name').fill('Profilage');
  await tid('project-name').press('Enter');
  await tid('project-title').getByText('Profilage').waitFor();
});

await etape(`Ajouter ${NB_TACHES} tâches`, async () => {
  for (let i = 1; i <= NB_TACHES; i++) {
    await tid('task-title').fill(`Tâche ${i}`);
    await tid('task-title').press('Enter');
    await lignes().nth(i - 1).waitFor();
  }
});

await etape('Cocher 30 tâches', async () => {
  for (let i = 0; i < 30; i++) {
    await lignes().nth(i).getByRole('checkbox').check();
  }
});

await etape('Renommer 10 tâches', async () => {
  for (let i = 40; i < 50; i++) {
    const ligne = lignes().nth(i);
    await ligne.hover();
    await ligne.getByRole('button', { name: /Modifier/ }).click();
    await tid('task-edit-input').fill(`Tâche renommée ${i}`);
    await tid('task-edit-input').press('Enter');
    await lignes().nth(i).getByText(`Tâche renommée ${i}`).waitFor();
  }
});

await etape('Supprimer 20 tâches', async () => {
  for (let i = 0; i < 20; i++) {
    const avantSuppression = await lignes().count();
    await lignes().last().hover();
    await lignes().last().getByRole('button', { name: /Supprimer/ }).click();
    await page.waitForFunction((n) => document.querySelectorAll('#task-list li').length === n - 1, avantSuppression);
  }
});

await etape('Créer un 2e projet et alterner 10 fois', async () => {
  await tid('project-name').fill('Autre projet');
  await tid('project-name').press('Enter');
  await tid('project-title').getByText('Autre projet').waitFor();
  for (let i = 0; i < 10; i++) {
    // Termine sur "Profilage" : c'est le projet que l'application rouvrira apres rechargement
    const cible = i % 2 === 0 ? 'Autre projet' : 'Profilage';
    await tid('project-list').getByRole('button').filter({ hasText: cible }).click();
    await tid('project-title').getByText(cible, { exact: true }).waitFor();
  }
});

await etape('Recharger la page (lecture IndexedDB)', async () => {
  await page.reload();
  await tid('project-title').getByText('Profilage', { exact: true }).waitFor();
  await page.waitForFunction((n) => document.querySelectorAll('#task-list li').length === n, NB_TACHES - 20);
});

await etape('Supprimer les 2 projets', async () => {
  for (let i = 0; i < 2; i++) {
    await tid('delete-project').click();
    await tid('confirm-ok').click();
    await tid('confirm-dialog').waitFor({ state: 'hidden' });
  }
  await page.getByText('Commencez par créer un projet').waitFor();
});

await browser.stopTracing();

// ---------------------------------------------------------------------------
// Test de fuite memoire : on repete le meme cycle (creer un projet, ajouter
// 20 taches, supprimer le projet) dans la MEME page. Une fois le regime stable
// atteint (cycle 2), memoire JS, ecouteurs et elements du DOM ne doivent plus grossir.
// Les champs sont remplis par code : la frappe clavier alimente l'historique
// d'annulation (Ctrl+Z) de Chromium, qui fausserait le comptage des noeuds.
// ---------------------------------------------------------------------------
const NB_CYCLES = 6;
console.log(`\nTest de fuite mémoire (${NB_CYCLES} cycles : créer un projet, 20 tâches, supprimer) :`);

async function remplirEtValider(champ, formulaire, valeur) {
  await page.evaluate(
    ([c, f, v]) => {
      document.querySelector(c).value = v;
      document.querySelector(f).requestSubmit();
    },
    [champ, formulaire, valeur],
  );
}

const cycles = [];
for (let c = 1; c <= NB_CYCLES; c++) {
  await remplirEtValider('#project-name', '#project-form', `Cycle ${c}`);
  await page.waitForFunction((t) => document.querySelector('#project-title').textContent === t, `Cycle ${c}`);
  for (let i = 1; i <= 20; i++) {
    await remplirEtValider('#task-title', '#task-form', `Tâche ${i}`);
    await page.waitForFunction((n) => document.querySelectorAll('#task-list li').length === n, i);
  }
  await tid('delete-project').click();
  await tid('confirm-ok').click();
  await page.waitForFunction(() => !document.querySelector('#no-project').hidden);

  const m = await metriques();
  const elements = await page.evaluate(() => document.getElementsByTagName('*').length);
  // Taches encore presentes dans la zone masquee apres suppression du projet ?
  const tachesMasquees = await page.evaluate(() => document.querySelectorAll('#task-list li').length);
  cycles.push({ cycle: c, memoireJS_Mo: m.memoireJS_Mo, ecouteurs: m.ecouteurs, elementsDOM: elements, tachesMasquees });
}
console.table(cycles);

const ref = cycles[1]; // cycle 2 : regime stable (caches et compilation JS deja faits)
const fin = cycles.at(-1);
const croissance = {
  memoireJS_Mo: +(fin.memoireJS_Mo - ref.memoireJS_Mo).toFixed(2),
  ecouteurs: fin.ecouteurs - ref.ecouteurs,
  elementsDOM: fin.elementsDOM - ref.elementsDOM,
};
const fuites = [];
const retenues = Math.max(...cycles.map((x) => x.tachesMasquees));
if (retenues > 0) fuites.push(`${retenues} tâches conservées dans la zone masquée après suppression du projet`);
if (croissance.ecouteurs > 0) fuites.push(`écouteurs +${croissance.ecouteurs}`);
if (croissance.elementsDOM > 0) fuites.push(`éléments DOM +${croissance.elementsDOM}`);
if (croissance.memoireJS_Mo > 1) fuites.push(`mémoire JS +${croissance.memoireJS_Mo} Mo`);

writeFileSync(
  FICHIER_RESUME,
  JSON.stringify({ date: new Date().toISOString(), etapes, cycles, croissance, fuites }, null, 2),
);

await browser.close();
server.close();

console.log(
  fuites.length
    ? `\n✗ Fuite mémoire détectée entre le cycle 2 et le cycle ${NB_CYCLES} : ${fuites.join(', ')}`
    : `\n✓ Pas de fuite mémoire : stable entre le cycle 2 et le cycle ${NB_CYCLES} (écouteurs ${croissance.ecouteurs >= 0 ? '+' : ''}${croissance.ecouteurs}, éléments DOM ${croissance.elementsDOM >= 0 ? '+' : ''}${croissance.elementsDOM}, mémoire JS ${croissance.memoireJS_Mo >= 0 ? '+' : ''}${croissance.memoireJS_Mo} Mo)`,
);
console.log(`\nProfil Chrome : ${FICHIER_PROFIL}`);
console.log('  → Chrome : F12 > Performance > "Charger le profil" (icône flèche vers le haut)');
console.log(`Résumé JSON  : ${FICHIER_RESUME}\n`);
process.exit(fuites.length ? 1 : 0);
