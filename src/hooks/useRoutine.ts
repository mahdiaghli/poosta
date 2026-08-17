import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { routineTrackerService } from '@/services/routineTrackerService';

/** Derives today's completion % and streaks from the store's routine log. */
export function useRoutineTracker() {
  const routine = useAppStore((s) => s.routine);
  const routineLog = useAppStore((s) => s.routineLog);
  const toggleRoutineStep = useAppStore((s) => s.toggleRoutineStep);

  const todayKey = routineTrackerService.todayKey();
  const todayCompletion = useMemo(() => routineTrackerService.completionPct(routineLog, todayKey, routine), [routineLog, todayKey, routine]);
  const streaks = useMemo(() => routineTrackerService.streaks(routineLog, routine), [routineLog, routine]);
  const today = routineTrackerService.getDay(routineLog, todayKey);

  return { routine, today, todayCompletion, streaks, toggleStep: toggleRoutineStep };
}
