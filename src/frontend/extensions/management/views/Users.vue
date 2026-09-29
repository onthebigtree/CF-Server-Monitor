<template>
  <main class="management-page">
    <header>
      <h1>用户与订阅</h1>
      <div class="actions"><button @click="showCreate = !showCreate" :disabled="busy || !canWrite">{{showCreate ? "收起创建" : "添加用户"}}</button><button @click="load" :disabled="busy">刷新</button></div>
    </header>
    <p v-if="error && !selectedUser" role="alert">
      {{ error }}
      <router-link v-if="needsLogin" :to="managementLoginRoute('/management/users')">前往登录</router-link>
    </p>
    <p v-if="notice && !selectedUser" role="status">{{notice}}</p>
    <template v-if="status">
      <p v-if="status.mode === 'shadow'" class="mode">
        {{
          status.mode === "shadow" ? "测试环境 · 不会修改现有节点" : "管理后台"
        }}
      </p>
      <form v-if="showCreate" class="create-form" @submit.prevent="create">
        <label
          >使用者名称<input
            v-model="newName"
            maxlength="80"
            required
            :disabled="busy || !canWrite"
        /></label>
        <button :disabled="busy || !canWrite">创建用户</button>
      </form>
      <UserOverview :users="users" :hosts="hosts" :refresh-key="refreshKey" @manage="openManager" @auth-error="showError" />
      <dialog v-if="selectedUser" ref="managerDialog" aria-labelledby="manager-title" @cancel.prevent="closeManager">
        <header><h2 id="manager-title">管理 · {{selectedUser.name}}</h2><button type="button" :disabled="busy" @click="closeManager">{{isDraftDirty(selectedUser) ? '取消并关闭' : '关闭'}}</button></header>
        <p v-if="error" role="alert">{{error}}</p><p v-if="notice" role="status">{{notice}}</p>
        <article v-for="user in [selectedUser]" :key="user.user_id">
        <form @submit.prevent="save(user)">
          <label
            >名称<input
              v-model="user.draftName"
              maxlength="80"
              required
              :disabled="busy || !canWrite"
          /></label>
          <label
            ><input
              type="checkbox"
              v-model="user.draftEnabled"
              :disabled="busy || !canWrite"
            />启用</label
          >
          <fieldset :disabled="busy || !canWrite">
            <legend>授权机器</legend>
            <label v-for="host in hosts" :key="host.host_id"
              ><input
                type="checkbox"
                :value="host.host_id"
                v-model="user.draftHosts"
              />{{ host.name }}</label
            >
          </fieldset>
          <p class="sync">
            {{
              user.hosts.some((h) => h.status === "pending")
                ? "授权待同步"
                : user.hosts.length
                  ? "已同步"
                  : "尚未授权机器"
            }}
          </p>
          <label>月参考额度 GB<input type="number" min="0.001" step="0.001" v-model="user.draftQuota" :disabled="busy || !canWrite" placeholder="未配置" /></label>
          <button :disabled="busy || !canWrite">保存</button>
          <button v-if="isDraftDirty(user)" type="button" :disabled="busy" @click="discardDraft(user)">撤销修改</button>
        </form>
        <p v-if="!user.enabled" class="sync">{{disabledUserStatus(user)}}</p>
        <div class="actions">
          <button type="button" :disabled="busy || !canWrite || !user.enabled" @click="links(user, false)">查看订阅链接</button>
          <button type="button" :disabled="busy || !canWrite || !user.enabled" @click="resetUser = user">重置链接</button>
          <button type="button" @click="historyUser = historyUser === user.user_id ? null : user.user_id">使用历史</button>
        </div>
        <div v-if="resetUser?.user_id === user.user_id" role="alert">
          旧订阅链接将失效；已下载的节点仍按用户授权运行。
          <button :disabled="busy" @click="links(user, true)">确认重置链接</button>
          <button @click="resetUser = null">取消</button>
        </div>
        <div v-if="visibleLinks?.user_id === user.user_id" class="links">
          <label>Clash<input readonly :value="visibleLinks.mihomo" aria-label="Clash 订阅" /></label>
          <label>Shadowrocket<input readonly :value="visibleLinks.shadowrocket" aria-label="Shadowrocket 订阅" /></label>
          <button @click="visibleLinks = null">收起链接</button>
        </div>
        <UsageHistory v-if="historyUser === user.user_id" :user-id="user.user_id" :hosts="hosts" />
      </article>
      </dialog>
    </template>
  </main>
