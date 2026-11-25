-- INTZ v11 Supabase setup. Run once in Supabase SQL Editor.
begin;
create extension if not exists pgcrypto;

create unique index if not exists intz_sessions_user_local_uidx
  on public.intz_sessions (user_key, local_id);
create index if not exists intz_sessions_user_started_idx
  on public.intz_sessions (user_key, started_at desc);

alter table public.intz_accounts enable row level security;
alter table public.intz_sessions enable row level security;
alter table public.intz_workouts enable row level security;
revoke all on public.intz_accounts, public.intz_sessions, public.intz_workouts from anon, authenticated;

create or replace function public.intz_v2_check_secret(p_user_key text,p_sync_secret text)
returns boolean language sql stable security definer set search_path=public,extensions as $$
 select exists(select 1 from public.intz_accounts a where a.user_key=lower(trim(p_user_key)) and a.secret_hash=crypt(p_sync_secret,a.secret_hash));
$$;

create or replace function public.intz_v2_register_or_verify(p_user_key text,p_sync_secret text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare k text:=lower(trim(p_user_key));
begin
 if k='' or k='default' then raise exception 'Ugyldig user_key'; end if;
 if length(p_sync_secret)<12 then raise exception 'Synknøkkelen må ha minst 12 tegn'; end if;
 insert into public.intz_accounts(user_key,secret_hash,created_at,updated_at)
 values(k,crypt(p_sync_secret,gen_salt('bf')),now(),now()) on conflict(user_key) do nothing;
 if not public.intz_v2_check_secret(k,p_sync_secret) then raise exception 'Feil synknøkkel'; end if;
 return true;
end $$;

create or replace function public.intz_v2_upsert_session(p_user_key text,p_sync_secret text,p_session jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare k text:=lower(trim(p_user_key)); lid text:=coalesce(p_session->>'_local_id',p_session->>'id'); row_out public.intz_sessions;
begin
 if not public.intz_v2_check_secret(k,p_sync_secret) then raise exception 'Ikke autorisert'; end if;
 if lid is null or lid='' then raise exception 'Økten mangler local_id'; end if;
 insert into public.intz_sessions(user_key,local_id,name,started_at,ended_at,payload,schema_version,client_updated_at,deleted_at,created_at,server_updated_at)
 values(k,lid,coalesce(p_session->>'name','Økt'),nullif(p_session->>'startedAt','')::timestamptz,nullif(p_session->>'endedAt','')::timestamptz,p_session,coalesce((p_session->>'_schema_version')::int,2),coalesce(nullif(p_session->>'_updated_at','')::timestamptz,now()),nullif(p_session->>'_deleted_at','')::timestamptz,now(),now())
 on conflict(user_key,local_id) do update set
 name=excluded.name,started_at=excluded.started_at,ended_at=excluded.ended_at,payload=excluded.payload,schema_version=excluded.schema_version,
 client_updated_at=excluded.client_updated_at,deleted_at=excluded.deleted_at,server_updated_at=now()
 where public.intz_sessions.client_updated_at is null or excluded.client_updated_at>=public.intz_sessions.client_updated_at
 returning * into row_out;
 if row_out.id is null then select * into row_out from public.intz_sessions where user_key=k and local_id=lid; end if;
 return jsonb_build_object('local_id',row_out.local_id,'server_updated_at',row_out.server_updated_at);
end $$;

create or replace function public.intz_v2_list_session_summaries(p_user_key text,p_sync_secret text)
returns table(local_id text,name text,started_at timestamptz,ended_at timestamptz,duration_sec numeric,distance_m numeric,client_updated_at timestamptz,deleted_at timestamptz,source jsonb)
language plpgsql security definer set search_path=public,extensions as $$
begin
 if not public.intz_v2_check_secret(p_user_key,p_sync_secret) then raise exception 'Ikke autorisert'; end if;
 return query select s.local_id,s.name,s.started_at,s.ended_at,
  greatest(0,extract(epoch from(s.ended_at-s.started_at)))::numeric,
  coalesce(nullif(s.payload->>'distanceM','')::numeric,nullif(s.payload->>'distance_m','')::numeric,nullif(s.payload#>>'{points,-1,dist_m}','')::numeric,0),
  s.client_updated_at,s.deleted_at,s.payload->'source'
 from public.intz_sessions s where s.user_key=lower(trim(p_user_key)) order by s.started_at;
end $$;

create or replace function public.intz_v2_get_session(p_user_key text,p_sync_secret text,p_local_id text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare out_payload jsonb;
begin
 if not public.intz_v2_check_secret(p_user_key,p_sync_secret) then raise exception 'Ikke autorisert'; end if;
 select s.payload into out_payload from public.intz_sessions s where s.user_key=lower(trim(p_user_key)) and s.local_id=p_local_id and s.deleted_at is null;
 return out_payload;
end $$;

create or replace function public.intz_v2_delete_session(p_user_key text,p_sync_secret text,p_local_id text,p_client_updated_at timestamptz)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
 if not public.intz_v2_check_secret(p_user_key,p_sync_secret) then raise exception 'Ikke autorisert'; end if;
 update public.intz_sessions set deleted_at=coalesce(p_client_updated_at,now()),client_updated_at=coalesce(p_client_updated_at,now()),server_updated_at=now(),payload=jsonb_set(jsonb_set(payload,'{_deleted_at}',to_jsonb(coalesce(p_client_updated_at,now()))),'{_updated_at}',to_jsonb(coalesce(p_client_updated_at,now()))) where user_key=lower(trim(p_user_key)) and local_id=p_local_id;
 return true;
end $$;

revoke all on function public.intz_v2_check_secret(text,text) from public;
grant execute on function public.intz_v2_register_or_verify(text,text) to anon,authenticated;
grant execute on function public.intz_v2_upsert_session(text,text,jsonb) to anon,authenticated;
grant execute on function public.intz_v2_list_session_summaries(text,text) to anon,authenticated;
grant execute on function public.intz_v2_get_session(text,text,text) to anon,authenticated;
grant execute on function public.intz_v2_delete_session(text,text,text,timestamptz) to anon,authenticated;
commit;
