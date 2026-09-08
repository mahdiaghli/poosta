export type SkinMetricKey =
  | 'acne' | 'oiliness' | 'hydration' | 'redness'
  | 'pores' | 'darkSpots' | 'texture' | 'fineLines';

export type SkinMetrics = Record<SkinMetricKey, number>;

export interface ImageQualityIssue { code: string; message: string; }
export interface ImageQualityResult { ok: boolean; issues: ImageQualityIssue[]; }

export interface AIImageQuality {
  suitable: boolean;
  faceDetected: boolean;
  faceCount: number;
  frontal: boolean;
  faceVisibility: 'clear' | 'partial' | 'poor';
  qualityScore: number;
  issues: string[];
}

export interface SkinAnalysisImageEvidence {
  imageQuality?: AIImageQuality;
  observations?: string[];
  limitations?: string[];
  recommendedNextStep?: string;
}

/** Structured response contract every AI provider must satisfy. */
export interface SkinAnalysisResult extends SkinAnalysisImageEvidence {
  overallScore: number;
  metrics: SkinMetrics;
  concerns: SkinMetricKey[];
  topOpportunities: SkinMetricKey[];
  confidence: number;
  provider: string;
  providerUsed?: string; // e.g. 'gemini:gemini-2.5-flash' | 'openrouter:...' | 'local'
  metricsSource?: Partial<Record<SkinMetricKey, 'model' | 'heuristic'>>; // per-metric: trained model vs classical CV estimate
  /** Cosmetic "how old the skin looks" (not chronological age). */
  apparentSkinAge?: number;
  apparentSkinAgeNote?: string;
  thumbnailUrl?: string;
  createdAt: string;
}

export type Gender = 'female' | 'male' | 'na';
export type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive' | 'unknown';
export type Sensitivity = 'sun' | 'fragrance' | 'acne_prone' | 'none';
export type Goal = 'acne' | 'spots' | 'redness' | 'oil' | 'hydration' | 'texture' | 'prevent';
export type Budget = 'under1m' | '1to2m' | '2to5m' | '5plus';

export interface SkinProfile {
  age?: number;
  gender?: Gender;
  skinType?: SkinType;
  sensitivities: Sensitivity[];
  concerns: SkinMetricKey[];
  goals: Goal[];
  budget: Budget;
  isPregnantOrNursing?: boolean;
}

export const METRIC_LABELS_FA: Record<SkinMetricKey, string> = {
  acne: 'جوش', oiliness: 'چربی پوست', hydration: 'رطوبت', redness: 'قرمزی',
  pores: 'منافذ باز', darkSpots: 'لک‌های تیره', texture: 'بافت پوست', fineLines: 'خطوط ریز',
};
