import type { Reminders } from '@/types';
let timers: number[] = [];
function clearTimers(){timers.forEach(window.clearTimeout);timers=[];}
function nextOccurrence(time:string){const [h,m]=time.split(':').map(Number);const now=new Date();const t=new Date(now);t.setHours(h,m,0,0);if(t<=now)t.setDate(t.getDate()+1);return t;}
export const notificationService={
 isSupported:()=>typeof window!=='undefined'&&'Notification' in window,
 async requestPermission(){if(!this.isSupported())return 'denied' as NotificationPermission;return Notification.requestPermission();},
 show(title:string,body:string){if(!this.isSupported()||Notification.permission!=='granted')return false;new Notification(title,{body,dir:'rtl',lang:'fa'});return true;},
 schedule(reminders:Reminders){clearTimers();if(!reminders.enabled||!this.isSupported()||Notification.permission!=='granted')return;for(const [time,title,body] of [[reminders.morning,'☀️ روتین صبح پوستا','وقت روتین صبح شماست.'],[reminders.night,'🌙 روتین شب پوستا','وقت روتین شب شماست.']] as [string,string,string][]) {const d=nextOccurrence(time);const id=window.setTimeout(()=>{this.show(title,body);this.schedule(reminders)},d.getTime()-Date.now());timers.push(id);}}
};
