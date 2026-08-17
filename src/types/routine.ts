export type RoutinePeriod = 'morning' | 'night';
export type RoutineVariant = 'best' | 'budget' | 'minimal';
export type RoutineSource = 'catalog' | 'own_products';
export type Importance = 'high' | 'mid' | 'low';

export interface RoutineStep {
  name: string;
  productName: string;
  productId?: string;
  reason: string;
  howToUse: string;
  frequency: string;
  importance: Importance;
  activeIngredientKeys: string[];
  /** e.g. ['شنبه','دوشنبه','چهارشنبه'] for a 3x/week strong active; undefined = daily. */
  schedule?: string[];
}

export interface InteractionWarning { pair: [string, string]; message: string; }

export interface Routine {
  morning: RoutineStep[];
  night: RoutineStep[];
  conflicts: InteractionWarning[];
  variant: RoutineVariant;
  source: RoutineSource;
}

export interface RoutineLogDay { morning: boolean[]; night: boolean[]; }
export type RoutineLog = Record<string, RoutineLogDay>;

export interface StreakInfo { current: number; longest: number; }
