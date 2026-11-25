import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const client=createClient('https://mmlxbgdzbuijnlfedyqu.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tbHhiZ2R6YnVpam5sZmVkeXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTY4MzAsImV4cCI6MjA4ODc5MjgzMH0.zZDw-rWrA49U-4HFGEhjjzLJXb-z1X56wzv90ds9-Kg',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function c(u,s){u=String(u||'').trim().toLowerCase();s=String(s||'').trim();if(!u||u==='default')throw Error('Opprett en personlig INTZ-profil.');if(s.length<12)throw Error('Synknøkkelen må ha minst 12 tegn.');return{u,s}}
async function rpc(name,args){const{data,error}=await client.rpc(name,args);if(error)throw Error(error.message);return data}
window.INTZSupabase={
 registerOrVerify:(u,s)=>{let x=c(u,s);return rpc('intz_v2_register_or_verify',{p_user_key:x.u,p_sync_secret:x.s})},
 upsertSession:(u,s,v)=>{let x=c(u,s);return rpc('intz_v2_upsert_session',{p_user_key:x.u,p_sync_secret:x.s,p_session:v})},
 listSessionSummaries:(u,s)=>{let x=c(u,s);return rpc('intz_v2_list_session_summaries',{p_user_key:x.u,p_sync_secret:x.s})},
 getSession:(u,s,id)=>{let x=c(u,s);return rpc('intz_v2_get_session',{p_user_key:x.u,p_sync_secret:x.s,p_local_id:String(id)})},
 deleteSession:(u,s,id,t)=>{let x=c(u,s);return rpc('intz_v2_delete_session',{p_user_key:x.u,p_sync_secret:x.s,p_local_id:String(id),p_client_updated_at:t||new Date().toISOString()})}
};
