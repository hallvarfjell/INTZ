// results.js - INTZ v11.2 historical session view.
let SESSION = null;

const activeUser = () => localStorage.getItem('active_user') || 'default';
const nsKey = key => `u:${activeUser()}:${key}`;
function getNS(key, fallback) {
  try { const v = localStorage.getItem(nsKey(key)); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function routeId() {
  const route = window.INTZRoute || window.INTZRouter?.parseHash?.();
  if (route?.view === 'results' && route.arg) return route.arg;
  return location.hash.startsWith('#results:') ? decodeURIComponent(location.hash.slice(9)) : null;
}
async function pickSession() {
  const id = routeId();
  const rows = (getNS('sessions', []) || []).filter(x => x && !x._deleted_at);
  const row = id ? rows.find(x => x.id === id || x._local_id === id) : rows.at(-1);
  if (!row) return null;
  if (Array.isArray(row.points) && row.points.length) return row;
  if (!window.INTZCloud?.getSession) throw new Error('Skylagringsmodulen er ikke tilgjengelig.');
  return window.INTZCloud.getSession(row._local_id || row.id);
}
const average = values => values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
function pointTime(point) {
  const n = Number(point?.ts);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(point?.iso || '');
  return Number.isFinite(parsed) ? parsed : null;
}
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
function metrics(session) {
  const points = session.points || [];
  const timed = points.map(p => ({...p, _t: pointTime(p)})).filter(p => p._t != null);
  const first = timed[0], last = timed.at(-1);
  const duration = first && last ? Math.max(0, (last._t-first._t)/1000) : Math.max(0,(Date.parse(session.endedAt)-Date.parse(session.startedAt))/1000);
  const hrs = points.map(p => Number(p.hr)).filter(v => v > 0);
  const watts = points.map(p => Number(p.watt)).filter(v => v > 0);
  const lastDistance = [...points].reverse().find(p => Number.isFinite(Number(p.dist_m)))?.dist_m || session.distanceM || 0;
  const lthr = Number(session.lt2) || 160;
  let tss = Number(session.tss ?? session.metrics?.tss);
  if (!Number.isFinite(tss)) {
    tss = 0;
    for (let i=1;i<timed.length;i++) {
      const dt = Math.max(0, Math.min(10,(timed[i]._t-timed[i-1]._t)/1000));
      const hr = Number(timed[i].hr);
      if (hr > 0 && lthr > 0) tss += (dt/3600) * Math.pow(hr/lthr,2) * 100;
    }
  }
  return {duration,distanceKm:Number(lastDistance)/1000,averageHr:average(hrs),maximumHr:hrs.length?Math.max(...hrs):null,averageWatt:average(watts),tss};
}
function renderSummary(session) {
  const m = metrics(session), target = document.getElementById('summary'); if (!target) return;
  target.innerHTML = `<div><strong>${session.name || 'Økt'}</strong></div>
    <div>Varighet: ${formatDuration(m.duration)}</div><div>Distanse: ${m.distanceKm.toFixed(2)} km</div>
    <div>Snittpuls: ${m.averageHr == null ? '–' : Math.round(m.averageHr)+' bpm'}</div>
    <div>Makspuls: ${m.maximumHr == null ? '–' : Math.round(m.maximumHr)+' bpm'}</div>
    <div>Snittwatt: ${m.averageWatt == null ? '–' : Math.round(m.averageWatt)+' W'}</div>
    <div>TSS: ${Number.isFinite(m.tss) ? m.tss.toFixed(1) : '–'}</div>`;
}
function zoneData(session) {
  const lt1=Number(session.lt1)||135, lt2=Number(session.lt2)||160, totals=[0,0,0,0,0], pts=(session.points||[]).map(p=>({...p,_t:pointTime(p)})).filter(p=>p._t!=null);
  for(let i=1;i<pts.length;i++){const dt=Math.max(0,Math.min(10,(pts[i]._t-pts[i-1]._t)/1000)),hr=Number(pts[i].hr);if(!(hr>0))continue;totals[hr<.85*lt1?0:hr<lt1?1:hr<lt2?2:hr<1.05*lt2?3:4]+=dt;}
  return {totals,labels:[`Z1 < ${Math.round(.85*lt1)}`,`Z2 ${Math.round(.85*lt1)}–${lt1-1}`,`Z3 ${lt1}–${lt2-1}`,`Z4 ${lt2}–${Math.round(1.05*lt2)-1}`,`Z5 ≥ ${Math.round(1.05*lt2)}`],colors:['#94a3b8','#60a5fa','#4ade80','#facc15','#f87171']};
}
function renderZones(session){const c=document.getElementById('zones'),ctx=c?.getContext('2d');if(!ctx)return;const dpr=devicePixelRatio||1,w=c.clientWidth||420,h=220;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);const {totals,labels,colors}=zoneData(session),total=totals.reduce((a,b)=>a+b,0)||1;ctx.clearRect(0,0,w,h);for(let i=0;i<5;i++){const y=10+i*41,bw=Math.max(0,(w-155)*totals[i]/total);ctx.fillStyle=colors[i];ctx.fillRect(105,y,bw,26);ctx.fillStyle='#0f172a';ctx.font='12px system-ui';ctx.fillText(labels[i],5,y+18);ctx.fillText(`${formatDuration(totals[i])}  ${Math.round(totals[i]/total*100)} %`,110+bw,y+18);}}
function dragGroups(session){const p=session.points||[];if(p.some(x=>x.phase==='work')){const m=new Map;for(const x of p)if(x.phase==='work'){const n=Number(x.rep)||1;if(!m.has(n))m.set(n,[]);m.get(n).push(x);}return[...m].map(([n,points])=>({n,points}));}if(session.laps?.length)return session.laps.map((l,i)=>({n:i+1,points:p.slice(Number(l.fromPoint)||0,(l.toPoint==null?p.length-1:Number(l.toPoint))+1),lap:l}));const m=new Map;for(const x of p){const n=Number(x.rep)||0;if(n){if(!m.has(n))m.set(n,[]);m.get(n).push(x);}}return[...m].map(([n,points])=>({n,points}));}
function renderDrags(session){const table=document.getElementById('laps');if(!table)return;const groups=dragGroups(session).filter(g=>g.points.length);if(!groups.length){table.innerHTML='<tbody><tr><td>Ingen drag eller runder registrert.</td></tr></tbody>';return;}table.innerHTML='<thead><tr><th>Drag</th><th>Varighet</th><th>Fart</th><th>Stigning</th><th>Watt</th><th>HR siste 20 s</th><th>Slope siste min.</th></tr></thead><tbody>'+groups.map(({n,points,lap})=>{const timed=points.map(p=>({...p,_t:pointTime(p)})).filter(p=>p._t!=null),end=timed.at(-1)?._t,duration=Number(lap?.totalTimeSeconds) || (timed.length>1?(end-timed[0]._t)/1000:0),speed=average(points.map(p=>Number(p.speed_ms)*3.6).filter(v=>v>0)),grade=average(points.map(p=>Number(p.grade)).filter(Number.isFinite)),watt=average(points.map(p=>Number(p.watt)).filter(v=>v>0)),last20=timed.filter(p=>end-p._t<=20000&&Number(p.hr)>0).map(p=>Number(p.hr)),last60=timed.filter(p=>end-p._t<=60000&&Number(p.hr)>0),slope=last60.length>1?(Number(last60.at(-1).hr)-Number(last60[0].hr))/Math.max(1,(last60.at(-1)._t-last60[0]._t)/60000):null;return `<tr><th>${n}</th><td>${formatDuration(duration)}</td><td>${speed==null?'–':speed.toFixed(1)+' km/t'}</td><td>${grade==null?'–':grade.toFixed(1)+' %'}</td><td>${watt==null?'–':Math.round(watt)+' W'}</td><td>${last20.length?Math.round(average(last20))+' bpm':'–'}</td><td>${slope==null?'–':`${slope>=0?'+':''}${slope.toFixed(1)} bpm/min`}</td></tr>`;}).join('')+'</tbody>';}
function niceRange(values,{zero=false,pad=.08}={}){const v=values.filter(Number.isFinite);if(!v.length)return[0,1];let min=zero?0:Math.min(...v),max=Math.max(...v);if(max===min)max=min+1;const span=max-min;return [Math.max(0,min-span*pad),max+span*pad];}
function renderChart(session){const c=document.getElementById('r-chart'),ctx=c?.getContext('2d');if(!ctx)return;const pts=(session.points||[]).map(p=>({...p,_t:pointTime(p)})).filter(p=>p._t!=null);if(pts.length<2)return;const dpr=devicePixelRatio||1,w=Math.max(480,c.clientWidth||700),h=390;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const L=86,R=102,T=30,B=48,pw=w-L-R,ph=h-T-B,t0=pts[0]._t,t1=pts.at(-1)._t,durationMs=Math.max(1,t1-t0),show={hr:document.getElementById('r-show-hr')?.checked,watt:document.getElementById('r-show-watt')?.checked,speed:document.getElementById('r-show-speed')?.checked,rpe:document.getElementById('r-show-rpe')?.checked},hrR=niceRange(pts.map(p=>Number(p.hr)).filter(v=>v>0),{pad:.12}),wR=niceRange(pts.map(p=>Number(p.watt)).filter(v=>v>0),{zero:true,pad:.12}),sR=niceRange(pts.map(p=>Number(p.speed_ms)*3.6).filter(v=>v>0),{zero:true,pad:.12}),rR=[0,10],lt1=Number(session.lt1)||135,lt2=Number(session.lt2)||160;
 const y=(v,r)=>T+ph-(v-r[0])/(r[1]-r[0])*ph, x=t=>L+(t-t0)/durationMs*pw;
 // HR-zone background using the HR scale, clipped to plot. Extra top space is retained by padded hrR.
 ctx.save();ctx.beginPath();ctx.rect(L,T,pw,ph);ctx.clip();const bands=[[hrR[0],lt1,'#dcfce7'],[lt1,lt2,'#fef9c3'],[lt2,hrR[1],'#fee2e2']];for(const[a,b,color]of bands){const top=y(Math.min(hrR[1],b),hrR),bottom=y(Math.max(hrR[0],a),hrR);ctx.fillStyle=color;ctx.fillRect(L,top,pw,Math.max(0,bottom-top));}ctx.restore();
 ctx.font='11px system-ui';ctx.strokeStyle='#cbd5e1';ctx.fillStyle='#334155';for(let i=0;i<=7;i++){const xx=L+i*pw/7,sec=(durationMs/1000)*i;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+ph);ctx.stroke();const label=formatDuration(sec);ctx.fillText(label,xx-ctx.measureText(label).width/2,T+ph+20);}ctx.fillText('Tid',L+pw/2-8,T+ph+40);
 function ticks(range,side,unit,offset=0){for(let i=0;i<=5;i++){const v=range[0]+(range[1]-range[0])*i,yy=y(v,range);ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(L+pw,yy);ctx.stroke();ctx.fillStyle='#334155';const label=(unit==='RPE'?v.toFixed(0):unit==='km/t'?v.toFixed(1):Math.round(v))+(unit?` ${unit}`:'');if(side==='left')ctx.fillText(label,4+offset,yy+4);else ctx.fillText(label,L+pw+8+offset,yy+4);}}
 if(show.hr)ticks(hrR,'left','bpm',0);if(show.rpe)ticks(rR,'left','RPE',44);if(show.watt)ticks(wR,'right','W',0);if(show.speed)ticks(sR,'right','km/t',45);
 function line(field,range,color,convert=v=>v){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();let started=false;for(const p of pts){const v=convert(Number(p[field]));if(!Number.isFinite(v)||(field==='hr'&&v<=0))continue;const xx=x(p._t),yy=y(v,range);started?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);started=true;}ctx.stroke();}
 if(show.hr)line('hr',hrR,'#e11d48');if(show.rpe)line('rpe',rR,'#ca8a04');if(show.watt)line('watt',wR,'#16a34a');if(show.speed)line('speed_ms',sR,'#2563eb',v=>v*3.6);ctx.strokeStyle='#475569';ctx.lineWidth=1;ctx.strokeRect(L,T,pw,ph);
}
async function saveNotes(){const n=document.getElementById('notes');if(!SESSION||!n)return;try{SESSION=await window.INTZCloud.queueSession({...SESSION,notes:n.value||'',_updated_at:new Date().toISOString()});alert('Merknaden er lagret og satt i synkroniseringskø.');}catch(e){alert('Kunne ikke lagre merknaden: '+e.message);}}
function wireButtons(){const tcx=document.getElementById('btn-download-tcx');if(tcx)tcx.onclick=()=>window.INTZTCX?.download?window.INTZTCX.download(SESSION):alert('TCX-modulen er ikke lastet.');const notes=document.getElementById('save-notes');if(notes)notes.onclick=saveNotes;['r-show-hr','r-show-watt','r-show-speed','r-show-rpe'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.dataset.wired){el.dataset.wired='1';el.addEventListener('change',()=>SESSION&&renderChart(SESSION));}});}
async function renderResults(){const empty=document.getElementById('no-session');if(empty){empty.textContent='Henter økt …';empty.classList.remove('hidden');}try{SESSION=await pickSession();}catch(e){if(empty)empty.textContent='Kunne ikke hente økten: '+e.message;return;}if(!SESSION){if(empty)empty.textContent='Ingen økt å vise.';return;}empty?.classList.add('hidden');const notes=document.getElementById('notes');if(notes)notes.value=SESSION.notes||'';renderSummary(SESSION);renderZones(SESSION);renderDrags(SESSION);renderChart(SESSION);wireButtons();}
document.addEventListener('DOMContentLoaded',renderResults);addEventListener('intz:viewchange',e=>e.detail?.view==='results'&&renderResults());addEventListener('resize',()=>SESSION&&renderChart(SESSION));
