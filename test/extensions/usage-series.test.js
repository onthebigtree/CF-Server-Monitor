import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seriesGrid,bytes,clock} from '../../src/frontend/extensions/management/usage-series.js';
test('series keeps missing buckets null, preserves zero and stable user colors',()=>{
  const a={user_id:'a',at:60000,upload:0,download:0};
  const data={start:0,end:180001,step_ms:60000,rows:[a,{user_id:'b',at:0,upload:10,download:30}]};
  const g=seriesGrid(data,[{user_id:'a'},{user_id:'b'}]);
  assert.deepEqual(g.times,[0,60000,120000,180000]);
  assert.deepEqual(g.series[0].records,[null,a,null,null]);
  assert.notEqual(g.series[0].color,g.series[1].color);
});
test('small recorded values keep precision and dates always use Shanghai time',()=>{
  assert.equal(bytes(0),'0 B');assert.equal(bytes(1024),'1.024 KB');
  assert.equal(bytes(null),'暂无记录');
  assert.equal(clock(Date.parse('2026-09-27T16:00:00Z')),'09-28 00:00');
});
