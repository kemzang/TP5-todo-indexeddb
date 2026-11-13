# language: fr
Fonctionnalité: Gestion des tâches par projet
  Afin d'organiser mon travail
  En tant qu'utilisateur
  Je veux ajouter et modifier des tâches rattachées à un projet

  Scénario: Ajouter une tâche à un projet existant
    Soit un projet nommé "Maison"
    Quand j'ajoute la tâche "Faire les courses" au projet "Maison"
    Alors le projet "Maison" contient 1 tâche
    Et la tâche "Faire les courses" n'est pas terminée

  Scénario: Modifier le titre d'une tâche
    Soit un projet nommé "Travail"
    Et une tâche "Brouillon" dans le projet "Travail"
    Quand je renomme la tâche "Brouillon" en "Version finale"
    Alors le projet "Travail" contient la tâche "Version finale"
    Et le projet "Travail" ne contient plus la tâche "Brouillon"

  Scénario: Refuser une tâche sans projet
    Quand j'essaie d'ajouter la tâche "Orpheline" sans projet
    Alors une erreur est levée
