<template>
  <section class="timeline" aria-label="各用户用量时间折线图" :aria-busy="loading">
    <div class="heading"><div><h2>用量随时间变化</h2><p>每个时间段的已记录用量 · 北京时间</p></div>
      <div class="controls"><label>粒度<select v-model="interval"><option v-for="item in intervals" :key="item.value" :value="item.value" :disabled="!allowed(item.value)">{{item.label}}</option></select></label>
        <label>用量<select v-model="metric"><option value="total">上传＋下载</option><option value="upload">上传</option><option value="download">下载</option></select></label></div></div>
    <div class="legend" aria-label="显示用户"><button v-for="s in grid.series" :key="s.user_id" :aria-pressed="!hidden.includes(s.user_id)" @click="toggle(s.user_id)"><i :style="{background:s.color}"></i>{{s.name}}</button></div>
    <p v-if="loading" class="state" role="status">正在读取用量记录…</p>
    <p v-else-if="error" class="state error" role="alert">{{error}} <button @click="load">重试</button></p>
    <p v-else-if="!data?.rows.length" class="state">该时段暂无用量记录</p>
    <div v-show="!loading && !error && data?.rows.length" class="plot"><canvas ref="canvas" role="img" :aria-label="'各用户每'+unit+'用量折线图，下方可选择时间查看详细数值'"></canvas></div>
    <p class="note">{{interval==='day'?'按日汇总已记录用量。':'原始采样约 60 秒，每 5 分钟批量上报；按采样时间归入当前时段。'}} 空缺不补零；点击用户名可隐藏或显示曲线。</p>
    <template v-if="!loading && !error && data?.rows.length">
      <div class="point-heading"><div><strong>{{selectedLabel}}</strong><small>{{unit}}内已记录用量 · {{metricLabel}}</small></div><div class="stepper"><button aria-label="上一个时间点" :disabled="selected<=0" @click="selected--">←</button><button aria-label="下一个时间点" :disabled="selected>=grid.times.length-1" @click="selected++">→</button></div></div>
      <input class="scrubber" type="range" v-model.number="selected" min="0" :max="Math.max(0,grid.times.length-1)" :aria-valuetext="selectedLabel" aria-label="查看时间点" />
      <div class="table-scroll"><table><thead><tr><th>用户</th><th>上传</th><th>下载</th><th>合计</th><th>采样 / 机器</th><th>实际采样时间</th></tr></thead><tbody><tr v-for="s in shown" :key="s.user_id"><th><i :style="{background:s.color}"></i>{{s.name}}</th><td :title="record(s)?record(s).upload.toLocaleString('zh-CN')+' 字节':''">{{bytes(record(s)?.upload)}}</td><td :title="record(s)?record(s).download.toLocaleString('zh-CN')+' 字节':''">{{bytes(record(s)?.download)}}</td><td>{{record(s)?bytes(record(s).upload+record(s).download):'暂无记录'}}<small v-if="record(s)" class="exact">{{(record(s).upload+record(s).download).toLocaleString('zh-CN')}} B</small></td><td>{{record(s)?record(s).samples+' / '+record(s).hosts:'—'}}</td><td>{{record(s)?sampleTime(record(s)):'—'}}</td></tr></tbody></table></div>
      <p class="note">数值为采样区间的流量增量，不是瞬时网速。缺少部分机器时仅展示收到的记录。</p>
    </template>
  </section>
