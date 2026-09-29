const DAY=86400000;
export const shanghaiDate=at=>new Date(at+8*3600000).toISOString().slice(0,10);
export function overviewWindow(period,now=Date.now()) {
  const to=shanghaiDate(now);
  return {from:period==='today'?to:period==='week'?shanghaiDate(now-6*DAY):to.slice(0,8)+'01',to};
}
export function summarizeHistory(rows) {
  if(!Array.isArray(rows))throw new Error('invalid_history');
  let bytes=0;
  const hosts=new Map();
  for(const row of rows){
    if(!Number.isFinite(row.upload)||row.upload<0||!Number.isFinite(row.download)||row.download<0)throw new Error('invalid_history');
    bytes+=row.upload+row.download;
    if(typeof row.host_id==='string' && row.host_id){
      const host=hosts.get(row.host_id)||{host_id:row.host_id,upload:0,download:0,bytes:0};
      host.upload+=row.upload;host.download+=row.download;host.bytes+=row.upload+row.download;
      hosts.set(row.host_id,host);
    }
  }
  return {bytes:rows.length?bytes:null,hosts:[...hosts.values()]};
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

// Include both current machines and historical machines no longer in inventory.
// An absent record is unknown, not measured zero.
export function machineBreakdown(summary,hosts=[]) {
  const records=new Map((summary?.hosts||[]).map(h=>[h.host_id,h]));
  const inventory=new Map(hosts.map(h=>[h.host_id,h.name||h.host_id]));
  for(const id of records.keys())if(!inventory.has(id))inventory.set(id,id);
  return [...inventory].map(([host_id,name])=>{
    const record=records.get(host_id);
    return {host_id,name,upload:record?.upload??null,download:record?.download??null,
      bytes:record?.bytes??null,share:record && summary.bytes>0?record.bytes/summary.bytes*100:null};
  }).sort((a,b)=>(b.bytes??-1)-(a.bytes??-1)||a.name.localeCompare(b.name));
}
