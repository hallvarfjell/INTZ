// INTZ v11.2.1 - IndexedDB session queue/cache.
(() => {
  const DB='intz-store-v2', STORE='sessions';
  const user=()=>localStorage.getItem('active_user')||'default';
  const ns=k=>`u:${user()}:${k}`;
  const readIndex=()=>{try{return JSON.parse(localStorage.getItem(ns('sessions'))||'[]')}catch{return[]}};
  const writeIndex=a=>{localStorage.setItem(ns('sessions'),JSON.stringify(a));dispatchEvent(new CustomEvent('intz:datachange'))};
  const getId=x=>String(x?._local_id||x?.local_id||x?.id||(crypto.randomUUID?.()||`s-${Date.now()}`));
  const summary=s=>{const p=s.points||[],a=p[0]||{},b=p.at(-1)||{},start=s.startedAt||s.started_at||a.iso,end=s.endedAt||s.ended_at||b.iso;return{id:getId(s),_local_id:getId(s),name:s.name||'Økt',startedAt:start,endedAt:end,durationSec:start&&end?(Date.parse(end)-Date.parse(start))/1000:0,distanceM:Number(s.distanceM??b.dist_m??0),_updated_at:s._updated_at||new Date().toISOString(),_deleted_at:s._deleted_at||null,_sync_status:s._sync_status||'pending',source:s.source||null}};
  function open(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function put(s,status='pending'){const db=await open(),id=getId(s);s={...s,id,_local_id:id,_sync_status:status};await new Promise((ok,no)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put({key:`${user()}:${id}`,user:user(),id,status,session:s});t.oncomplete=ok;t.onerror=()=>no(t.error)});upsertIndex({...summary(s),_sync_status:status});return s}
  async function get(id){const db=await open();return new Promise((ok,no)=>{const r=db.transaction(STORE).objectStore(STORE).get(`${user()}:${id}`);r.onsuccess=()=>ok(r.result?.session||null);r.onerror=()=>no(r.error)})}
  async function remove(id){const db=await open();await new Promise((ok,no)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(`${user()}:${id}`);t.oncomplete=ok;t.onerror=()=>no(t.error)})}
  async function all(){const db=await open();return new Promise((ok,no)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>ok(r.result.filter(x=>x.user===user()));r.onerror=()=>no(r.error)})}
  async function pending(){return(await all()).filter(x=>x.status==='pending'||x.status==='delete')}
  function upsertIndex(x){const a=readIndex(),id=getId(x),i=a.findIndex(y=>getId(y)===id),z={...x,id,_local_id:id};delete z.points;i<0?a.push(z):a[i]={...a[i],...z};a.sort((x,y)=>Date.parse(x.startedAt||0)-Date.parse(y.startedAt||0));writeIndex(a)}
  function replaceIndex(a){writeIndex((a||[]).map(x=>{const z={...x,id:getId(x),_local_id:getId(x)};delete z.points;return z}))}
  function patchIndex(id,p){const a=readIndex(),i=a.findIndex(x=>getId(x)===id);if(i>=0){a[i]={...a[i],...p};writeIndex(a)}}
  function deleteIndex(id){writeIndex(readIndex().filter(x=>getId(x)!==id))}
  async function markSynced(id,keep){const s=await get(id);if(keep&&s)await put({...s,_sync_status:'synced'},'ghost');else await remove(id);patchIndex(id,{_sync_status:'synced'})}
  async function migrateLegacy(){const a=readIndex();for(const x of a)if(x.points?.length)await put(x,x._sync_status==='synced'?'pending':(x._sync_status||'pending'));replaceIndex(a.map(summary))}
  window.INTZSessionStore={put,get,remove,all,pending,markSynced,summary,readIndex,replaceIndex,upsertIndex,patchIndex,deleteIndex,migrateLegacy};
})();
