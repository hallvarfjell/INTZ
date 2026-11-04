// settings-core.js
// INTZ v10.1 – Settings logic moved from settings.html into SPA


function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
function nsKey(k){ return 'u:'+activeUser()+':'+k; }
function getNS(k, d){ try{ const v=localStorage.getItem(nsKey(k)); if(v!=null) return JSON.parse(v); const ov=localStorage.getItem(k); return ov!=null? JSON.parse(ov): d; }catch(e){ return d; } }
function setNS(k, v){ localStorage.setItem(nsKey(k), JSON.stringify(v)); }
(function(){
  const s=id=>document.getElementById(id);
  function users(){ try{ return JSON.parse(localStorage.getItem('users_list')||'[]'); }catch(e){ return []; } }
  function saveUsers(arr){ localStorage.setItem('users_list', JSON.stringify(arr)); }
  function setActive(u){ localStorage.setItem('active_user', u); alert('Aktiv bruker: '+u+'\nLaster siden på nytt for å bruke riktig profil.'); location.reload(); }
  function renderUsers(){ const panel=document.getElementById('users-panel'); const list=users(); const active=activeUser(); panel.innerHTML=''; const wrap=document.createElement('div'); wrap.style.display='grid'; wrap.style.gap='8px'; const header=document.createElement('div'); header.innerHTML = `<div class='small'>Aktiv bruker: <strong>${active}</strong></div>`; wrap.appendChild(header); list.forEach(u=>{ const row=document.createElement('div'); row.className='menu-item'; row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; const left=document.createElement('div'); left.textContent=u + (u===active? ' (aktiv)':''); const btns=document.createElement('div'); btns.style.display='flex'; btns.style.gap='6px'; const act=document.createElement('button'); act.className='secondary'; act.textContent='Bruk'; act.onclick=()=> setActive(u); const ren=document.createElement('button'); ren.className='ghost'; ren.textContent='Gi nytt navn'; ren.onclick=()=>{ const nu=prompt('Nytt navn for bruker', u); if(nu && nu!==u){ const arr=users(); const i=arr.indexOf(u); if(i>=0){ arr[i]=nu; saveUsers(arr); const migrate=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k.startsWith('u:'+u+':')) migrate.push(k); } migrate.forEach(oldK=>{ const v=localStorage.getItem(oldK); const nk = 'u:'+nu+':'+oldK.split(':').slice(2).join(':'); localStorage.setItem(nk, v); localStorage.removeItem(oldK); }); if(activeUser()===u) setActive(nu); else renderUsers(); } } }; const del=document.createElement('button'); del.className='ghost'; del.textContent='Slett'; del.onclick=()=>{ if(!confirm('Slette bruker "'+u+'"? Dette påvirker ikke andre brukere.')) return; const arr=users().filter(x=>x!==u); saveUsers(arr); const delKeys=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k.startsWith('u:'+u+':')) delKeys.push(k); } delKeys.forEach(k=>localStorage.removeItem(k)); if(activeUser()===u) setActive('default'); else renderUsers(); }; btns.appendChild(act); btns.appendChild(ren); btns.appendChild(del); row.appendChild(left); row.appendChild(btns); wrap.appendChild(row); }); const add=document.createElement('button'); add.className='secondary'; add.innerHTML='<i class="ph-user-plus"></i> Legg til bruker'; add.onclick=()=>{ const u=prompt('Navn på ny bruker'); if(!u) return; const arr=users(); if(arr.includes(u)){ alert('Brukernavn finnes allerede.'); return; } arr.push(u); saveUsers(arr); setActive(u); }; wrap.appendChild(add); panel.appendChild(wrap); }
  if(users().length===0){ saveUsers(['default']); if(!localStorage.getItem('active_user')) localStorage.setItem('active_user','default'); }
  renderUsers();
  const gNS=(k,d)=>getNS(k,d), setNSf=(k,v)=>setNS(k,v);
  s('s-mass').value=gNS('massKg',75); s('s-lt1').value=gNS('LT1',135); s('s-lt2').value=gNS('LT2',160); s('s-cal-k').value=gNS('calK',1.0); s('s-c-run').value=gNS('cRun',1.0); s('s-default-hr').checked=gNS('defHR',true); s('s-default-watt').checked=gNS('defWatt',true); s('s-default-speed').checked=gNS('defSpeed',false); s('s-default-rpe').checked=gNS('defRPE',true);
  s('s-save').onclick=()=>{ setNSf('massKg', Number(s('s-mass').value||75)); setNSf('LT1', Number(s('s-lt1').value||135)); setNSf('LT2', Number(s('s-lt2').value||160)); setNSf('calK', Number(s('s-cal-k').value||1.0)); setNSf('cRun', Number(s('s-c-run').value||1.0)); setNSf('defHR', !!s('s-default-hr').checked); setNSf('defWatt', !!s('s-default-watt').checked); setNSf('defSpeed', !!s('s-default-speed').checked); setNSf('defRPE', !!s('s-default-rpe').checked); alert('Lagret'); };
})();

  // --- Eksport/Import av hele localStorage (INTZ) ---