</template>
<script setup>
import { ref, onMounted, computed, nextTick } from "vue";
import UserOverview from "../components/UserOverview.vue";
import { managementRequest } from "../api";
import { managementLoginRoute } from "../navigation.js";
import UsageHistory from "../components/UsageHistory.vue";
import {mergeDraftRows,isDraftDirty,discardDraft,disabledUserStatus} from '../drafts.js';
const notice=ref('');
const showCreate=ref(false), selectedId=ref(null), managerDialog=ref(null), refreshKey=ref(0);
const selectedUser=computed(()=>users.value.find(u=>u.user_id===selectedId.value));
async function openManager(user) {
  selectedId.value=user.user_id;error.value='';notice.value='';
  await nextTick();managerDialog.value?.showModal();
}
function closeManager() {
  if(busy.value)return;
  if(selectedUser.value)discardDraft(selectedUser.value);
  managerDialog.value?.close();selectedId.value=null;
  visibleLinks.value=null;resetUser.value=null;historyUser.value=null;error.value='';notice.value='';
}
const visibleLinks=ref(null), resetUser=ref(null), historyUser=ref(null);
const users = ref([]),
  hosts = ref([]),
  status = ref(null),
  error = ref(""),
  busy = ref(false),
  newName = ref(""),
  needsLogin = ref(false);
const canWrite = computed(() => status.value?.writes_enabled === true);
function showError(e) {
  visibleLinks.value = null;
  if ([401, 403].includes(e.status)) {
    selectedId.value=null;resetUser.value=null;historyUser.value=null;
    status.value = null;
    users.value = [];
    hosts.value = [];
  }
  needsLogin.value = e.status === 401;
  error.value =
    e.status === 401
      ? "请重新登录后访问用户管理。"
      : e.status === 409
        ? "记录已更新；刷新保留输入，可撤销修改后重新编辑。"
        : e.status === 404
          ? "管理扩展尚未启用。"
          : e.status === 503
            ? "管理服务暂不可用。"
            : e.message;
}
async function refresh(resetId=null) {
  status.value = await managementRequest("get", "/status");
  const data = await managementRequest("get", "/users");
  hosts.value = data.hosts;
  users.value = mergeDraftRows(users.value,data.users,"user_id",(u) => ({
    draftName: u.name,
    draftQuota: u.quota_bytes === null ? "" : u.quota_bytes / 1e9,
    draftEnabled: u.enabled,
    draftHosts: u.hosts.filter((h) => h.allowed).map((h) => h.host_id),
  }),u=>u.revision,resetId);
}
async function load() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await refresh();
    refreshKey.value++;
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}
async function create() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await managementRequest("post", "/users", {
      name: newName.value,
      hosts: [],
    });
    newName.value = "";showCreate.value=false;
    notice.value="用户已创建";
    await refreshAfterSave();
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}
async function save(user) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await managementRequest("put", "/users/" + user.user_id, {
      revision: user._editRevision,
      name: user.draftName,
      enabled: user.draftEnabled,
      hosts: user.draftHosts,
      quota_bytes: user.draftQuota === "" ? null : Math.round(Number(user.draftQuota) * 1e9),
    });
    notice.value="已保存";
    await refreshAfterSave(user.user_id);
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}
async function refreshAfterSave(id=null) {
  try {await refresh(id);} catch(e) {notice.value="已保存，但最新数据读取失败；请刷新核对，勿重复提交。";if([401,403].includes(e.status))showError(e);}
}
async function links(user, reset) {
  if(busy.value)return;
  busy.value=true; error.value=""; visibleLinks.value=null;
  try {
    const data=await managementRequest("post","/users/"+user.user_id+"/subscription",{reset});
    visibleLinks.value={user_id:user.user_id,...data};resetUser.value=null;
    await refreshAfterSave();
  } catch(e){showError(e);} finally{busy.value=false;}
}
onMounted(load);
</script>
<style scoped>
dialog{width:min(820px,calc(100vw - 32px));max-height:85dvh;overflow:auto;margin:auto;padding:24px;border:1px solid #8795aa60;border-radius:18px;background:var(--bg-card,white);color:inherit;box-shadow:0 24px 80px #0004}dialog::backdrop{background:#11182788}dialog article{border:0;padding:0}dialog header{gap:16px;margin-bottom:20px}dialog h2{font-size:20px;margin:0}.create-form{padding:20px;margin:16px 0;background:var(--bg-card,white);border-radius:12px}header .actions{margin-top:0}dialog form{align-items:flex-start}dialog fieldset label{white-space:nowrap}@media(max-width:600px){dialog{padding:16px}.management-page{padding:0 12px}header{gap:10px;flex-wrap:wrap}}

.actions {display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;}
.links {margin-top:14px;display:grid;gap:10px;}
.links input {width:100%;max-width:none !important;}
.management-page {
  max-width: 1000px;
  margin: 24px auto;
  padding: 0 20px;
  color: var(--text-primary, #263449);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h1 {
  font-size: 24px;
}
article {
  background: var(--bg-card, white);
  border: 1px solid #8795aa40;
  border-radius: 14px;
  padding: 18px;
  margin-top: 16px;
}
form {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
}
label {
  display: flex;
  align-items: center;
  gap: 8px;
}
input:not([type="checkbox"]) {
  padding: 8px;
  border: 1px solid #8795aa70;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  max-width: 220px;
}
button {
  padding: 9px 16px;
  background: #2563eb;
  color: white;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
fieldset {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
  border: 0;
  padding: 8px 0;
}
.sync,
.mode {
  color: var(--text-secondary, #718096);
  font-size: 14px;
}
.sync {
  margin: 0;
  flex: 1;
}
[role="alert"] {
  color: #c2410c;
}
</style>
