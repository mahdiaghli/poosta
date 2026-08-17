import type { PatchTest } from '@/types';
export const patchTestService={
 daysElapsed:(t:PatchTest)=>Math.max(0,Math.floor((Date.now()-new Date(t.startedAt).getTime())/86400000)),
 isComplete:(t:PatchTest)=>Date.now()-new Date(t.startedAt).getTime()>=t.durationDays*86400000,
 status:(t:PatchTest)=>{if(t.checkins.some(c=>c.reaction==='moderate'||c.reaction==='severe'))return'failed' as const;if(Date.now()-new Date(t.startedAt).getTime()>=t.durationDays*86400000)return'passed' as const;return'active' as const;}
};
