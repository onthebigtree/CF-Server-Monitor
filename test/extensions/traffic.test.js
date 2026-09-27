import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachManagedQuota,preserveNativeQuota} from '../../src/extensions/management/traffic.js';
test('quota adapter preserves raw counters and never exposes management to anonymous monitors',async()=>{
 let calls=0;const env={MANAGEMENT_ENABLED:'true',MANAGEMENT_HOST_MAP:'{"server":"host"}',MANAGEMENT_ADMIN:{async fetch(){calls++;return Response.json({machines:[{host_id:'host',snapshot:{used_bytes:50,quota_bytes:null,used_percent:null,status:'quota_unknown'}}]})}}};
 const servers=[{id:'server',net_rx:123,net_tx:456}];await attachManagedQuota(servers,env,false);assert.equal(calls,0);
 await attachManagedQuota(servers,env,true);await attachManagedQuota(servers,env,true);assert.equal(calls,1);assert.equal(servers[0].net_rx,123);assert.equal(servers[0].managed_quota.quota_bytes,null);
});
test('native editing cannot overwrite managed quota while unrelated settings survive',async()=>{
 const data={action:'edit',id:'server',name:'renamed',traffic_limit:999,reset_day:22};const env={MANAGEMENT_ENABLED:'true',MANAGEMENT_HOST_MAP:'{"server":"host"}',DB:{prepare(){return {bind(){return {async first(){return {traffic_limit:100,reset_day:9}}}}}}}};
 await preserveNativeQuota(data,env);assert.equal(data.name,'renamed');assert.equal(data.traffic_limit,100);assert.equal(data.reset_day,9);
});
