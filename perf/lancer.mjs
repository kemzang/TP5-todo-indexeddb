// Lanceur des tests k6 : demarre le site, execute k6, puis arrete le site.
//
//   node perf/lancer.mjs charge.js        (test de charge HTTP)
//   node perf/lancer.mjs navigateur.js    (test de performance dans le navigateur)
//
// k6 est execute :
//  - via l'image Docker officielle grafana/k6:latest-with-browser (par defaut, Chromium inclus) ;
//  - ou via le binaire k6 installe si K6_MODE=local (cas de la CI GitHub Actions).
// Un rapport HTML est genere dans reports/k6-<nom>.html (tableau de bord web de k6).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import httpServer from 'http-server';

process.noDeprecation = true;

const script = process.argv[2];
if (!script) {
  console.error('Usage : node perf/lancer.mjs <charge.js|navigateur.js>');
  process.exit(2);
}

const PORT = Number(process.env.PORT || 4200);
const MODE = process.env.K6_MODE || 'docker';
const racine = resolve('.');
const nom = basename(script, '.js');
mkdirSync('reports', { recursive: true });

const server = httpServer.createServer({ root: racine, cache: -1, showDir: false });
await new Promise((ok) => server.listen(PORT, '0.0.0.0', ok));
console.log(`Site servi sur http://localhost:${PORT} - lancement de k6 (${MODE})\n`);

const envK6 = {
  BASE_URL: `http://localhost:${PORT}`,
  K6_WEB_DASHBOARD: 'true',
  K6_WEB_DASHBOARD_PORT: '-1', // pas de serveur interactif, seulement l'export HTML
  K6_WEB_DASHBOARD_EXPORT: `reports/k6-${nom}.html`,
  ...(process.env.NB_TACHES ? { NB_TACHES: process.env.NB_TACHES } : {}),
};

let commande;
let args;
if (MODE === 'local') {
  commande = 'k6';
  args = ['run', `perf/${script}`];
} else {
  commande = 'docker';
  args = [
    'run', '--rm', '--network', 'host',
    '--user', `${process.getuid()}:${process.getgid()}`,
    '-e', 'HOME=/tmp',
    '-v', `${racine}:/app`, '-w', '/app',
    ...Object.entries(envK6).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    'grafana/k6:latest-with-browser',
    'run', `perf/${script}`,
  ];
}

const k6 = spawn(commande, args, { stdio: 'inherit', env: { ...process.env, ...envK6 } });
k6.on('error', (e) => {
  console.error(`Impossible de lancer ${commande} : ${e.message}`);
  server.close();
  process.exit(1);
});
k6.on('exit', (code) => {
  server.close();
  console.log(`\nRapport HTML : reports/k6-${nom}.html`);
  process.exit(code ?? 1); // code != 0 si un seuil est viole -> la CI echoue
});
