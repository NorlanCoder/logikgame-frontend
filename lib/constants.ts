/** Labels lisibles pour les types de manches */
export const ROUND_TYPE_LABELS: Record<string, string> = {
  sudden_death: 'Mort subite',
  hint: 'Utilisation d\'indice',
  second_chance: 'Seconde chance',
  round_skip: 'Passage de manche',
  top4_elimination: 'Élimination Top 4',
  duel_jackpot: 'Duel — Cagnotte',
  duel_elimination: 'Duel — Élimination',
  finale: 'Finale',
};

/** Labels lisibles pour les statuts de session */
export const SESSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  registration_open: 'Inscriptions ouvertes',
  registration_closed: 'Inscriptions fermées',
  preselection: 'Pré-sélection',
  ready: 'Prêt',
  in_progress: 'En cours',
  paused: 'En pause',
  ended: 'Terminé',
  cancelled: 'Annulé',
};

/** Labels pour les statuts de joueur */
export const PLAYER_STATUS_LABELS: Record<string, string> = {
  waiting: 'En attente',
  active: 'En jeu',
  eliminated: 'Éliminé',
  finalist: 'Finaliste',
  finalist_winner: 'Gagnant',
  finalist_loser: 'Perdant',
  abandoned: 'Abandonné',
};

/** Labels pour les raisons d'élimination */
export const ELIMINATION_REASON_LABELS: Record<string, string> = {
  wrong_answer: 'Mauvaise réponse',
  timeout: 'Temps écoulé',
  second_chance_failed: 'Échec seconde chance',
  round_skip: 'Passage de manche',
  top4_cutoff: 'Non retenu au top 4',
  duel_lost: 'Duel perdu',
  finale_lost: 'Finale perdue',
  manual: 'Élimination manuelle',
};

/** Labels pour les statuts de manche */
export const ROUND_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminée',
  skipped: 'Ignorée',
};

/** Labels pour les statuts de question */
export const QUESTION_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  launched: 'Lancée',
  closed: 'Clôturée',
  revealed: 'Révélée',
};

/** Capital initial de chaque joueur */
export const INITIAL_CAPITAL = 1000;

/** Durée par défaut d'une question (secondes) */
export const DEFAULT_QUESTION_DURATION = 30;
