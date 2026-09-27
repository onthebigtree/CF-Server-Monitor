// Server snapshots and local drafts have separate revisions. Refresh never rebases
// unsaved edits onto a newer revision; conflicts must be resolved explicitly.
const clone=value=>JSON.parse(JSON.stringify(value));
export const isDraftDirty=row=>JSON.stringify(row._draftKeys.map(k=>row[k]))!==JSON.stringify(row._draftKeys.map(k=>row._baseDraft[k]));
export function mergeDraftRows(previous, records, key, makeDraft, revision, resetId=null) {
  const old=new Map(previous.map(row=>[row[key],row]));
  return records.map(record=>{
    const drafts=makeDraft(record),before=old.get(record[key]);
    const next={...record,...drafts,_draftKeys:Object.keys(drafts),_baseDraft:clone(drafts),_latestDraft:clone(drafts),_editRevision:revision(record),_latestRevision:revision(record)};
    if(before && record[key]!==resetId && isDraftDirty(before)) {
      for(const field of next._draftKeys) next[field]=clone(before[field]);
      next._baseDraft=before._baseDraft;next._editRevision=before._editRevision;
    }
    return next;
  });
}
export function discardDraft(row) {
  for(const key of row._draftKeys) row[key]=clone(row._latestDraft[key]);
  row._baseDraft=clone(row._latestDraft);row._editRevision=row._latestRevision;
}
export function disabledUserStatus(user) {
  if(user.enabled)return '';
  return user.hosts.some(h=>h.status==='pending')?'禁用待节点同步':'已阻止新连接；已有连接可能继续。';
}
