import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overviewWindow,summarizeHistory,loadUserUsage,machineBreakdown} from '../../src/frontend/extensions/management/user-overview.js';
test('overview periods share Shanghai calendar dates, including midnight and year rollover',()=>{
 const now=Date.parse('2026-12-31T16:05:00Z');
 assert.deepEqual(overviewWindow('month',now),{from:'2027-01-01',to:'2027-01-01'});
 assert.deepEqual(overviewWindow('week',now),{from:'2026-12-26',to:'2027-01-01'});
 assert.deepEqual(overviewWindow('today',now),{from:'2027-01-01',to:'2027-01-01'});
});
test('history adds upload and download across hosts; no rows differs from measured zero',()=>{
 assert.deepEqual(summarizeHistory([]),{bytes:null,hosts:[]});
 assert.deepEqual(summarizeHistory([{upload:0,download:0}]),{bytes:0,hosts:[]});
 assert.deepEqual(summarizeHistory([{upload:20,download:40},{upload:10,download:50}]),{bytes:120,hosts:[]});
 assert.throws(()=>summarizeHistory([{upload:'20',download:40}]));
});
test('bounded reads preserve per-user failures and include disabled users history',async()=>{
 let current=0,max=0,calls=0;
 const result=await loadUserUsage([{user_id:'a',enabled:false},{user_id:'b'},{user_id:'c'}],{from:'2026-09-01',to:'2026-09-27'},async(method,path,payload)=>{
  calls++;current++;max=Math.max(max,current);await new Promise(r=>setTimeout(r,5));current--;
  if(payload.user_id==='b')throw new Error('offline');
  return {rows:[{upload:1,download:2}]};
 });
 assert.equal(calls,3);assert.equal(max,2);assert.equal(result.a.bytes,3);assert.equal(result.b.failed,true);
});
test('auth failure aborts queued reads and does not return private totals',async()=>{
 let calls=0;
 await assert.rejects(loadUserUsage([{user_id:'a'},{user_id:'b'}],{},async()=>{calls++;throw Object.assign(new Error('auth'),{status:401});},1),{status:401});
 assert.equal(calls,1);
});

test('machine breakdown reconciles multiple days, keeps retired machines and distinguishes missing from zero',()=>{
 const summary=summarizeHistory([{host_id:'a',upload:20,download:40},{host_id:'a',upload:10,download:30},{host_id:'retired',upload:25,download:75},{host_id:'zero',upload:0,download:0}]);
 const rows=machineBreakdown(summary,[{host_id:'a',name:'Machine A'},{host_id:'zero',name:'Zero'},{host_id:'missing',name:'Missing'}]);
 assert.equal(summary.bytes,200);
 assert.equal(rows.reduce((n,r)=>n+(r.bytes??0),0),summary.bytes);
 assert.deepEqual(rows.find(r=>r.host_id==='a'),{host_id:'a',name:'Machine A',upload:30,download:70,bytes:100,share:50});
 assert.equal(rows.find(r=>r.host_id==='retired').share,50);
 assert.equal(rows.find(r=>r.host_id==='zero').bytes,0);
 assert.equal(rows.find(r=>r.host_id==='zero').share,0);
 assert.equal(rows.find(r=>r.host_id==='missing').bytes,null);
 assert.equal(rows.at(-1).host_id,'missing');
 assert.equal(machineBreakdown(summarizeHistory([{host_id:'zero',upload:0,download:0}]),[])[0].share,null);
 assert.equal(machineBreakdown(summarizeHistory([]),[{host_id:'a'}])[0].bytes,null);
});
