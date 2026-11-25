// session-store.js - IndexedDB queue/cache and lightweight local session index.
(() => {
  const DB_NAME = 'intz-session-store-v2';
  const DB_VERSION = 1;
  const STORE = 'sessions';
  const activeUser = () => localStorage.getItem('active_user') || 'default';
  const nsKey = key => `u:${activeUser()}:${key}`;
  const readIndex = () => { try { return JSON.parse(localStorage.getItem(nsKey('sessions')) || '[]'); } catch { return []; } };
  const writeIndex = rows => { localStorage.setItem(nsKey('sessions'), JSON.stringify(rows)); window.dispatchEvent(new CustomEvent('intz:datachange')); };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `s${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const localId = s => String(s?._local_id || s?.local_id || s?.id || uuid());
  const summary = session => {
    const points = Array.isArray(session.points) ? session.points : [];
    const last = points[points.length - 1] || {};
    const first = points[0] || {};
    const startedAt = session.startedAt || session.started_at || (first.ts ? new Date(first.ts).toISOString() : null);
    const endedAt = session.endedAt || session.ended_at || (last.ts ? new Date(last.ts).toISOString() : null);
    const durationSec = startedAt && endedAt ? Math.max(0, (Date.parse(endedAt)-Date.parse(startedAt))/1000) : 0;
    const distanceM = Number(session.distanceM ?? session.distance_m ?? last.dist ?? last.distanceM ?? 0);
    return { id: localId(session), _local_id: localId(session), name: session.name || 'Økt', startedAt, endedAt, durationSec, distanceM,
      _updated_at: session._updated_at || new Date().toISOString(), _deleted_at: session._deleted_at || null,
      _sync_status: session._sync_status || 'pending', source: session.source || null };
  };
  function openDb(){ return new Promise((resolve,reject)=>{ const r=indexedDB.open(DB_NAME,DB_VERSION); r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains(STORE)){ const st=db.createObjectStore(STORE,{keyPath:'key'}); st.createIndex('user','user'); st.createIndex('status','status'); } }; r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  async function tx(mode, fn){ const db=await openDb(); return new Promise((resolve,reject)=>{ const t=db.transaction(STORE,mode); const st=t.objectStore(STORE); let result; try { result=fn(st); } catch(e){ reject(e); return; } t.oncomplete=()=>resolve(result); t.onerror=()=>reject(t.error); }); }
  async function put(session,status='pending'){ const id=localId(session); const full={...session,id,_local_id:id,_sync_status:status}; await tx('readwrite',st=>st.put({key:`${activeUser()}:${id}`,user:activeUser(),id,status,session:full,updatedAt:Date.now()})); upsertIndex({...summary(full),_sync_status:status}); return full; }
  async function get(id){ const db=await openDb(); return new Promise((resolve,reject)=>{ const r=db.transaction(STORE).objectStore(STORE).get(`${activeUser()}:${id}`); r.onsuccess=()=>resolve(r.result?.session || null); r.onerror=()=>reject(r.error); }); }
  async function remove(id){ await tx('readwrite',st=>st.delete(`${activeUser()}:${id}`)); }
  async function all(){ const db=await openDb(); return new Promise((resolve,reject)=>{ const r=db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess=()=>resolve(r.result.filter(x=>x.user===activeUser())); r.onerror=()=>reject(r.error); }); }
  async function pending(){ return (await all()).filter(x=>x.status==='pending' || x.status==='delete'); }
  async function markSynced(id, keep=false){ const s=await get(id); if(s && keep) await put({...s,_sync_status:'synced'},'ghost'); else await remove(id); patchIndex(id,{_sync_status:'synced'}); }
  function upsertIndex(row){ const rows=readIndex(); const id=localId(row); const i=rows.findIndex(x=>localId(x)===id); const clean={...row,id,_local_id:id}; delete clean.points; if(i>=0) rows[i]={...rows[i],...clean}; else rows.push(clean); rows.sort((a,b)=>Date.parse(a.startedAt||0)-Date.parse(b.startedAt||0)); writeIndex(rows); }
  function replaceIndex(rows){ writeIndex((rows||[]).map(r=>{const x={...r,id:localId(r),_local_id:localId(r)}; delete x.points; return x;})); }
  function patchIndex(id,patch){ const rows=readIndex(), i=rows.findIndex(x=>localId(x)===id); if(i>=0){ rows[i]={...rows[i],...patch}; writeIndex(rows); } }
  function deleteIndex(id){ writeIndex(readIndex().filter(x=>localId(x)!==id)); }
  async function migrateLegacy(){ const rows=readIndex(); for(const row of rows){ if(Array.isArray(row.points) && row.points.length){ await put(row,row._sync_status==='synced'?'pending':(row._sync_status||'pending')); } } replaceIndex(rows.map(summary)); }
  window.INTZSessionStore={put,get,remove,all,pending,markSynced,summary,readIndex,replaceIndex,upsertIndex,patchIndex,deleteIndex,migrateLegacy,localId};
})();
