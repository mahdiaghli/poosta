import { MOCK_INGREDIENTS } from '@/data/mockIngredients';
import { interactionChecker } from './interactionChecker';
import type { Ingredient, InteractionWarning, SkinProfile } from '@/types';

export type IngredientMatchStatus = 'good' | 'warn' | 'unknown';

export interface IngredientMatch {
  token: string;
  key: string | null;
  info: Ingredient | null;
  status: IngredientMatchStatus;
}

export interface IngredientScanResult {
  matches: IngredientMatch[];
  conflicts: InteractionWarning[];
}

const ALIASES: Record<string, string> = {
  niacinamide: 'niacinamide', 'نیاسینامید': 'niacinamide',
  'hyaluronic acid': 'hyaluronic_acid', 'هیالورونیک': 'hyaluronic_acid',
  retinol: 'retinol', 'رتینول': 'retinol',
  'vitamin c': 'vitamin_c', 'ascorbic acid': 'vitamin_c', 'ویتامین': 'vitamin_c',
  aha: 'aha', glycolic: 'aha', bha: 'bha', salicylic: 'bha',
  fragrance: 'fragrance', parfum: 'fragrance', 'عطر': 'fragrance',
  centella: 'centella', 'سنتلا': 'centella',
  'zinc oxide': 'zinc_oxide', glycerin: 'glycerin', ceramide: 'ceramides', zinc: 'zinc', alcohol: 'alcohol',
};

function matchKey(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  for (const alias in ALIASES) if (t.includes(alias)) return ALIASES[alias];
  return null;
}

/**
 * ingredientService — Image/Text -> Ingredient Extraction -> Analysis ->
 * skin-profile matching -> compatibility.
 *
 * Text entry (`analyzeText`) is fully implemented. Photo/OCR extraction is
 * the swap point for a real vision/OCR provider: have it return a
 * comma-separated ingredient string and pass it into `analyzeText`
 * unchanged — nothing else needs to be rewritten.
 */
export const ingredientService = {
  matchKey,

  analyzeText(rawText: string, profile: SkinProfile): IngredientScanResult {
    const tokens = rawText.split(/[,،\n]/).map((t) => t.trim()).filter(Boolean);
    const matches: IngredientMatch[] = tokens.map((token) => {
      const key = matchKey(token);
      const info = key ? MOCK_INGREDIENTS[key] : null;
      let status: IngredientMatchStatus = 'good';
      if (key === 'fragrance' && profile.sensitivities.includes('fragrance')) status = 'warn';
      if (key === 'retinol' && profile.sensitivities.length > 0) status = 'warn';
      if (!info) status = 'unknown';
      return { token, key, info, status };
    });
    const activeKeys = matches.map((m) => m.key).filter((k): k is string => !!k);
    const conflicts = interactionChecker.check(activeKeys);
    return { matches, conflicts };
  },
};
