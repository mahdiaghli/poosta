export interface DailyCheckIn {
  id: string; date: string; dryness: number; oiliness: number; redness: number; acne: number; irritation: number;
  overallFeeling: 'great'|'good'|'okay'|'bad'|'very_bad'; notes?: string; createdAt: string;
}
export interface SkinDiaryEntry {
  id: string; date: string; mood?: string; sleepHours?: number; stress?: number; waterGlasses?: number; sunExposure?: number;
  makeupUsed?: boolean; notes?: string; createdAt: string;
}
export interface PatchTest {
  id: string; productId?: string; productName: string; startedAt: string; durationDays: number;
  status: 'active'|'passed'|'failed'; reaction?: 'none'|'mild'|'moderate'|'severe'; notes?: string;
  checkins: { date: string; reaction: 'none'|'mild'|'moderate'|'severe'; notes?: string }[];
}
