// Test de CHARGE (k6) : de nombreux utilisateurs virtuels (VU) chargent l'application en meme temps.
//
// L'application n'a pas d'API : les donnees vivent dans IndexedDB, dans le navigateur de chaque
// utilisateur. La partie "serveur" se limite donc a servir les fichiers statiques
// (index.html, app.js, db.js, style.css). C'est ce que l'on met sous charge ici.
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4200';

export const options = {
  stages: [
    { duration: '10s', target: 50 }, // montee
    { duration: '20s', target: 50 }, // palier
    { duration: '10s', target: 0 }, // descente
  ],
  // Seuils = oracle : si l'un d'eux est viole, k6 renvoie un code d'erreur
  // et le pipeline CI echoue.
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const RESSOURCES = [
  ['index.html', '/', 'Mes tâches'],
  ['app.js', '/src/app.js', 'openDatabase'],
  ['db.js', '/src/db.js', 'indexedDB.open'],
  ['style.css', '/src/style.css', '.task-item'],
];

export default function () {
  group("chargement de l'application", () => {
    // Le navigateur telecharge les 4 fichiers en parallele : http.batch fait de meme.
    const reponses = http.batch(RESSOURCES.map(([, chemin]) => ['GET', `${BASE_URL}${chemin}`]));

    reponses.forEach((res, i) => {
      const [nom, , contenuAttendu] = RESSOURCES[i];
      check(res, {
        [`${nom} : statut 200`]: (r) => r.status === 200,
        [`${nom} : contenu attendu`]: (r) => typeof r.body === 'string' && r.body.includes(contenuAttendu),
      });
    });
  });

  sleep(1); // temps de reflexion de l'utilisateur
}
