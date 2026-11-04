// supabase-client.js
// INTZ v10.1 – Supabase RPC-klient uten separat innlogging.
//
// Aktiv INTZ-profil brukes som user_key.
// En privat synknøkkel brukes til å kontrollere tilgangen.
// Tabellenes data er ikke gjort direkte tilgjengelige for anon-rollen.

import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL =
  "https://mmlxbgdzbuijnlfedyqu.supabase.co";

const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tbHhiZ2R6YnVpam5sZmVkeXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTY4MzAsImV4cCI6MjA4ODc5MjgzMH0.zZDw-rWrA49U-4HFGEhjjzLJXb-z1X56wzv90ds9-Kg";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

function normalizeUserKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validateCredentials(
  userKey,
  syncSecret
) {
  const cleanUserKey =
    normalizeUserKey(userKey);

  const cleanSecret =
    String(syncSecret || "").trim();

  if (!cleanUserKey) {
    throw new Error(
      "Aktiv INTZ-profil mangler."
    );
  }

  if (cleanUserKey === "default") {
    throw new Error(
      "Opprett en personlig INTZ-profil før skysynk brukes."
    );
  }

  if (cleanSecret.length < 12) {
    throw new Error(
      "Synknøkkelen må inneholde minst 12 tegn."
    );
  }

  return {
    userKey: cleanUserKey,
    syncSecret: cleanSecret
  };
}

async function callRpc(
  functionName,
  parameters
) {
  const { data, error } =
    await supabase.rpc(
      functionName,
      parameters
    );

  if (error) {
    throw error;
  }

  return data;
}

async function registerOrVerify(
  userKey,
  syncSecret
) {
  const credentials =
    validateCredentials(
      userKey,
      syncSecret
    );

  const data = await callRpc(
    "intz_register_or_verify",
    {
      p_user_key:
        credentials.userKey,

      p_sync_secret:
        credentials.syncSecret
    }
  );

  if (data !== true) {
    throw new Error(
      "Supabase avviste bruker eller synknøkkel."
    );
  }

  return true;
}

function workoutRow(workout) {
  return {
    local_id:
      workout._local_id,

    name:
      workout.name || "Økt",

    description:
      workout.desc || "",

    payload:
      workout,

    schema_version:
      Number(
        workout._schema_version || 1
      ),

    client_updated_at:
      workout._updated_at,

    deleted_at:
      workout._deleted_at || null
  };
}

function sessionRow(session) {
  return {
    local_id:
      session._local_id,

    name:
      session.name || "Økt",

    started_at:
      session.startedAt || null,

    ended_at:
      session.endedAt || null,

    payload:
      session,

    schema_version:
      Number(
        session._schema_version || 1
      ),

    client_updated_at:
      session._updated_at,

    deleted_at:
      session._deleted_at || null
  };
}

async function upsertWorkouts(
  userKey,
  syncSecret,
  workouts
) {
  const credentials =
    validateCredentials(
      userKey,
      syncSecret
    );

  if (!Array.isArray(workouts)) {
    throw new Error(
      "Øktmaler må sendes som en liste."
    );
  }

  if (workouts.length === 0) {
    return [];
  }

  const data = await callRpc(
    "intz_upsert_workouts",
    {
      p_user_key:
        credentials.userKey,

      p_sync_secret:
        credentials.syncSecret,

      p_items:
        workouts.map(workoutRow)
    }
  );

  return Array.isArray(data)
    ? data
    : [];
}

async function upsertSessions(
  userKey,
  syncSecret,
  sessions
) {
  const credentials =
    validateCredentials(
      userKey,
      syncSecret
    );

  if (!Array.isArray(sessions)) {
    throw new Error(
      "Treningsøkter må sendes som en liste."
    );
  }

  if (sessions.length === 0) {
    return [];
  }

  const data = await callRpc(
    "intz_upsert_sessions",
    {
      p_user_key:
        credentials.userKey,

      p_sync_secret:
        credentials.syncSecret,

      p_items:
        sessions.map(sessionRow)
    }
  );

  return Array.isArray(data)
    ? data
    : [];
}

async function listWorkouts(
  userKey,
  syncSecret
) {
  const credentials =
    validateCredentials(
      userKey,
      syncSecret
    );

  const data = await callRpc(
    "intz_list_workouts",
    {
      p_user_key:
        credentials.userKey,

      p_sync_secret:
        credentials.syncSecret
    }
  );

  return Array.isArray(data)
    ? data
    : [];
}

async function listSessions(
  userKey,
  syncSecret
) {
  const credentials =
    validateCredentials(
      userKey,
      syncSecret
    );

  const data = await callRpc(
    "intz_list_sessions",
    {
      p_user_key:
        credentials.userKey,

      p_sync_secret:
        credentials.syncSecret
    }
  );

  return Array.isArray(data)
    ? data
    : [];
}

window.INTZSupabase = {
  supabase,
  normalizeUserKey,
  validateCredentials,
  registerOrVerify,
  upsertWorkouts,
  upsertSessions,
  listWorkouts,
  listSessions,
  SUPABASE_URL
};
