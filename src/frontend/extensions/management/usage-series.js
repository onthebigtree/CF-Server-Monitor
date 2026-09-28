export const COLORS=['#2563eb','#d97706','#8b5cf6','#059669','#db2777','#0891b2'];
export function bytes(value) {
  if(value==null)return '暂无记录';
  const units=['B','KB','MB','GB','TB'];let n=value,i=0;
  while(n>=1000&&i<units.length-1){n/=1000;i++;}
  return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:i?3:0}).format(n)+' '+units[i];
}
export function clock(at,day=false) {
  const s=new Date(at+8*3600000).toISOString();
  return day?s.slice(5,10):s.slice(5,10)+' '+s.slice(11,16);
}
export function seriesGrid(data,users) {
  const count=Math.max(1,Math.ceil((data.end-data.start)/data.step_ms));
  const times=Array.from({length:count},(_,i)=>data.start+i*data.step_ms);
  const records=new Map(data.rows.map(r=>[r.user_id+':'+r.at,r]));
  return {times,series:users.map((u,i)=>({...u,color:COLORS[i%COLORS.length],
    records:times.map(at=>records.get(u.user_id+':'+at)||null)}))};
}
