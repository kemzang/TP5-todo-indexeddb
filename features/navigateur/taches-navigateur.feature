# language: fr
Fonctionnalité: Gestion des tâches dans le navigateur
  Afin de vérifier l'application telle qu'un utilisateur la voit
  Un robot pilote un vrai navigateur (Chromium via Playwright)
  Et crée, modifie, termine et supprime lui-même projets et tâches

  Contexte:
    Soit l'application est ouverte dans le navigateur

  Scénario: Créer un projet et y ajouter des tâches
    Quand je crée le projet "Maison"
    Et j'ajoute la tâche "Faire les courses"
    Et j'ajoute la tâche "Sortir le chien"
    Alors le projet actif est "Maison"
    Et je vois 2 tâches dans la liste
    Et la progression indique "0 / 2 terminée"

  Scénario: Les données sont conservées après rechargement (IndexedDB)
    Quand je crée le projet "Travail"
    Et j'ajoute la tâche "Préparer la réunion"
    Et je recharge la page
    Alors le projet actif est "Travail"
    Et je vois la tâche "Préparer la réunion"

  Scénario: Modifier le titre d'une tâche
    Quand je crée le projet "Mémoire"
    Et j'ajoute la tâche "Brouillon du plan"
    Et je renomme la tâche "Brouillon du plan" en "Plan définitif"
    Alors je vois la tâche "Plan définitif"
    Et je ne vois plus la tâche "Brouillon du plan"

  Scénario: Terminer puis rouvrir une tâche
    Quand je crée le projet "Maison"
    Et j'ajoute la tâche "Faire la vaisselle"
    Et j'ajoute la tâche "Passer l'aspirateur"
    Et je coche la tâche "Faire la vaisselle"
    Alors la tâche "Faire la vaisselle" est barrée
    Et la progression indique "1 / 2 terminée"
    Quand je recharge la page
    Alors la tâche "Faire la vaisselle" est barrée
    Quand je décoche la tâche "Faire la vaisselle"
    Alors la tâche "Faire la vaisselle" n'est pas barrée

  Scénario: Supprimer une tâche
    Quand je crée le projet "Courses"
    Et j'ajoute la tâche "Pain"
    Et j'ajoute la tâche "Lait"
    Et je supprime la tâche "Pain"
    Alors je ne vois plus la tâche "Pain"
    Et je vois 1 tâche dans la liste

  Scénario: Supprimer un projet et ses tâches après confirmation
    Quand je crée le projet "Vacances"
    Et j'ajoute la tâche "Réserver le train"
    Et je crée le projet "Travail"
    Et j'ajoute la tâche "Réunion lundi"
    Et je supprime le projet "Vacances" en confirmant
    Alors le projet "Vacances" n'apparaît plus
    Et le projet actif est "Travail"
    Et je vois la tâche "Réunion lundi"

  Scénario: Annuler la suppression d'un projet
    Quand je crée le projet "Important"
    Et j'ajoute la tâche "Ne pas perdre"
    Et je supprime le projet "Important" en annulant
    Alors le projet actif est "Important"
    Et je vois la tâche "Ne pas perdre"

  Scénario: Les tâches sont séparées par projet
    Quand je crée le projet "Projet A"
    Et j'ajoute la tâche "Tâche de A"
    Et je crée le projet "Projet B"
    Alors la liste des tâches est vide
    Quand je sélectionne le projet "Projet A"
    Alors je vois la tâche "Tâche de A"

  Scénario: Modifier le nom et la description d'un projet
    Quand je crée le projet "Brouillon"
    Et je modifie le projet avec le nom "INF563" et la description "Vérification et validation logicielle"
    Alors le projet actif est "INF563"
    Et la description du projet est "Vérification et validation logicielle"
    Quand je recharge la page
    Alors le projet actif est "INF563"
    Et la description du projet est "Vérification et validation logicielle"

  Scénario: Filtrer les tâches par statut et les rechercher
    Quand je crée le projet "Cours"
    Et j'ajoute la tâche "Lire le cours sur k6"
    Et j'ajoute la tâche "Écrire les scénarios"
    Et j'ajoute la tâche "Configurer la CI"
    Et je coche la tâche "Configurer la CI"
    Et je choisis le filtre "Terminées"
    Alors je vois 1 tâche dans la liste
    Et je vois la tâche "Configurer la CI"
    Quand je choisis le filtre "En attente"
    Alors je vois 2 tâches dans la liste
    Quand je choisis le filtre "Toutes"
    Et je recherche "ecrire"
    Alors je vois 1 tâche dans la liste
    Et je vois la tâche "Écrire les scénarios"

  Scénario: Les dates de création et de modification sont affichées
    Quand je crée le projet "Dates"
    Et j'ajoute la tâche "Tâche datée"
    Alors la tâche "Tâche datée" affiche sa date de création
    Et la tâche "Tâche datée" a le statut "En attente"
    Quand je coche la tâche "Tâche datée"
    Alors la tâche "Tâche datée" affiche sa date de modification
    Et la tâche "Tâche datée" a le statut "Terminée"

  Plan du scénario: Refuser une saisie invalide
    Quand je crée le projet "Maison"
    Et je saisis le texte "<saisie>" dans le champ <champ> et je valide
    Alors le message d'erreur "<message>" s'affiche

    Exemples:
      | saisie | champ  | message                            |
      |        | tâche  | Saisissez un titre pour la tâche.  |
      |        | projet | Donnez un nom au projet.           |
      | maison | projet | Un projet porte déjà ce nom.       |
