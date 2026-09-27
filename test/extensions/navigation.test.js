import {test} from 'node:test';
import assert from 'node:assert/strict';
import {managementReturnPath,isManagementHash,managementLoginRoute} from '../../src/frontend/extensions/management/navigation.js';
test('management deep links survive admin entry normalization',()=>{
 assert.equal(isManagementHash('#/management/machines'),true);
 assert.equal(isManagementHash('#/management/users?view=all'),true);
 assert.equal(isManagementHash('#/admin'),false);
 assert.equal(isManagementHash('#admin'),false);
});
test('post-login destinations are restricted to the two local management routes',()=>{
 assert.deepEqual(managementLoginRoute('/management/machines'),{path:'/admin',query:{returnTo:'/management/machines'}});
 for(const value of ['https://evil.test','//evil.test','/admin','/management/machines/extra',['/management/users'],null])assert.equal(managementReturnPath(value),null);
});
