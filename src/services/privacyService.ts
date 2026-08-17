export const privacyService = {
  exportData(data:any, filename='poosta-my-data.json') {
    const clean={exportedAt:new Date().toISOString(),profile:data.profile,scans:data.scanHistory,routines:data.routine,myProducts:data.myProducts,coachMessages:data.coachMessages};
    const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  async deleteScanHistory() {
    useStateStoreReset();
  },
  async deleteAccount() {
    localStorage.removeItem('poosta:user'); useStateStoreReset();
  },
};
function useStateStoreReset(){ localStorage.removeItem('poosta:state'); window.location.reload(); }
