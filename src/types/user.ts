import type { ProductCategory } from './product';

export interface AppUser { id: string; name: string; email?: string; phone?: string; }

export interface OwnedProduct {
  id: string;
  refId?: string;
  name: string;
  category: ProductCategory;
  activeIngredientKeys: string[];
  addedVia: 'search' | 'barcode' | 'photo' | 'manual';
  openedAt?: string;
  expiresAt?: string;
  notes?: string;
}

export interface Reminders { morning: string; night: string; enabled: boolean; }
export interface WeatherInfo { temp: number; humidity: number; uv: number; }
export interface ChatMessage { role: 'user' | 'assistant'; text: string; }
export interface ScanComparison { prevOverall: number; newOverall: number; diff: number; }
