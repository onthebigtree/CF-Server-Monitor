<template>
  <main class="machines">
    <header><h1>机器额度</h1><button @click="load" :disabled="busy">刷新</button></header>
    <p v-if="error" role="alert">{{error}}</p>
    <section v-if="totalUsed" class="overview"><div class="donut" :style="{background:gradient}" role="img" aria-label="各机器已用流量分布"><span>{{gb(totalUsed)}} GB</span></div><div><h2>各机已用分布</h2><p v-for="(m,i) in distribution" :key="m.host_id"><i :style="{background:colors[i%colors.length]}" />{{m.name}} · {{(m.bytes/totalUsed*100).toFixed(1)}}%</p></div></section>
    <article v-for="m in machines" :key="m.host_id">
      <h2>{{m.name}}</h2>
      <template v-if="m.snapshot">
        <p>{{gb(m.snapshot.used_bytes)}} / {{gb(m.snapshot.quota_bytes)}} GB <strong>{{m.snapshot.used_percent===null?'':m.snapshot.used_percent.toFixed(1)+'%'}}</strong></p>
        <progress v-if="m.snapshot.quota_bytes" :value="m.snapshot.used_bytes||0" :max="m.snapshot.quota_bytes" />
        <p class="muted">{{forecast(m.snapshot)}} · {{m.snapshot.billing_confirmed && m.snapshot.sample?new Date(m.snapshot.sample.cycle_end*1000).toLocaleDateString()+' 重置':'周期待确认'}}</p>
        <p v-if="m.snapshot.status==='stale'" role="status">采样已过期</p>
      </template>
      <p v-else>等待机器上报</p>
      <p v-if="m.snapshot?.health" class="muted">服务日志 {{mib(m.snapshot.health.logs_bytes)}} MiB · journal {{mib(m.snapshot.health.journal_bytes)}} MiB · {{m.snapshot.health.log_guard_enabled===true?'轮转已启用':m.snapshot.health.log_guard_enabled===false?'检查日志保护':'日志保护未知'}}{{m.snapshot.health.stale?' · 采样已过期':''}}</p>
      <details v-if="m.settings"><summary>额度与校准</summary>
        <form @submit.prevent="save(m)" @input="dirty=true">
          <label>套餐 GB<input type="number" min="0.001" step="0.001" v-model="m.draftQuota" :disabled="!canWrite" placeholder="未配置" /></label>
          <label>每月重置日<input type="number" min="1" max="31" required v-model="m.draftDay" :disabled="!canWrite" /></label>
          <label>刷新<select v-model="m.draftRefresh" :disabled="!canWrite"><option :value="0">手动</option><option :value="60">1 分钟</option><option :value="300">5 分钟</option><option :value="600">10 分钟</option><option :value="1800">30 分钟</option></select></label>
          <label>校准已用 GB<input type="number" min="0" step="0.001" v-model="m.calibrate" :disabled="!canWrite" placeholder="留空保留" /></label>
          <label><input type="checkbox" v-model="m.clearCalibration" :disabled="!canWrite" />取消校准</label>
          <button :disabled="busy||!canWrite">保存</button>
        </form>
      </details>
      <p class="muted">{{m.applied_revision===m.desired_revision?'已同步':'等待节点同步'}} · 入站、出站取较大值</p>
    </article>
  </main>
</template>
<script setup>
import {ref,computed,onMounted,onUnmounted} from 'vue';
import {managementRequest} from '../api';
const machines=ref([]),busy=ref(false),error=ref(''),canWrite=ref(false),dirty=ref(false);
let timer,lastLoad=0;
const colors=['#3b82f6','#14b8a6','#f59e0b','#a78bfa','#ec4899'];
const distribution=computed(()=>machines.value.filter(m=>m.snapshot?.used_bytes>0).map(m=>({host_id:m.host_id,name:m.name,bytes:m.snapshot.used_bytes})));
const totalUsed=computed(()=>distribution.value.reduce((s,m)=>s+m.bytes,0));
const gradient=computed(()=>{let at=0;return 'conic-gradient('+distribution.value.map((m,i)=>{const end=at+m.bytes/totalUsed.value*100,s=`${colors[i%colors.length]} ${at}% ${end}%`;at=end;return s;}).join(',')+')';});
const mib=n=>n==null?'未知':(n/1048576).toFixed(1);
const gb=n=>n===null||n===undefined?'未知':(n/1e9).toFixed(2);
function forecast(s){const f=s.forecast;if(!f||f.projected_used_bytes===undefined)return '暂无预测';return `预计周期末 ${gb(f.projected_used_bytes)} GB · ${f.state==='at_risk'||f.state==='exhausted'?'可能用完':'额度内'}`;}
async function load(){busy.value=true;error.value='';try{canWrite.value=(await managementRequest('get','/status')).writes_enabled;machines.value=(await managementRequest('get','/machines')).machines.map(m=>({...m,draftQuota:m.settings?.quota_bytes==null?'':m.settings.quota_bytes/1e9,draftDay:m.settings?.reset_day,draftRefresh:m.settings?.refresh_seconds??60,calibrate:'',clearCalibration:false}));dirty.value=false;lastLoad=Date.now();}catch(e){machines.value=[];canWrite.value=false;error.value=e.status===401?'请先登录':'机器数据暂不可用';}finally{busy.value=false;}}
async function save(m){busy.value=true;error.value='';try{await managementRequest('put','/machines/'+m.host_id,{revision:m.settings.revision,quota_bytes:m.draftQuota===''?null:Math.round(Number(m.draftQuota)*1e9),reset_day:Number(m.draftDay),refresh_seconds:Number(m.draftRefresh),...(m.clearCalibration?{calibrate_used_bytes:null}:m.calibrate!==''?{calibrate_used_bytes:Math.round(Number(m.calibrate)*1e9)}:{})});await load();}catch(e){error.value=e.status===409?'设置已更新，请刷新后重试':'保存失败，请检查设置和最新采样';}finally{busy.value=false;}}
onMounted(()=>{load();timer=setInterval(()=>{const periods=machines.value.map(m=>m.settings?.refresh_seconds||0).filter(n=>n>0);if(periods.length&&!document.hidden&&!busy.value&&!dirty.value&&Date.now()-lastLoad>=Math.min(...periods)*1000)load();},10000);});
onUnmounted(()=>clearInterval(timer));
</script>
<style scoped>
.overview{display:flex;align-items:center;gap:30px;flex-wrap:wrap;margin:20px 0}.donut{width:160px;height:160px;border-radius:50%;display:grid;place-items:center}.donut span{width:120px;height:120px;border-radius:50%;background:var(--bg-card,white);display:grid;place-items:center}i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px}.machines{max-width:1000px;margin:24px auto;padding:0 20px;color:var(--text-primary,#263449)}header{display:flex;justify-content:space-between;align-items:center}article{padding:20px;margin:16px 0;background:var(--bg-card,white);border:1px solid #8795aa40;border-radius:14px}h1{font-size:24px}h2{font-size:18px}progress{width:100%;height:12px;accent-color:#3b82f6}form{display:flex;gap:16px;flex-wrap:wrap;margin-top:15px}label{display:flex;gap:8px;align-items:center}input,select{max-width:150px;padding:8px;background:transparent;color:inherit;border:1px solid #8795aa70;border-radius:6px}button{padding:9px 14px;border:0;border-radius:8px;background:#2563eb;color:white}button:disabled{opacity:.4}.muted{font-size:13px;color:var(--text-secondary,#718096)}[role=alert]{color:#f97316}summary{cursor:pointer}strong{margin-left:10px}
</style>
