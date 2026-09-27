<template>
  <section aria-label="用户用量看板" :aria-busy="loading">
    <div class="toolbar">
      <div><h2>用量总览</h2><p>{{window.from}} — {{window.to}} · 北京时间 · 上传＋下载</p></div>
      <div class="periods" aria-label="统计时段"><button v-for="item in periods" :key="item.value" :aria-pressed="period === item.value" @click="period=item.value">{{item.label}}</button></div>
    </div>
    <div class="metrics">
      <div><span>用户总数</span><strong>{{users.length}} <small>人</small></strong><small>{{enabled}} 人启用</small></div>
      <div><span>{{failed ? '已读取用量' : '时段总用量'}}</span><strong>{{loading ? '…' : format(total)}} <small v-if="!loading">GB</small></strong><small>{{loading ? '读取账本中' : '各用户已记录用量合计'}}</small></div>
      <div><span>有用量的用户</span><strong>{{loading ? '…' : active}} <small>人</small></strong><small v-if="updated && !loading">{{updated}} 更新</small></div>
    </div>
    <p v-if="failed && !loading" class="warning" role="status">{{failed}} 位用户用量读取失败，请刷新重试。</p>
    <div class="user-list">
      <div class="list-heading"><h2>使用者</h2><span>条形长度按当前最高用量对比</span></div>
      <p v-if="!users.length" class="empty">暂无用户，点击“添加用户”开始。</p>
      <div v-for="user in ranked" :key="user.user_id" class="user-row">
        <div class="identity"><strong>{{user.name}}</strong><div><span :class="['badge',{off:!user.enabled}]">{{user.enabled ? '启用' : '停用'}}</span><small>{{user.hosts.filter(h=>h.allowed).length}} 台授权机器</small><small v-if="user.hosts.some(h=>h.status==='pending')">待同步</small></div></div>
        <div class="usage"><div><span>{{usageLabel(user.user_id)}}</span><small v-if="!loading && values[user.user_id]?.bytes != null && total">占 {{(values[user.user_id].bytes/total*100).toFixed(1)}}%</small></div><progress :aria-label="user.name+'的用量'" :value="loading ? 0 : values[user.user_id]?.bytes || 0" :max="maximum" /></div>
        <button class="manage" @click="$emit('manage',user)" :aria-label="'管理 '+user.name">管理</button>
      </div>
    </div>
  </section>
</template>
<script setup>
import {ref,computed,watch,onUnmounted} from 'vue';
import {managementRequest} from '../api';
import {overviewWindow,loadUserUsage} from '../user-overview.js';
const props=defineProps({users:{type:Array,default:()=>[]},refreshKey:Number});
const emit=defineEmits(['manage','auth-error']);
const periods=[{value:'today',label:'今日'},{value:'week',label:'近7天'},{value:'month',label:'本月'}];
const period=ref('month'),window=ref(overviewWindow('month')),values=ref({}),loading=ref(false),updated=ref('');
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
  const current=++generation;window.value=overviewWindow(period.value);values.value={};updated.value='';loading.value=true;
  try{
    const result=await loadUserUsage(props.users,window.value,managementRequest);
    if(current===generation){values.value=result;updated.value=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'});}
  }catch(error){if(current===generation)emit('auth-error',error);}
  finally{if(current===generation)loading.value=false;}
}
watch(()=>[props.users.map(u=>u.user_id).join(','),props.refreshKey,period.value],load,{immediate:true});
onUnmounted(()=>{generation++;});
</script>
<style scoped>
h2{font-size:18px;margin:0}.toolbar,.list-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:24px 0 18px}.toolbar p,.list-heading span{font-size:12px;color:var(--text-secondary,#718096);margin:7px 0 0}.periods{display:flex;gap:4px;background:#8795aa15;padding:4px;border-radius:10px}button{font:inherit;border:0;cursor:pointer;border-radius:7px;padding:9px 14px;white-space:nowrap}.periods button{background:transparent;color:inherit}.periods button[aria-pressed=true]{background:var(--bg-card,white);color:#2563eb;box-shadow:0 1px 5px #0001}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.metrics>div{background:var(--bg-card,white);border:1px solid #8795aa30;border-radius:14px;padding:20px;display:grid;gap:10px}.metrics span{font-size:13px;color:var(--text-secondary,#718096)}.metrics strong{font-size:30px;line-height:1.2}.metrics small{font-size:12px;font-weight:normal;color:var(--text-secondary,#718096)}.user-list{margin-top:24px;background:var(--bg-card,white);border:1px solid #8795aa30;border-radius:14px;padding:0 20px}.list-heading{margin:20px 0}.user-row{display:grid;grid-template-columns:minmax(140px,1fr) minmax(160px,1.3fr) auto;gap:24px;align-items:center;padding:20px 0;border-top:1px solid #8795aa25}.identity strong{overflow-wrap:anywhere}.identity>div{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:9px}.identity small,.usage small{font-size:12px;color:var(--text-secondary,#718096)}.badge{font-size:11px;background:#10b98118;color:#059669;border-radius:5px;padding:3px 7px}.badge.off{background:#8795aa20;color:var(--text-secondary,#718096)}.usage>div{display:flex;justify-content:space-between;gap:8px;font-size:14px;margin-bottom:6px}progress{display:block;width:100%;height:8px;appearance:none;border:0;border-radius:8px;overflow:hidden;background:#8795aa20}progress::-webkit-progress-bar{background:#8795aa20}progress::-webkit-progress-value{background:#3b82f6;border-radius:8px}progress::-moz-progress-bar{background:#3b82f6}.manage{background:#2563eb12;color:#2563eb}.empty{padding-bottom:20px}.warning{color:#c2410c;font-size:13px}@media(max-width:600px){.toolbar{flex-wrap:wrap}.metrics{gap:8px}.metrics>div{padding:12px}.metrics strong{font-size:24px}.user-row{grid-template-columns:1fr auto;gap:14px}.usage{grid-column:1/-1;grid-row:2}.manage{grid-column:2;grid-row:1}.list-heading span{display:none}.user-list{padding:0 14px}}
</style>
