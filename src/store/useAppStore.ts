import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppUser, SkinProfile, SkinAnalysisResult, Routine, ScoredProduct,
  ScanComparison, OwnedProduct, RoutineLog, Reminders, RoutineVariant,
  Budget, ChatMessage, RoutinePeriod, DailyCheckIn, SkinDiaryEntry, PatchTest,
} from '@/types';
import { skinAnalysisService } from '@/services/skinAnalysisService';
import { recommendationEngine } from '@/services/recommendationEngine';
import { routineTrackerService } from '@/services/routineTrackerService';
import { productService } from '@/services/productService';
import { notificationService } from '@/services/notificationService';

const emptyProfile: SkinProfile = {
  sensitivities: [], concerns: [], goals: [], budget: '2to5m',
};

interface AppState {
  user: AppUser | null;
  profile: SkinProfile;
  lastScan: SkinAnalysisResult | null;
  scanHistory: SkinAnalysisResult[];
  lastComparison: ScanComparison | null;
  routine: Routine | null;
  products: ScoredProduct[];
  myProducts: OwnedProduct[];
  routineLog: RoutineLog;
  reminders: Reminders;
  routineVariant: RoutineVariant;
  budget: Budget;
  useOnlyMyProducts: boolean;
  coachMessages: ChatMessage[];
  faceDataConsent: boolean;
  checkIns: DailyCheckIn[];
  diaryEntries: SkinDiaryEntry[];
  patchTests: PatchTest[];

  setUser: (u: AppUser | null) => void;
  setProfile: (p: Partial<SkinProfile>) => void;
  runScan: (imageDataUrl: string, thumbnailUrl?: string, mode?: 'accurate' | 'standard') => Promise<void>;
  rebuildRoutine: () => Promise<void>;
  setRoutineOptions: (opts: Partial<{ variant: RoutineVariant; budget: Budget; useOnlyMyProducts: boolean }>) => void;
  toggleRoutineStep: (period: RoutinePeriod, index: number) => void;
  addOwnedProduct: (p: OwnedProduct) => void;
  removeOwnedProduct: (id: string) => void;
  buildRoutineFromOwned: () => void;
  setReminders: (r: Reminders) => void;
  pushCoachMessage: (m: ChatMessage) => void;
  setFaceDataConsent: (v: boolean) => void;
  skipTonightTreatment: () => void;
  addCheckIn: (c: DailyCheckIn) => void;
  addDiaryEntry: (e: SkinDiaryEntry) => void;
  startPatchTest: (productName: string, productId?: string) => void;
  addPatchCheckIn: (id: string, reaction: PatchTest['checkins'][number]['reaction'], notes?: string) => void;
  setOwnedProductDates: (id: string, openedAt?: string, expiresAt?: string) => void;
  requestNotifications: () => Promise<NotificationPermission>;
  resetAccount: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: emptyProfile,
      lastScan: null,
      scanHistory: [],
      lastComparison: null,
      routine: null,
      products: [],
      myProducts: [],
      routineLog: {},
      reminders: { morning: '08:00', night: '22:00', enabled: true },
      routineVariant: 'best',
      budget: '2to5m',
      useOnlyMyProducts: false,
      coachMessages: [],
      faceDataConsent: false,
      checkIns: [],
      diaryEntries: [],
      patchTests: [],

      setUser: (user) => {
        set({ user });
      },
      setProfile: (p) => {
        const nextProfile = { ...get().profile, ...p };
        set({ profile: nextProfile });
        
      },

      runScan: async (imageDataUrl, thumbnailUrl, mode = 'standard') => {
        const { profile, lastScan } = get();
        const result = await skinAnalysisService.analyzeSkin(imageDataUrl, profile, mode);
        result.thumbnailUrl = thumbnailUrl;

        const comparison: ScanComparison | null = lastScan
          ? { prevOverall: lastScan.overallScore, newOverall: result.overallScore, diff: result.overallScore - lastScan.overallScore }
          : null;

        const catalog = await productService.getAll();
        const opts = { variant: get().routineVariant, budget: get().budget, useOnlyMyProducts: get().useOnlyMyProducts, myProducts: get().myProducts };
        const routine = recommendationEngine.buildRoutine(result.metrics, profile, opts, catalog);
        const products = recommendationEngine.recommendProducts(result.metrics, profile, catalog);

        
        set((s) => ({ lastScan: result, scanHistory: [...s.scanHistory, result], lastComparison: comparison, routine, products }));
      },

