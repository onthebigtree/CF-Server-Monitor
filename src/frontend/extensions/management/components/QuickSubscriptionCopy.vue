<template>
  <div ref="root" class="quick-copy" @keydown.esc.stop="close(true)">
    <button ref="trigger" type="button" class="copy-trigger" :disabled="disabled" :aria-expanded="open" :aria-controls="'copy-'+userId" @click="toggle">复制订阅</button>
    <div v-if="open" :id="'copy-'+userId" class="copy-panel" :aria-busy="loading">
      <p class="copy-title">复制个人订阅</p>
      <p v-if="loading" role="status">读取链接中…</p>
      <template v-else-if="links">
        <div class="formats"><button type="button" @click="copy('mihomo')">Clash / Mihomo</button><button type="button" @click="copy('shadowrocket')">Shadowrocket</button></div>
      </template>
      <p v-if="message" role="status">{{message}}</p>
      <label v-if="manual">长按选择并复制<input readonly :value="manual" aria-label="手动复制订阅链接" @focus="$event.target.select()" /></label>
      <button v-if="!loading && !links" type="button" @click="load">重试</button>
      <button class="close" type="button" @click="close(true)">关闭</button>
    </div>
  </div>
</template>
<script setup>
import {ref,onMounted,onUnmounted,watch} from 'vue';
import {managementRequest} from '../api';
import {copySubscription} from '../clipboard.js';
const props=defineProps({userId:{type:String,required:true},disabled:Boolean});
const emit=defineEmits(['auth-error']);
const root=ref(null),trigger=ref(null),open=ref(false),loading=ref(false),links=ref(null),message=ref(''),manual=ref('');
let generation=0;
function close(focus=false){generation++;open.value=false;links.value=null;manual.value='';message.value='';loading.value=false;if(focus)trigger.value?.focus();}
async function load(){
 const current=++generation;loading.value=true;message.value='';links.value=null;manual.value='';
 try{const data=await managementRequest('post','/users/'+props.userId+'/subscription',{reset:false});if(current===generation)links.value=data;}
 catch(e){if(current!==generation)return;if([401,403].includes(e.status)){close();emit('auth-error',e);}else message.value='链接读取失败，请重试。';}
 finally{if(current===generation)loading.value=false;}
}
function toggle(){if(open.value)close();else{open.value=true;load();}}
async function copy(format){
 const current=generation,text=links.value?.[format];
 const ok=await copySubscription(text,root.value);
 if(current!==generation)return;
 message.value=ok?'已复制 '+(format==='mihomo'?'Clash / Mihomo':'Shadowrocket')+' 订阅':'自动复制失败，请长按下方链接复制。';
 manual.value=ok?'':text||'';
}
function outside(e){if(open.value&&!root.value?.contains(e.target))close();}
watch(()=>[props.userId,props.disabled],()=>close());
onMounted(()=>{document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);});
onUnmounted(()=>{generation++;document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);});
</script>
<style scoped>
.quick-copy{position:relative;min-width:0}.quick-copy button{font:inherit;border:0;border-radius:8px;padding:10px 12px;cursor:pointer;min-height:44px}.copy-trigger{color:#2563eb;background:#2563eb12;white-space:nowrap;width:100%}.quick-copy button:disabled{opacity:.45;cursor:default}.quick-copy button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}.copy-panel{position:absolute;right:0;top:calc(100% + 8px);width:280px;max-width:calc(100vw - 56px);z-index:20;padding:14px;border:1px solid #8795aa40;border-radius:12px;background:var(--bg-card,white);box-shadow:0 10px 35px #0002;color:var(--text-primary,#263449);text-align:left;font-size:13px}.copy-panel p{margin:0 0 10px;line-height:1.5}.copy-title{font-weight:600}.formats{display:grid;gap:8px;margin-bottom:10px}.formats button{background:#2563eb;color:white}.close{background:#8795aa12;color:inherit;width:100%}.copy-panel label{display:grid;gap:8px;margin-bottom:10px}.copy-panel input{min-width:0;width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #8795aa50;border-radius:6px;background:transparent;color:inherit}@media(max-width:700px){.copy-panel{right:50%;transform:translateX(50%)}.quick-copy button{font-size:12px;padding:10px 8px}}
</style>
