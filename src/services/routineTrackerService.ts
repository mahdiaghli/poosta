import type { Routine, RoutineLog, RoutinePeriod, StreakInfo } from '@/types';

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * routineTrackerService — pure functions over a RoutineLog map, so the
 * store and components stay thin. Persisted via the app store (see
 * src/store/useAppStore.ts); in production this mirrors the
 * `routine_logs` table (one row per user/step/day).
 */
export const routineTrackerService = {
  todayKey,

  getDay(log: RoutineLog, key: string) {
    return log[key] ?? { morning: [], night: [] };
  },

  toggle(log: RoutineLog, key: string, period: RoutinePeriod, index: number): RoutineLog {
    const day = { morning: [...(log[key]?.morning ?? [])], night: [...(log[key]?.night ?? [])] };
    day[period][index] = !day[period][index];
    return { ...log, [key]: day };
  },

  completionPct(log: RoutineLog, key: string, routine: Routine | null): number {
    if (!routine) return 0;
    const total = routine.morning.length + routine.night.length;
    if (!total) return 0;
    const day = log[key];
    if (!day) return 0;
    const done = day.morning.filter(Boolean).length + day.night.filter(Boolean).length;
    return Math.round((done / total) * 100);
  },

  isDayComplete(log: RoutineLog, key: string, routine: Routine | null): boolean {
    return this.completionPct(log, key, routine) >= 100 && !!log[key];
  },

  streaks(log: RoutineLog, routine: Routine | null): StreakInfo {
    let current = 0;
    const d = new Date();
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (this.isDayComplete(log, key, routine)) { current++; d.setDate(d.getDate() - 1); } else break;
    }
    let longest = 0, run = 0, prevDate: string | null = null;
    Object.keys(log).sort().forEach((key) => {
      if (this.isDayComplete(log, key, routine)) {
        run = prevDate && (new Date(key).getTime() - new Date(prevDate).getTime()) / 86400000 === 1 ? run + 1 : 1;
        longest = Math.max(longest, run);
        prevDate = key;
      } else { run = 0; prevDate = null; }
    });
    return { current, longest: Math.max(longest, current) };
  },
};
