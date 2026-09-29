<template>
  <section aria-label="用户用量看板" :aria-busy="loading">
    <div class="toolbar">
      <div><h2>用量总览</h2><p>{{window.from}} — {{window.to}} · 北京时间 · 上传＋下载</p></div>
      <div class="periods" aria-label="统计时段"><button v-for="item in periods" :key="item.value" :aria-pressed="period === item.value" @click="period=item.value">{{item.label}}</button></div>
    </div>
    <form v-if="period==='custom'" class="date-range" @submit.prevent="applyDates"><label>开始日期<input type="date" v-model="fromDate" :max="today" required /></label><label>结束日期<input type="date" v-model="toDate" :max="today" required /></label><button type="submit">查看</button><span v-if="dateError" role="alert">{{dateError}}</span></form>
    <div class="metrics">
      <div><span>用户总数</span><strong>{{users.length}} <small>人</small></strong><small>{{enabled}} 人启用</small></div>
      <div><span>{{failed ? '已读取用量' : '时段总用量'}}</span><strong>{{loading ? '…' : format(total)}} <small v-if="!loading">GB</small></strong><small>{{loading ? '读取账本中' : '各用户已记录用量合计'}}</small></div>
      <div><span>有用量的用户</span><strong>{{loading ? '…' : active}} <small>人</small></strong><small v-if="updated && !loading">{{updated}} 更新</small></div>
    </div>
    <p v-if="failed && !loading" class="warning" role="status">{{failed}} 位用户用量读取失败，请刷新重试。</p>
    <UsageTimeline :users="users" :window="window" :refresh-key="refreshKey" @auth-error="emit('auth-error',$event)" />
    <div class="user-list">
      <div class="list-heading"><h2>使用者</h2><span>条形长度按当前最高用量对比</span></div>
      <p v-if="!users.length" class="empty">暂无用户，点击“添加用户”开始。</p>
      <div v-for="user in ranked" :key="user.user_id" class="user-row">
        <div class="identity"><strong>{{user.name}}</strong><div><span :class="['badge',{off:!user.enabled}]">{{user.enabled ? '启用' : '停用'}}</span><small>{{user.hosts.filter(h=>h.allowed).length}} 台授权机器</small><small v-if="user.hosts.some(h=>h.status==='pending')">待同步</small></div></div>
        <div class="usage"><div><span>{{usageLabel(user.user_id)}}</span><small v-if="!loading && values[user.user_id]?.bytes != null && total">占 {{(values[user.user_id].bytes/total*100).toFixed(1)}}%</small></div><progress :aria-label="user.name+'的用量'" :value="loading ? 0 : values[user.user_id]?.bytes || 0" :max="maximum" /></div>
        <div class="row-actions"><button class="expand" :aria-expanded="!!expanded[user.user_id]" :aria-controls="'machines-'+user.user_id" @click="expanded[user.user_id]=!expanded[user.user_id]">{{expanded[user.user_id] ? '收起明细' : '机器明细'}} <span aria-hidden="true">{{expanded[user.user_id] ? '▴' : '▾'}}</span></button>
        <QuickSubscriptionCopy :user-id="user.user_id" :disabled="!user.enabled || !canWrite" @auth-error="emit('auth-error',$event)" />
        <button class="manage" @click="$emit('manage',user)" :aria-label="'管理 '+user.name">管理</button></div>
        <div v-if="expanded[user.user_id]" :id="'machines-'+user.user_id" class="machine-details">
          <p class="detail-caption">{{window.from}} — {{window.to}} · 最终出口机器 · 上传＋下载</p>
          <p v-if="loading" role="status">正在读取机器用量…</p>
          <p v-else-if="values[user.user_id]?.failed" class="warning" role="status">机器用量暂不可用，请刷新重试。</p>
          <template v-else>
            <div class="table-scroll"><table :aria-label="user.name+'的机器用量'"><thead><tr><th scope="col">机器</th><th scope="col">上传</th><th scope="col">下载</th><th scope="col">合计</th><th scope="col">占该用户用量</th></tr></thead>
              <tbody><tr v-for="host in machineBreakdown(values[user.user_id],hosts)" :key="host.host_id"><th scope="row">{{host.name}}</th><td data-label="上传" :title="exactBytes(host.upload)">{{detailBytes(host.upload)}}</td><td data-label="下载" :title="exactBytes(host.download)">{{detailBytes(host.download)}}</td><td data-label="合计" :title="exactBytes(host.bytes)">{{host.bytes===null?'暂无记录':detailBytes(host.bytes)}}</td><td data-label="占该用户用量">{{host.share===null?'—':host.share.toFixed(1)+'%'}}</td></tr></tbody>
            </table></div>
            <p class="detail-caption">占比按该用户在此时段的已记录用量计算；暂无记录不代表零用量。</p>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup>
