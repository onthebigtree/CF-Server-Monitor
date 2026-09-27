import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overviewWindow,summarizeHistory,loadUserUsage} from '../../src/frontend/extensions/management/user-overview.js';
test('overview periods share Shanghai calendar dates, including midnight and year rollover',()=>{
 const now=Date.parse('2026-12-31T16:05:00Z');
 assert.deepEqual(overviewWindow('month',now),{from:'2027-01-01',to:'2027-01-01'});
 assert.deepEqual(overviewWindow('week',now),{from:'2026-12-26',to:'2027-01-01'});
 assert.deepEqual(overviewWindow('today',now),{from:'2027-01-01',to:'2027-01-01'});
});
test('history adds upload and download across hosts; no rows differs from measured zero',()=>{
 assert.deepEqual(summarizeHistory([]),{bytes:null});
 assert.deepEqual(summarizeHistory([{upload:0,download:0}]),{bytes:0});
 assert.deepEqual(summarizeHistory([{upload:20,download:40},{upload:10,download:50}]),{bytes:120});
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
