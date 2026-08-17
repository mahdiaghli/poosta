import type { SkinType, SkinMetricKey } from './skin';

export type ProductCategory =
  | 'cleanser' | 'toner' | 'essence' | 'serum' | 'moisturizer' | 'sunscreen'
  | 'treatment' | 'body_care' | 'lip_care';

export const CATEGORY_LABELS_FA: Record<ProductCategory, string> = {
  cleanser: 'شوینده', toner: 'تونر', essence: 'اسنس', serum: 'سرم',
  moisturizer: 'مرطوب‌کننده', sunscreen: 'ضدآفتاب', treatment: 'درمانی',
  body_care: 'مراقبت بدن', lip_care: 'مراقبت لب',
};

export interface Ingredient {
  id: string;
  key: string;
  name: string;
  description?: string;
  benefits: string;
  possibleWarnings: string;
}

export type ProductConcern = string;

export interface Product {
  id: string;
  name: string;
  brand: string;
  image?: string;
  description?: string;
  category: ProductCategory;
  price?: number;
  currency: string;
  purchaseUrl?: string;
  officialUrl?: string;
  rating?: number;
  reviewCount?: number;
  barcode?: string | null;
  sizeOptionsMl?: number[];
  skinTypes: SkinType[];
  concerns: ProductConcern[];
  ingredientKeys: string[];
  activeIngredientKeys: string[];
  concentrations?: Record<string, number | string | null>;
  fragranceFree?: boolean | null;
  alcoholFree?: boolean | null;
  essentialOilFree?: boolean | null;
  pregnancySafety?: string;
  irritationLevel?: string;
  amUsage?: boolean;
  pmUsage?: boolean;
  interactionIds?: string[];
  iranAvailability?: string;
  availabilityType?: string;
  lastVerifiedAt?: string;
  notes?: string;
}

export interface CompatibilityResult { score: number; reasons: string[]; negativeReasons: string[]; }
export interface ScoredProduct extends Product { compatibility: CompatibilityResult; }
