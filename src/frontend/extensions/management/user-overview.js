const DAY=86400000;
export const shanghaiDate=at=>new Date(at+8*3600000).toISOString().slice(0,10);
export function overviewWindow(period,now=Date.now()) {
  const to=shanghaiDate(now);
  return {from:period==='today'?to:period==='week'?shanghaiDate(now-6*DAY):to.slice(0,8)+'01',to};
}
export function summarizeHistory(rows) {
  if(!Array.isArray(rows))throw new Error('invalid_history');
  let bytes=0;
  for(const row of rows){
    if(!Number.isFinite(row.upload)||row.upload<0||!Number.isFinite(row.download)||row.download<0)throw new Error('invalid_history');
    bytes+=row.upload+row.download;
  }
  return {bytes:rows.length?bytes:null};
}
// Small bounded queue. No timer or persistent cache: one read per user on demand.
export async function loadUserUsage(users,window,request,concurrency=2) {
  const result={};let cursor=0,authError=null;
  async function run(){
    while(cursor<users.length&&!authError){
      const user=users[cursor++];
      try {result[user.user_id]=summarizeHistory((await request('post','/history',{user_id:user.user_id,...window})).rows);}
      catch(error){
        if([401,403].includes(error.status))authError=error;
        result[user.user_id]={bytes:null,failed:true};
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,users.length)},run));
  if(authError)throw authError;
  return result;
}
