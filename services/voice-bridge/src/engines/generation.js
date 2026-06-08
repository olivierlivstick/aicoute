// Réglage de GÉNÉRATION Gemini — levier anti-latence « réflexion » (thinking).
//
// Contexte : on a prouvé (vérité terrain Audacity + métriques) que le « blanc »
// Gemini (~2 s entre la fin de parole de l'utilisateur et le 1er son de l'IA)
// n'est PAS de la VAD (durcir endOfSpeech/silence n'a rien changé) mais de la
// LATENCE DE GÉNÉRATION. Or les modèles Gemini Flash 2.5/3.x font une passe de
// « thinking » (raisonnement interne) AVANT de produire la réponse — pour une
// conversation vocale temps réel, c'est exactement le délai qu'on veut supprimer.
//
// thinkingConfig.thinkingBudget = 0 → désactive le thinking (si le modèle le
// supporte) → le modèle répond immédiatement, sans réfléchir d'abord.
//
// Env GEMINI_THINKING_BUDGET :
//   - non défini (défaut) → on N'INJECTE RIEN → comportement Gemini par défaut
//     (aucun risque de setup malformé sur les modèles qui ne supportent pas le
//     champ ; kill-switch = retirer la variable).
//   - "0"                 → thinkingBudget: 0 (désactive le thinking)
//   - "<n>"               → thinkingBudget: n (budget de tokens de réflexion limité)
//
// ⚠️ Si le modèle Live n'accepte pas thinkingConfig, le setup échoue (1007) comme
// pour un champ VAD invalide → on le laisse donc OPT-IN par env, OFF par défaut,
// pour ne jamais casser la prod. À valider en test avant d'activer durablement.

export function buildThinkingConfig() {
  const raw = process.env.GEMINI_THINKING_BUDGET
  if (raw == null || raw === '') return null
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return { thinkingConfig: { thinkingBudget: n } }
}

/** Résumé lisible pour les logs de setup. */
export function thinkingSummary() {
  const c = buildThinkingConfig()
  return c ? `thinkingBudget=${c.thinkingConfig.thinkingBudget}` : 'défaut (non envoyé)'
}
