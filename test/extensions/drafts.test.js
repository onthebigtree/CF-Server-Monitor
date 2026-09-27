import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeDraftRows,isDraftDirty,discardDraft,disabledUserStatus} from '../../src/frontend/extensions/management/drafts.js';
const merge=(old,records,reset)=>mergeDraftRows(old,records,'id',r=>({draftName:r.name,draftHosts:r.hosts||[],draftRefresh:r.refresh??60}),r=>r.revision,reset);
test('saving one row preserves other edits and their original CAS revision',()=>{
 let rows=merge([],[{id:'a',name:'A',revision:1},{id:'b',name:'B',revision:3}]);
 rows[0].draftName='Saved';rows[1].draftName='Unsaved';rows[1].draftHosts.push('host');
 rows=merge(rows,[{id:'a',name:'Saved',revision:2},{id:'b',name:'Remote',revision:4}],'a');
 assert.equal(isDraftDirty(rows[0]),false);assert.equal(rows[0]._editRevision,2);
 assert.equal(rows[1].draftName,'Unsaved');assert.deepEqual(rows[1].draftHosts,['host']);assert.equal(rows[1]._editRevision,3);
 discardDraft(rows[1]);assert.equal(rows[1].draftName,'Remote');assert.equal(rows[1]._editRevision,4);assert.equal(isDraftDirty(rows[1]),false);
});
test('select and checkbox changes are dirty without relying on input DOM events',()=>{
 const rows=merge([],[{id:'a',name:'A',revision:1}]);
 rows[0].draftRefresh=300;assert.equal(isDraftDirty(rows[0]),true);
 rows[0].draftRefresh=60;rows[0].draftHosts.push('host');assert.equal(isDraftDirty(rows[0]),true);
 const fresh=merge(rows,[{id:'a',name:'A',revision:1}]);assert.deepEqual(fresh[0].draftHosts,['host']);
});
test('disable status waits for node acknowledgements',()=>{
 assert.equal(disabledUserStatus({enabled:false,hosts:[{status:'pending'}]}),'禁用待节点同步');
 assert.match(disabledUserStatus({enabled:false,hosts:[{status:'applied'}]}),/^已阻止新连接/);
 assert.equal(disabledUserStatus({enabled:true,hosts:[]}), '');
});