      rebuildRoutine: async () => {
        const { lastScan, profile, useOnlyMyProducts, myProducts, routineVariant, budget } = get();
        if (!lastScan) return;
        if (useOnlyMyProducts) {
          set({ routine: recommendationEngine.buildFromOwned(myProducts) });
          return;
        }
        const catalog = await productService.getAll();
        const routine = recommendationEngine.buildRoutine(lastScan.metrics, profile, { variant: routineVariant, budget, useOnlyMyProducts, myProducts }, catalog);
        set({ routine });
      },

      setRoutineOptions: (opts) => {
        set((s) => ({
          routineVariant: opts.variant ?? s.routineVariant,
          budget: opts.budget ?? s.budget,
          useOnlyMyProducts: opts.useOnlyMyProducts ?? s.useOnlyMyProducts,
        }));
        get().rebuildRoutine();
      },

      toggleRoutineStep: (period, index) => {
        const key = routineTrackerService.todayKey();
        set((s) => ({ routineLog: routineTrackerService.toggle(s.routineLog, key, period, index) }));
      },

      addOwnedProduct: (p) => { set((s) => ({ myProducts: [...s.myProducts, p] })); },
      removeOwnedProduct: (id) => { set((s) => ({ myProducts: s.myProducts.filter((p) => p.id !== id) })); },

      buildRoutineFromOwned: () => {
        set({ useOnlyMyProducts: true, routine: recommendationEngine.buildFromOwned(get().myProducts) });
      },

      setReminders: (reminders) => { set({ reminders }); if(typeof window!=='undefined') notificationService.schedule(reminders); },
      pushCoachMessage: (m) => set((s) => ({ coachMessages: [...s.coachMessages, m] })),
      addCheckIn: (c) => { set(s=>({checkIns:[...s.checkIns.filter(x=>x.date!==c.date),c]})); },
      addDiaryEntry: (e) => { set(s=>({diaryEntries:[...s.diaryEntries,e]})); },
      startPatchTest: (productName,productId) => { const t:PatchTest={id:crypto.randomUUID(),productId,productName,startedAt:new Date().toISOString(),durationDays:3,status:'active',checkins:[]}; set(s=>({patchTests:[t,...s.patchTests]})); },
      addPatchCheckIn: (id,reaction,notes) => set(s=>({patchTests:s.patchTests.map(t=>t.id===id?{...t,reaction,status:(reaction==='moderate'||reaction==='severe')?'failed':t.status,checkins:[...t.checkins,{date:new Date().toISOString().slice(0,10),reaction,notes}]}:t)})),
      setOwnedProductDates: (id,openedAt,expiresAt) => { set(s=>({myProducts:s.myProducts.map(p=>p.id===id?{...p,openedAt,expiresAt}:p)})); },
      requestNotifications: async () => { const permission=await notificationService.requestPermission(); if(permission==='granted') notificationService.schedule(get().reminders); return permission; },
      setFaceDataConsent: (v) => { set({ faceDataConsent: v }); },
      skipTonightTreatment: () => {
        const key = routineTrackerService.todayKey();
        const routine = get().routine;
        const idx = routine?.night.findIndex((s) => s.name === 'درمانی') ?? -1;
        if (idx < 0) return;
        set((s) => {
          const day = routineTrackerService.getDay(s.routineLog, key);
          if (day.night[idx]) return {}; // already marked, no-op
          return { routineLog: routineTrackerService.toggle(s.routineLog, key, 'night', idx) };
        });
      },

      resetAccount: () => set({
        user: null, profile: emptyProfile, lastScan: null, scanHistory: [], lastComparison: null,
        routine: null, products: [], myProducts: [], routineLog: {}, coachMessages: [], faceDataConsent: false, checkIns: [], diaryEntries: [], patchTests: [],
        reminders: { morning: '08:00', night: '22:00', enabled: true }, routineVariant: 'best', budget: '2to5m', useOnlyMyProducts: false,
      }),
    }),
    { name: 'poosta:state' } // persisted locally
  )
);
