// Optional adapter: monitoring counters stay raw; quota comes from management.
const cache = new WeakMap();
export async function attachManagedQuota(servers, env, authenticated) {
  if (!authenticated || env.MANAGEMENT_ENABLED !== 'true') return;
  let mapping;
  try { mapping=JSON.parse(env.MANAGEMENT_HOST_MAP || '{}'); } catch { return; }
  for(const server of servers) if(mapping[server.id]) server.managed_quota={status:'unavailable'};
  if(!env.MANAGEMENT_ADMIN) return;
  let entry=cache.get(env.MANAGEMENT_ADMIN);
  if(!entry || entry.until<Date.now()) {
    try {
      const response=await env.MANAGEMENT_ADMIN.fetch(new Request('https://control.internal/v1/machines',{signal:AbortSignal.timeout(4000)}));
      if(!response.ok)return;
      entry={until:Date.now()+30000,machines:(await response.json()).machines};
      cache.set(env.MANAGEMENT_ADMIN,entry);
    } catch {return;}
  }
  for(const server of servers) {
    const machine=entry.machines.find(m=>m.host_id===mapping[server.id]);
    if(machine?.snapshot) server.managed_quota={status:machine.snapshot.status,used_bytes:machine.snapshot.used_bytes,quota_bytes:machine.snapshot.quota_bytes,used_percent:machine.snapshot.used_percent};
  }
}
export async function preserveNativeQuota(data,env) {
  if(env.MANAGEMENT_ENABLED!=='true'||data.action!=='edit'||typeof data.id!=='string')return;
  let map;try{map=JSON.parse(env.MANAGEMENT_HOST_MAP||'{}');}catch{return;}
  if(!map[data.id])return;
  const row=await env.DB.prepare('SELECT traffic_limit,traffic_calc_type,reset_day,rx_correction,tx_correction FROM servers WHERE id=?').bind(data.id).first();
  if(row)Object.assign(data,row);
}
