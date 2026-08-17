import { INTERACTION_RULES } from '@/data/interactionRules';
import type { InteractionWarning } from '@/types';

/**
 * interactionChecker — the ingredient/product interaction layer.
 * The routine generator and ingredient scanner both run candidate active
 * ingredients through this before combining them, so the app never
 * silently pairs conflicting actives (e.g. retinol + AHA/BHA).
 */
export const interactionChecker = {
  check(activeIngredientKeys: string[]): InteractionWarning[] {
    const uniq = Array.from(new Set(activeIngredientKeys.filter(Boolean)));
    return INTERACTION_RULES.filter((rule) => rule.pair.every((key) => uniq.includes(key)));
  },
};
