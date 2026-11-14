// Test de PERFORMANCE dans le navigateur (module k6/browser).
// k6 pilote un vrai Chromium : il cree un projet, ajoute de nombreuses taches,
// en coche une, recharge la page puis supprime le projet, en mesurant :
//  - les Web Vitals (FCP, LCP, CLS) fournis automatiquement par k6 ;
//  - le temps d'ajout d'une tache (ecriture IndexedDB + affichage), mesure DANS la page ;
//  - le temps d'une action complete du robot (frappe + clic + attente), a titre de comparaison ;
//  - le temps de rechargement d'un projet volumineux (lecture IndexedDB + affichage).
import { browser } from 'k6/browser';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4200';
const NB_TACHES = Number(__ENV.NB_TACHES || 50);

const tempsAjoutTache = new Trend('temps_ajout_tache', true);
const tempsActionRobot = new Trend('temps_action_robot', true);
const tempsRechargement = new Trend('temps_rechargement_projet', true);

export const options = {
  scenarios: {
    utilisateur: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 3,
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    browser_web_vital_fcp: ['p(95)<1800'], // premier affichage
    browser_web_vital_lcp: ['p(95)<2500'], // plus grand element affiche
    browser_web_vital_cls: ['p(95)<0.1'], // stabilite de la mise en page
    temps_ajout_tache: ['p(95)<100'], // reactivite de l'application elle-meme
    temps_rechargement_projet: ['p(95)<1500'],
    checks: ['rate==1.0'],
  },
};

// Chronometre dans la page : du clic sur "Ajouter" jusqu'a l'apparition de la tache
// dans la liste (MutationObserver). Mesure l'application, sans le cout du robot.
function ajouterEtChronometrer(titre) {
  return new Promise((resolve, reject) => {
    const liste = document.querySelector('#task-list');
    const avant = liste.children.length;
    document.querySelector('[data-testid="task-title"]').value = titre;
    const t0 = performance.now();
    const observateur = new MutationObserver(() => {
      if (liste.children.length > avant) {
        observateur.disconnect();
        resolve(performance.now() - t0);
      }
    });
    observateur.observe(liste, { childList: true });
    document.querySelector('[data-testid="add-task"]').click();
    setTimeout(() => reject(new Error('Tache non affichee apres 5 s')), 5000);
  });
}

const nbTaches = (page) => page.evaluate(() => document.querySelectorAll('#task-list li').length);

export default async function () {
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // 1. Creer un projet
    await page.locator('[data-testid="project-name"]').fill('Projet de charge');
    await page.locator('[data-testid="add-project"]').click();
    await page.waitForFunction(() => document.querySelector('#project-title')?.textContent === 'Projet de charge');

    // 2. Ajouter NB_TACHES taches en chronometrant chacune
    for (let i = 1; i <= NB_TACHES; i++) {
      if (i % 10 === 0) {
        // Une tache sur 10 : comme un utilisateur (frappe + clic du robot), pour comparaison
        const debut = Date.now();
        await page.locator('[data-testid="task-title"]').fill(`Tache numero ${i}`);
        await page.locator('[data-testid="add-task"]').click();
        await page.waitForFunction((n) => document.querySelectorAll('#task-list li').length === n, { polling: 'mutation' }, i);
        tempsActionRobot.add(Date.now() - debut);
      } else {
        tempsAjoutTache.add(await page.evaluate(ajouterEtChronometrer, `Tache numero ${i}`));
      }
    }
    check(await nbTaches(page), { [`${NB_TACHES} taches affichees`]: (n) => n === NB_TACHES });

    // 3. Cocher la premiere tache
    await page.locator('#task-list li:first-child .task-checkbox').check();
    await page.waitForFunction(() => document.querySelector('#task-list li:first-child')?.classList.contains('done'));

    // 4. Recharger : toutes les donnees doivent revenir d'IndexedDB
    const debut = Date.now();
    await page.reload();
    await page.waitForFunction((n) => document.querySelectorAll('#task-list li').length === n, { polling: 'mutation' }, NB_TACHES);
    tempsRechargement.add(Date.now() - debut);

    const apresRechargement = await nbTaches(page);
    const toujoursCochee = await page.evaluate(
      () => document.querySelector('#task-list li:first-child .task-checkbox').checked,
    );
    check(null, {
      'persistance : toutes les taches apres rechargement': () => apresRechargement === NB_TACHES,
      'persistance : la tache cochee le reste': () => toujoursCochee === true,
    });

    // 5. Supprimer le projet (et ses taches) apres confirmation
    await page.locator('[data-testid="delete-project"]').click();
    await page.locator('[data-testid="confirm-ok"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#project-list li').length === 0);
    check(await page.locator('#no-project').isVisible(), { 'projet supprime': (v) => v === true });
  } finally {
    await page.close();
  }
}
