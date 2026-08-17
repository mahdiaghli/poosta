import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { authService } from '@/services/authService';

export function useAuth() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const [bootstrapping,setBootstrapping]=useState(true);

  useEffect(() => {
    let alive=true;
    authService.getCurrentUser().then((u)=>{ if(alive && u) setUser(u); }).finally(()=>{ if(alive) setBootstrapping(false); });
    return ()=>{alive=false;};
  },[setUser]);

  const sendOtp = async (contact:string) => authService.sendOtp(contact);
  const verifyOtp = async (name:string, contact:string, token:string) => {
    const u=await authService.verifyOtp(contact,token,name.trim()||'کاربر'); setUser(u); return u;
  };
  const signOut = async () => { await authService.signOut(); setUser(null); useAppStore.getState().resetAccount(); };
  return { user, isAuthenticated:!!user, bootstrapping, sendOtp, verifyOtp, signOut };
}