import {ref,computed,watch,onUnmounted} from 'vue';
import UsageTimeline from './UsageTimeline.vue';
import QuickSubscriptionCopy from './QuickSubscriptionCopy.vue';
import {managementRequest} from '../api';
import {overviewWindow,loadUserUsage,machineBreakdown} from '../user-overview.js';
const props=defineProps({users:{type:Array,default:()=>[]},hosts:{type:Array,default:()=>[]},canWrite:Boolean,refreshKey:Number});
const emit=defineEmits(['manage','auth-error']);
const periods=[{value:'today',label:'今日'},{value:'week',label:'近7天'},{value:'month',label:'本月'},{value:'custom',label:'自选日期'}];
const period=ref('today'),window=ref(overviewWindow('today')),values=ref({}),loading=ref(false),updated=ref('');
const today=overviewWindow('today').to;
const fromDate=ref(today),toDate=ref(today),customWindow=ref({from:today,to:today}),dateError=ref('');
function applyDates(){
  const duration=Date.parse(toDate.value)-Date.parse(fromDate.value);
  if(!Number.isFinite(duration)||duration<0||duration>=90*86400000||toDate.value>overviewWindow('today').to){dateError.value='请选择不超过 90 天且不晚于今天的日期范围';return;}
  dateError.value='';customWindow.value={from:fromDate.value,to:toDate.value};
}
const expanded=ref({});
function detailBytes(n){if(n==null)return '—';if(n===0)return '0 B';const units=['B','KB','MB','GB','TB'];const i=Math.min(4,Math.floor(Math.log10(n)/3));return (n/1000**i).toLocaleString('zh-CN',{maximumFractionDigits:2})+' '+units[i];}
function exactBytes(n){return n==null?'暂无记录':n.toLocaleString('zh-CN')+' 字节';}
let generation=0;
const format=n=>(n/1e9).toFixed(2);
const enabled=computed(()=>props.users.filter(u=>u.enabled).length);
const total=computed(()=>Object.values(values.value).reduce((s,v)=>s+(v.bytes||0),0));
const active=computed(()=>Object.values(values.value).filter(v=>v.bytes>0).length);
const failed=computed(()=>Object.values(values.value).filter(v=>v.failed).length);
const maximum=computed(()=>Math.max(1,...Object.values(values.value).map(v=>v.bytes||0)));
const ranked=computed(()=>[...props.users].sort((a,b)=>(values.value[b.user_id]?.bytes??-1)-(values.value[a.user_id]?.bytes??-1)));
function usageLabel(id){const value=values.value[id];return loading.value?'读取中':value?.failed?'暂不可用':value?.bytes==null?'暂无记录':format(value.bytes)+' GB';}
async function load(){
  const current=++generation;window.value=period.value==='custom'?{...customWindow.value}:overviewWindow(period.value);values.value={};updated.value='';loading.value=true;
  try{
    const result=await loadUserUsage(props.users,window.value,managementRequest);
    if(current===generation){values.value=result;updated.value=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'});}
  }catch(error){if(current===generation)emit('auth-error',error);}
  finally{if(current===generation)loading.value=false;}
}
watch(()=>[props.users.map(u=>u.user_id).join(','),props.refreshKey,period.value,customWindow.value],load,{immediate:true});
onUnmounted(()=>{generation++;});
</script>
<style scoped>
.row-actions{display:flex;align-items:center;gap:8px}.expand{background:transparent;color:var(--text-secondary,#718096);font-size:12px}.expand:hover,.expand[aria-expanded=true]{color:#2563eb;background:#2563eb0a}.expand:focus-visible{outline:2px solid #2563eb;outline-offset:2px}.machine-details{grid-column:1/-1;min-width:0;padding:4px 16px 8px;background:#8795aa08;border:1px solid #8795aa20;border-radius:10px}.detail-caption{font-size:12px;color:var(--text-secondary,#718096);line-height:1.6;margin:12px 0}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}th,td{text-align:right;padding:12px;border-bottom:1px solid #8795aa20}th:first-child{text-align:left;padding-left:0}thead th{font-weight:500;color:var(--text-secondary,#718096)}tbody th{font-weight:500}tbody tr:last-child>*{border-bottom:0}@media(max-width:600px){.row-actions{grid-column:2;grid-row:1;flex-wrap:wrap;justify-content:flex-end;gap:4px}.row-actions button{padding:8px}.machine-details{padding:0 10px}.machine-details th,.machine-details td{padding:10px 8px}}

.date-range{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 0 18px;font-size:12px}.date-range label{display:flex;gap:8px;align-items:center}.date-range input{font:inherit;background:var(--bg-card,white);color:inherit;border:1px solid #8795aa40;border-radius:7px;padding:8px}.date-range button{background:#2563eb;color:white}.date-range span{color:#c2410c}

h2{font-size:18px;margin:0}.toolbar,.list-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:24px 0 18px}.toolbar p,.list-heading span{font-size:12px;color:var(--text-secondary,#718096);margin:7px 0 0}.periods{display:flex;gap:4px;background:#8795aa15;padding:4px;border-radius:10px}button{font:inherit;border:0;cursor:pointer;border-radius:7px;padding:9px 14px;white-space:nowrap}.periods button{background:transparent;color:inherit}.periods button[aria-pressed=true]{background:var(--bg-card,white);color:#2563eb;box-shadow:0 1px 5px #0001}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.metrics>div{background:var(--bg-card,white);border:1px solid #8795aa30;border-radius:14px;padding:20px;display:grid;gap:10px}.metrics span{font-size:13px;color:var(--text-secondary,#718096)}.metrics strong{font-size:30px;line-height:1.2}.metrics small{font-size:12px;font-weight:normal;color:var(--text-secondary,#718096)}.user-list{margin-top:24px;background:var(--bg-card,white);border:1px solid #8795aa30;border-radius:14px;padding:0 20px}.list-heading{margin:20px 0}.user-row{display:grid;grid-template-columns:minmax(140px,1fr) minmax(160px,1.3fr) auto;gap:24px;align-items:center;padding:20px 0;border-top:1px solid #8795aa25}.identity strong{overflow-wrap:anywhere}.identity>div{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:9px}.identity small,.usage small{font-size:12px;color:var(--text-secondary,#718096)}.badge{font-size:11px;background:#10b98118;color:#059669;border-radius:5px;padding:3px 7px}.badge.off{background:#8795aa20;color:var(--text-secondary,#718096)}.usage>div{display:flex;justify-content:space-between;gap:8px;font-size:14px;margin-bottom:6px}progress{display:block;width:100%;height:8px;appearance:none;border:0;border-radius:8px;overflow:hidden;background:#8795aa20}progress::-webkit-progress-bar{background:#8795aa20}progress::-webkit-progress-value{background:#3b82f6;border-radius:8px}progress::-moz-progress-bar{background:#3b82f6}.manage{background:#2563eb12;color:#2563eb}.empty{padding-bottom:20px}.warning{color:#c2410c;font-size:13px}@media(max-width:600px){.toolbar{flex-wrap:wrap}.metrics{gap:8px}.metrics>div{padding:12px}.metrics strong{font-size:24px}.user-row{grid-template-columns:1fr auto;gap:14px}.usage{grid-column:1/-1;grid-row:2}.manage{grid-column:2;grid-row:1}.list-heading span{display:none}.user-list{padding:0 14px}}

.user-row>*{min-width:0}.row-actions>button{min-height:44px}.row-actions{gap:4px}
@media(max-width:900px) and (min-width:701px){.user-row{grid-template-columns:1fr 1fr}.row-actions{grid-column:1/-1;justify-content:flex-end}}
@media(max-width:700px){
 .toolbar{align-items:stretch;flex-direction:column;gap:12px}.periods{display:grid;grid-template-columns:repeat(4,1fr);width:100%;box-sizing:border-box}.periods button{padding:10px 4px;min-height:44px;font-size:13px}.toolbar p{line-height:1.6}
 .user-row{grid-template-columns:minmax(0,1fr);gap:14px}.identity{grid-column:1;grid-row:1}.usage{grid-column:1;grid-row:2}.row-actions{grid-column:1;grid-row:3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}.row-actions .manage{grid-column:auto;grid-row:auto}.row-actions>button{padding:10px 6px;font-size:12px}.machine-details{grid-column:1;grid-row:4;padding:0 12px}.user-list{padding:0 14px}
 .machine-details .table-scroll{overflow:visible}.machine-details table,.machine-details tbody{display:block;white-space:normal}.machine-details thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.machine-details tbody tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;padding:14px 0;border-bottom:1px solid #8795aa25}.machine-details tbody tr:last-child{border:0}.machine-details tbody th{grid-column:1/-1;overflow-wrap:anywhere}.machine-details tbody th,.machine-details tbody td{padding:0;border:0;text-align:left}.machine-details td::before{content:attr(data-label);display:block;font-size:11px;color:var(--text-secondary,#718096);margin-bottom:4px}.machine-details td{font-size:14px;font-variant-numeric:tabular-nums}
 .metrics{gap:6px}.metrics>div{padding:12px 8px;min-width:0}.metrics strong{font-size:22px;overflow-wrap:anywhere}.metrics span,.metrics small{font-size:11px}.date-range label{width:100%;justify-content:space-between}.date-range input{min-width:0;font-size:16px}.list-heading span{display:none}
}
</style>