</template>
<script setup>
import {ref,computed,watch,onUnmounted,nextTick} from 'vue';
import {Chart,LineController,LineElement,PointElement,LinearScale,Tooltip} from 'chart.js';
import {managementRequest} from '../api';
import {seriesGrid,bytes,clock} from '../usage-series.js';
Chart.register(LineController,LineElement,PointElement,LinearScale,Tooltip);
const props=defineProps({users:{type:Array,default:()=>[]},window:{type:Object,required:true},refreshKey:Number});
const emit=defineEmits(['auth-error']);
const intervals=[{value:'minute',label:'1 分钟'},{value:'hour',label:'1 小时'},{value:'day',label:'1 天'}];
const interval=ref('minute'),metric=ref('total'),data=ref(null),loading=ref(false),error=ref(''),hidden=ref([]),selected=ref(0),canvas=ref(null);
let chart=null,generation=0;
const unit=computed(()=>({minute:'分钟',hour:'小时',day:'日'}[interval.value]));
const metricLabel=computed(()=>({total:'上传＋下载',upload:'上传',download:'下载'}[metric.value]));
const grid=computed(()=>data.value?seriesGrid(data.value,props.users):{times:[],series:props.users.map((u,i)=>({...u,color:['#2563eb','#d97706','#8b5cf6'][i%3],records:[]}))});
const shown=computed(()=>grid.value.series.filter(s=>!hidden.value.includes(s.user_id)));
const selectedLabel=computed(()=>grid.value.times.length?clock(grid.value.times[selected.value],interval.value==='day')+' — '+clock(grid.value.times[selected.value]+data.value.step_ms,interval.value==='day')+(grid.value.times[selected.value]+data.value.step_ms>data.value.end?'（进行中）':''):'');
function allowed(value){const start=Date.parse(props.window.from+'T00:00:00+08:00'),days=(Date.parse(props.window.to+'T00:00:00+08:00')-start)/86400000+1;return value==='day'||(start>=Date.now()-35*86400000&&days<=(value==='minute'?2:35));}
function toggle(id){hidden.value=hidden.value.includes(id)?hidden.value.filter(v=>v!==id):[...hidden.value,id];}
function record(s){return s.records[selected.value];}
function sampleTime(r){const fmt=at=>new Date(at+28800000).toISOString().slice(5,19).replace('T',' ');return fmt(r.first_at)+(r.first_at===r.last_at?'':' – '+fmt(r.last_at));}
function amount(r){return r?(metric.value==='total'?r.upload+r.download:r[metric.value]):null;}
async function load(){
  const current=++generation;loading.value=true;error.value='';data.value=null;chart?.destroy();chart=null;
  try{const result=await managementRequest('post','/history-series',{...props.window,interval:interval.value});
    if(current!==generation)return;data.value=result;
    const last=Math.max(result.start,...result.rows.map(r=>r.at));selected.value=Math.max(0,Math.min(Math.floor((last-result.start)/result.step_ms),Math.ceil((result.end-result.start)/result.step_ms)-1));
  }catch(e){if(current!==generation)return;
    if([401,403].includes(e.status)){data.value=null;emit('auth-error',e);}
    else error.value=e.message==='series_raw_window_limit'?'该时段已超出细粒度查询范围，请切换按日查看。':e.status===413?'数据点过多，请缩短时段或改用更粗的粒度。':'用量读取失败，请重试。';
  }finally{if(current===generation){loading.value=false;await nextTick();render();}}
}
function render(){
  chart?.destroy();chart=null;
  if(!canvas.value||loading.value||error.value||!data.value?.rows.length)return;
  const d=data.value, duration=d.end-d.start;
  const tick=[300000,900000,1800000,3600000,10800000,21600000,86400000,604800000,2592000000].find(t=>t>=duration/7)||2592000000;
  chart=new Chart(canvas.value,{type:'line',data:{datasets:shown.value.map(s=>({label:s.name,borderColor:s.color,backgroundColor:s.color,borderWidth:1.7,pointRadius:grid.value.times.length>100?0:2,pointHoverRadius:4,tension:0,spanGaps:false,
    data:grid.value.times.map((x,i)=>({x,y:amount(s.records[i])}))}))},options:{responsive:true,maintainAspectRatio:false,animation:false,normalized:true,
    interaction:{mode:'index',intersect:false},onHover:(_event,items)=>{if(items.length)selected.value=items[0].index;},
    scales:{x:{type:'linear',min:d.start,max:Math.max(d.start+d.step_ms,d.end),grid:{display:false},afterBuildTicks:axis=>{axis.ticks=[];for(let at=d.start;at<=d.end;at+=tick)axis.ticks.push({value:at});},ticks:{maxRotation:0,autoSkip:true,callback:v=>interval.value==='day'?clock(v,true):duration<=86400000?clock(v).slice(6):clock(v).split(' ')}},
      y:{beginAtZero:true,title:{display:true,text:'每'+unit.value+'用量'},ticks:{callback:v=>bytes(v)},grid:{color:'#8795aa20'}}},
    plugins:{tooltip:{callbacks:{title:items=>items.length?clock(items[0].parsed.x,interval.value==='day'):'',label:c=>c.dataset.label+'：'+bytes(c.parsed.y)}}}}});
}
watch(()=>[props.window.from,props.window.to,props.refreshKey,props.users.map(u=>u.user_id).join(',')],()=>{
  const next=allowed('minute')?'minute':allowed('hour')?'hour':'day';
  if(interval.value!==next)interval.value=next;else load();
},{immediate:true});
watch(interval,load);
watch([metric,hidden,()=>props.users.map(u=>u.name).join('\0')],()=>nextTick(render));
onUnmounted(()=>{generation++;chart?.destroy();});
</script>
<style scoped>
.timeline{margin-top:24px;padding:22px;background:var(--bg-card,white);border:1px solid #8795aa30;border-radius:14px}h2{font-size:18px;margin:0}.heading,.point-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.heading p,.note,.point-heading small{font-size:12px;color:var(--text-secondary,#718096);line-height:1.6}.heading p{margin:6px 0 0}.controls{display:flex;gap:12px;flex-wrap:wrap}.controls label{display:flex;align-items:center;gap:6px;font-size:12px}select{padding:7px;border:1px solid #8795aa40;border-radius:7px;background:var(--bg-card,white);color:inherit;font:inherit}button{font:inherit;cursor:pointer;border:1px solid #8795aa30;border-radius:7px;padding:7px 10px;color:inherit;background:transparent}button:disabled{opacity:.4;cursor:default}.legend{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.legend button{font-size:13px;display:flex;align-items:center;gap:7px}.legend button[aria-pressed=false]{opacity:.4;text-decoration:line-through}i{display:inline-block;width:9px;height:9px;border-radius:50%;flex-shrink:0}th i{margin-right:7px}.plot{height:300px;position:relative}.state{padding:60px 12px;text-align:center;color:var(--text-secondary,#718096)}.error{color:#c2410c}.point-heading{border-top:1px solid #8795aa30;padding-top:18px;margin-top:18px;font-size:13px}.point-heading small{display:block;margin-top:4px}.stepper{display:flex;gap:6px}.scrubber{width:100%;margin:14px 0;accent-color:#2563eb}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:right;white-space:nowrap;font-size:12px;font-variant-numeric:tabular-nums}th,td{padding:12px 10px;border-bottom:1px solid #8795aa20}th:first-child{text-align:left;padding-left:0}thead th{font-weight:normal;color:var(--text-secondary,#718096)}tbody th{font-weight:500}.exact{display:block;margin-top:3px;color:var(--text-secondary,#718096);font-size:10px}td:last-child{font-size:11px;color:var(--text-secondary,#718096)}.note{margin:12px 0 0}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #2563eb;outline-offset:3px}@media(max-width:600px){.timeline{padding:14px}.heading{align-items:flex-start;flex-direction:column}.plot{height:260px}.controls{width:100%}.point-heading{align-items:flex-start}.point-heading strong{font-size:12px}}
</style>
