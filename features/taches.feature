# language: fr
Fonctionnalité: Gestion des tâches par projet
  Afin d'organiser mon travail
  En tant qu'utilisateur
  Je veux créer, modifier, terminer et supprimer des tâches rattachées à un projet

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

  Scénario: Marquer une tâche comme terminée dans un projet qui n'est pas le premier
    Soit un projet nommé "Maison"
    Et un projet nommé "Travail"
    Et une tâche "Envoyer le rapport" dans le projet "Travail"
    Quand je marque la tâche "Envoyer le rapport" comme terminée
    Alors la tâche "Envoyer le rapport" est terminée

  Scénario: Supprimer une tâche
    Soit un projet nommé "Maison"
    Et une tâche "Arroser les plantes" dans le projet "Maison"
    Et une tâche "Sortir le chien" dans le projet "Maison"
    Quand je supprime la tâche "Arroser les plantes"
    Alors le projet "Maison" contient 1 tâche
    Et le projet "Maison" ne contient plus la tâche "Arroser les plantes"

  Scénario: Supprimer un projet supprime aussi ses tâches
    Soit un projet nommé "Vacances"
    Et un projet nommé "Travail"
    Et une tâche "Réserver l'hôtel" dans le projet "Vacances"
    Et une tâche "Préparer la valise" dans le projet "Vacances"
    Et une tâche "Réunion lundi" dans le projet "Travail"
    Quand je supprime le projet "Vacances"
    Alors le projet "Vacances" n'existe plus
    Et aucune tâche du projet "Vacances" ne subsiste
    Et le projet "Travail" contient 1 tâche

  Plan du scénario: Refuser une tâche invalide
    Soit un projet nommé "Maison"
    Quand j'essaie d'ajouter la tâche "<titre>" <cible>
    Alors une erreur "<message>" est levée

    Exemples:
      | titre     | cible                        | message                               |
      | Orpheline | sans projet                  | La tache doit appartenir a un projet  |
      |           | au projet "Maison"           | Le titre de la tache est requis       |
      | Fantôme   | au projet inexistant         | Projet introuvable                    |
