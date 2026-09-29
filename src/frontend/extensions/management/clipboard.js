// Called from a fresh click after the link has loaded (including mobile Safari).
export async function copySubscription(text,container=null,platform=globalThis) {
  const {navigator,document}=platform;
  if(typeof text!=='string'||!text)return false;
  try {
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}
  } catch {}
  const active=document.activeElement;
  const field=document.createElement('textarea');
  field.value=text;field.readOnly=true;
  field.style.cssText='position:fixed;opacity:0;left:0;top:0;font-size:16px';
  // A modal dialog makes elements outside it inert.
  (container||document.querySelector('dialog[open]')||document.body).appendChild(field);
  try {field.focus();field.select();field.setSelectionRange(0,text.length);return document.execCommand('copy')===true;}
  catch {return false;}
  finally {field.value='';field.remove();active?.focus?.({preventScroll:true});}
}