function buildBackup(){
  const dump = { meta:{ app:'INTZ', exportedAt:new Date().toISOString() }, localStorage:{} };
  for (let i=0; i<localStorage.length; i++){
    const k = localStorage.key(i);
    dump.localStorage[k] = localStorage.getItem(k);
  }
  return dump;
}
function downloadJSON(name, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
document.getElementById('backup-export')?.addEventListener('click', ()=>{
  const bk = buildBackup();
  const ts = new Date();
  const name = `INTZ_backup_${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}.json`;
  downloadJSON(name, bk);
});
document.getElementById('backup-import')?.addEventListener('click', ()=> document.getElementById('backup-file').click());
document.getElementById('backup-file')?.addEventListener('change', (ev)=>{
  const f = ev.target.files && ev.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if(!obj || !obj.localStorage){ alert('Ugyldig backupfil.'); return; }
      if(!confirm('Import erstatter hele INTZ-lagringen i denne nettleseren. Fortsette?')) return;
      localStorage.clear();
      for (const k of Object.keys(obj.localStorage)) localStorage.setItem(k, obj.localStorage[k]);
      alert('Import fullført. Siden lastes på nytt.'); location.reload();
    }catch(e){ alert('Import feilet: '+e.message); }
  };
  reader.readAsText(f);
});
  

// INTZ_v10_1_axis: persist/load axis locks
(function(){
  const s=id=>document.getElementById(id);
  function activeUser(){ return localStorage.getItem('active_user') || 'default'; }
  function nsKey(k){ return 'u:'+activeUser()+':'+k; }
  function getNS(k, d){ try{ const v=localStorage.getItem(nsKey(k)); return v!=null? JSON.parse(v): d; }catch(e){ return d; } }
  function setNS(k, v){ localStorage.setItem(nsKey(k), JSON.stringify(v)); }
  if(s('s-hr-lock')){
    s('s-hr-lock').checked=getNS('hrLock',false);
    s('s-hr-min').value=getNS('hrMin',80);
    s('s-hr-max').value=getNS('hrMax',200);
    s('s-w-lock').checked=getNS('wLock',false);
    s('s-w-min').value=getNS('wMin',0);
    s('s-w-max').value=getNS('wMax',400);
    s('s-s-lock').checked=getNS('sLock',false);
    s('s-s-min').value=getNS('sMin',0);
    s('s-s-max').value=getNS('sMax',20);
    s('s-r-lock').checked=getNS('rpeLock',false);
    s('s-r-min').value=getNS('rpeMin',0);
    s('s-r-max').value=getNS('rpeMax',10);
    const btn=document.getElementById('s-save');
    if(btn && !btn._axes){ btn._axes=true; btn.addEventListener('click', ()=>{
      setNS('hrLock', !!s('s-hr-lock').checked); setNS('hrMin', Number(s('s-hr-min').value||80)); setNS('hrMax', Number(s('s-hr-max').value||200));
      setNS('wLock', !!s('s-w-lock').checked); setNS('wMin', Number(s('s-w-min').value||0)); setNS('wMax', Number(s('s-w-max').value||400));
      setNS('sLock', !!s('s-s-lock').checked); setNS('sMin', Number(s('s-s-min').value||0)); setNS('sMax', Number(s('s-s-max').value||20));
      setNS('rpeLock', !!s('s-r-lock').checked); setNS('rpeMin', Number(s('s-r-min').value||0)); setNS('rpeMax', Number(s('s-r-max').value||10));
    }); }
  }
})();

