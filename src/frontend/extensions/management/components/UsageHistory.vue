<template>
  <section class="history">
    <form @submit.prevent="load">
      <label>从<input type="date" v-model="from" required /></label>
      <label>到<input type="date" v-model="to" required /></label>
      <label>机器<select v-model="host"><option value="">全部</option><option v-for="h in hosts" :key="h.host_id" :value="h.host_id">{{ h.name }}</option></select></label>
      <button :disabled="busy">查询</button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-else>
      <p>{{ gb(total) }} GB · 上传＋下载</p>
      <div class="charts">
        <div aria-label="每日使用量">
          <div v-for="d in days" :key="d.day" class="bar"><span>{{ d.day }} · {{ gb(d.bytes) }} GB</span><progress :value="d.bytes" :max="maximum" /></div>
        </div>
        <div v-if="total" class="distribution">
          <div class="donut" :style="{background: gradient}" role="img" aria-label="各机器流量占比"><span>{{ gb(total) }} GB</span></div>
          <p v-for="(h,i) in distribution" :key="h.id"><i :style="{background:colors[i%colors.length]}" />{{ h.name }} · {{ (h.bytes/total*100).toFixed(1) }}%</p>
        </div>
      </div>
      <p v-if="!rows.length">所选日期暂无记录</p>
    </template>
  </section>
</template>
<script setup>
import {ref,computed,onMounted} from 'vue';
import {managementRequest} from '../api';
const props=defineProps({userId:String,hosts:Array});
const date=t=>new Date(t+28800000).toISOString().slice(0,10);
const from=ref(date(Date.now()-6*86400000)),to=ref(date(Date.now())),host=ref(''),rows=ref([]),busy=ref(false),error=ref('');
const colors=['#3b82f6','#14b8a6','#f59e0b','#a78bfa','#ec4899'];
const gb=n=>(n/1e9).toFixed(2);
const total=computed(()=>rows.value.reduce((s,r)=>s+r.upload+r.download,0));
const days=computed(()=>{const m=new Map();for(const r of rows.value)m.set(r.day,(m.get(r.day)||0)+r.upload+r.download);return [...m].map(([day,bytes])=>({day,bytes}));});
const maximum=computed(()=>Math.max(1,...days.value.map(r=>r.bytes)));
const distribution=computed(()=>props.hosts.map(h=>({id:h.host_id,name:h.name,bytes:rows.value.filter(r=>r.host_id===h.host_id).reduce((n,r)=>n+r.upload+r.download,0)})).filter(h=>h.bytes));
const gradient=computed(()=>{let at=0;return 'conic-gradient('+distribution.value.map((h,i)=>{const end=at+h.bytes/total.value*100,s=`${colors[i%colors.length]} ${at}% ${end}%`;at=end;return s;}).join(',')+')';});
async function load(){busy.value=true;error.value='';try{rows.value=(await managementRequest('post','/history',{user_id:props.userId,from:from.value,to:to.value,...(host.value?{host_id:host.value}:{})})).rows;}catch(e){rows.value=[];error.value=e.status===401?'请重新登录':'历史暂不可用；最多查询 90 天';}finally{busy.value=false;}}
onMounted(load);
</script>
<style scoped>
.history{border-top:1px solid #8795aa40;margin-top:18px;padding-top:16px}form{display:flex;gap:12px;flex-wrap:wrap}label{display:flex;gap:8px;align-items:center}input,select,button{font:inherit;padding:7px;border-radius:6px;max-width:100%}.charts{display:grid;grid-template-columns:1fr 1fr;gap:24px}.bar{display:grid;gap:5px;margin:12px 0}progress{width:100%;height:10px;accent-color:#3b82f6}.donut{width:150px;height:150px;border-radius:50%;display:grid;place-items:center}.donut span{width:110px;height:110px;border-radius:50%;display:grid;place-items:center;background:var(--bg-card,white)}i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}[role=alert]{color:#f97316}@media(max-width:650px){.charts{grid-template-columns:1fr}}
</style>
