import type { AppUser } from '@/types';

const KEY='poosta:user';

export const authService = {
  isEmail(contact: string) { return contact.includes('@'); },
  normalizePhone(contact: string) {
    const trimmed = contact.trim().replace(/[\s-]/g,'');
    return trimmed.startsWith('09') ? `+98${trimmed.slice(1)}` : trimmed;
  },
  async sendOtp(contact: string) { return { mode:'local' as const, contact:contact.trim() }; },
  async verifyOtp(contact: string, _token: string, name: string): Promise<AppUser> {
    const target=contact.trim();
    const user: AppUser={ id:`local-${btoa(unescape(encodeURIComponent(target))).replace(/[^a-zA-Z0-9]/g,'').slice(0,20) || crypto.randomUUID()}`, name:name||'کاربر',
      email:this.isEmail(target)?target:undefined, phone:this.isEmail(target)?undefined:this.normalizePhone(target) };
    localStorage.setItem(KEY,JSON.stringify(user));
    return user;
  },
  async getCurrentUser(): Promise<AppUser|null> {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  },
  async signOut() { localStorage.removeItem(KEY); },
};
