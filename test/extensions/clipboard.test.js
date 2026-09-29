import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copySubscription} from '../../src/frontend/extensions/management/clipboard.js';
test('copy reports actual success and clears temporary credential text on failure',async()=>{
 let copied,removed=false,restored=false,containerUsed=false;
 const field={style:{},value:'',focus(){},select(){},setSelectionRange(){},remove(){removed=true;}};
 const container={appendChild(f){assert.equal(f,field);containerUsed=true;}};
 const platform={navigator:{clipboard:{writeText:async value=>{copied=value;}}}};
 assert.equal(await copySubscription('https://example.invalid/personal/test',null,platform),true);
 assert.equal(copied,'https://example.invalid/personal/test');
 platform.navigator.clipboard.writeText=async()=>{throw new Error('permission denied');};
 platform.document={activeElement:{focus(){restored=true;}},createElement(){return field;},execCommand(){return false;}};
 assert.equal(await copySubscription('private-placeholder',container,platform),false);assert.equal(containerUsed,true);assert.equal(removed,true);assert.equal(restored,true);assert.equal(field.value,'');
 platform.document.execCommand=()=>true;assert.equal(await copySubscription('another-placeholder',container,platform),true);
 assert.equal(await copySubscription('',null,platform),false);

});
