// cloud-sync.js
// INTZ v10.1 – Offline-first toveis synkronisering.
//
// Aktiv INTZ-profil = skylagringens user_key.
// Synknøkkel lagres lokalt for aktiv profil.
// Konfliktregel: nyeste _updated_at vinner.

function activeUser() {
  return (
    localStorage.getItem(
      "active_user"
    ) || "default"
  );
}

function nsKey(key) {
  return `u:${activeUser()}:${key}`;
}

function getNS(key, fallback) {
  try {
    const current =
      localStorage.getItem(
        nsKey(key)
      );

    if (current != null) {
      return JSON.parse(current);
    }

    const legacy =
      localStorage.getItem(key);

    return legacy != null
      ? JSON.parse(legacy)
      : fallback;
  } catch (error) {
    console.warn(
      "[INTZ] Kunne ikke lese lokal lagring:",
      key,
      error
    );

    return fallback;
  }
}

function setNS(key, value) {
  localStorage.setItem(
    nsKey(key),
    JSON.stringify(value)
  );
}

function currentCredentials() {
  const userKey =
    String(activeUser() || "")
      .trim()
      .toLowerCase();

  const syncSecret =
    String(
      getNS("cloudSyncSecret", "")
    ).trim();

  if (!userKey) {
    throw new Error(
      "Aktiv INTZ-profil mangler."
    );
  }

  if (userKey === "default") {
    throw new Error(
      "Opprett en personlig INTZ-profil før skysynk brukes."
    );
  }

  if (syncSecret.length < 12) {
    throw new Error(
      "Angi og lagre en synknøkkel på minst 12 tegn."
    );
  }

  return {
    userKey,
    syncSecret
  };
}

function createUuid(prefix = "intz") {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

function parseTime(value) {
  const parsed =
    Date.parse(value || "");

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function stableCopy(value) {
  if (Array.isArray(value)) {
    return value.map(stableCopy);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const result = {};

    const keys =
      Object.keys(value).sort();

    for (const key of keys) {
      if (
        key === "_cloud_id" ||
        key === "_cloud_synced_at" ||
        key === "_sync_status" ||
        key === "_sync_hash" ||
        key === "_updated_at"
      ) {
        continue;
      }

      result[key] =
        stableCopy(value[key]);
    }

    return result;
  }

  return value;
}

function contentHash(item) {
  return JSON.stringify(
    stableCopy(item)
  );
}

function ensureMetadata(
  item,
  prefix
) {
  const now =
    new Date().toISOString();

  const normalized = {
    ...(item || {}),

    _local_id:
      item?._local_id ||
      item?.id ||
      createUuid(prefix),

    _schema_version:
      Number(
        item?._schema_version || 1
      ),

    _updated_at:
      item?._updated_at || now,

    _deleted_at:
      item?._deleted_at || null,

    _sync_status:
      item?._sync_status ||
      "pending"
  };

  const calculatedHash =
    contentHash(normalized);

  if (
    normalized._sync_hash &&
    normalized._sync_hash !==
      calculatedHash
  ) {
    normalized._updated_at = now;
    normalized._sync_status =
      "pending";
  }

  normalized._sync_hash =
    contentHash(normalized);

  return normalized;
}

function migrateCollection(
  storageKey,
  prefix
) {
  const source =
    getNS(storageKey, []);

  if (!Array.isArray(source)) {
    setNS(storageKey, []);
    return [];
  }

  let changed = false;

  const migrated =
    source.map(item => {
      const normalized =
        ensureMetadata(
          item || {},
          prefix
        );

      if (
        normalized._local_id !==
          item?._local_id ||
        normalized._updated_at !==
          item?._updated_at ||
        normalized._sync_hash !==
          item?._sync_hash ||
        normalized._schema_version !==
          item?._schema_version
      ) {
        changed = true;
      }

      return normalized;
    });

  if (changed) {
    setNS(
      storageKey,
      migrated
    );
  }

  return migrated;
}

function knownKey(collectionName) {
  return (
    "cloudKnown_" +
    collectionName
  );
}

function getKnownIds(collectionName) {
  const value =
    getNS(
      knownKey(collectionName),
      []
    );

  return Array.isArray(value)
    ? value
    : [];
}

function setKnownIds(
  collectionName,
  ids
) {
  setNS(
    knownKey(collectionName),
    Array.from(
      new Set(ids)
    )
  );
}

function deletionKey(
  collectionName
) {
  return (
    "cloudDeleted_" +
    collectionName
  );
}

function getDeletionLedger(
  collectionName
) {
  const value =
    getNS(
      deletionKey(collectionName),
      []
    );

  return Array.isArray(value)
    ? value
    : [];
}

function setDeletionLedger(
  collectionName,
  items
) {
  setNS(
    deletionKey(collectionName),
    items
  );
}

function detectLocalDeletions(
  collectionName,
  localItems
) {
  const currentIds =
    new Set(
      localItems
        .map(item =>
          item?._local_id
        )
        .filter(Boolean)
    );

  const knownIds =
    getKnownIds(collectionName);

  const ledger =
    getDeletionLedger(
      collectionName
    );

  const ledgerIds =
    new Set(
      ledger
        .map(item =>
          item?._local_id
        )
        .filter(Boolean)
    );

  const now =
    new Date().toISOString();

  for (const knownId of knownIds) {
    if (
      currentIds.has(knownId) ||
      ledgerIds.has(knownId)
    ) {
      continue;
    }

    const tombstone = {
      _local_id: knownId,
      _schema_version: 1,
      _updated_at: now,
      _deleted_at: now,
      _sync_status: "pending",
      name: "Slettet"
    };

    tombstone._sync_hash =
      contentHash(tombstone);

    ledger.push(tombstone);
  }

  setDeletionLedger(
    collectionName,
    ledger
  );

  return ledger;
}

function itemsToUpload(items) {
  return items.filter(item => {
    if (!item?._local_id) {
      return false;
    }

    return (
      item._sync_status !==
        "synced" ||
      !item._cloud_id
    );
  });
}

function markUploaded(
  items,
  uploadedRows
) {
  const rowsByLocalId =
    new Map(
      (uploadedRows || []).map(
        row => [
          row.local_id,
          row
        ]
      )
    );

  return items.map(item => {
    const row =
      rowsByLocalId.get(
        item._local_id
      );

    if (!row) {
      return item;
    }

    const updated = {
      ...item,

      _cloud_id:
        row.id,

      _cloud_synced_at:
        new Date().toISOString(),

      _sync_status:
        "synced"
    };

    updated._sync_hash =
      contentHash(updated);

    return updated;
  });
}

function markUploadError(
  items,
  attemptedIds
) {
  const ids =
    new Set(attemptedIds);

  return items.map(item => {
    if (
      !ids.has(item._local_id)
    ) {
      return item;
    }

    return {
      ...item,
      _sync_status: "error"
    };
  });
}

function normalizeCloudRow(
  row,
  prefix
) {
  const payload =
    row?.payload &&
    typeof row.payload ===
      "object"
      ? row.payload
      : {};

  const normalized =
    ensureMetadata(
      {
        ...payload,

        _cloud_id:
          row.id,

        _local_id:
          row.local_id ||
          payload._local_id ||
          createUuid(prefix),

        _schema_version:
          Number(
            row.schema_version ||
            payload._schema_version ||
            1
          ),

        _updated_at:
          row.client_updated_at ||
          payload._updated_at ||
          new Date().toISOString(),

        _deleted_at:
          row.deleted_at ||
          payload._deleted_at ||
          null,

        _cloud_synced_at:
          new Date().toISOString(),

        _sync_status:
          "synced"
      },
      prefix
    );

  normalized._sync_hash =
    contentHash(normalized);

  return normalized;
}

function mergeCollections(
  localItems,
  cloudRows,
  prefix
) {
  const merged = new Map();

  for (const localItem of localItems) {
    const normalized =
      ensureMetadata(
        localItem,
        prefix
      );

    merged.set(
      normalized._local_id,
      normalized
    );
  }

  let downloaded = 0;
  let replaced = 0;
  let deleted = 0;

  for (const row of cloudRows) {
    const cloudItem =
      normalizeCloudRow(
        row,
        prefix
      );

    const localItem =
      merged.get(
        cloudItem._local_id
      );

    const cloudTime =
      parseTime(
        cloudItem._updated_at
      );

    const localTime =
      parseTime(
        localItem?._updated_at
      );

    if (cloudItem._deleted_at) {
      if (
        !localItem ||
        cloudTime >= localTime
      ) {
        merged.delete(
          cloudItem._local_id
        );

        deleted++;
      }

      continue;
    }

    if (!localItem) {
      merged.set(
        cloudItem._local_id,
        cloudItem
      );

      downloaded++;
      continue;
    }

    if (cloudTime > localTime) {
      merged.set(
        cloudItem._local_id,
        cloudItem
      );

      replaced++;
    }
  }

  return {
    items:
      Array.from(
        merged.values()
      ),

    downloaded,
    replaced,
    deleted
  };
}

async function ensureCloud() {
  if (!window.INTZSupabase) {
    throw new Error(
      "Supabase-klienten er ikke lastet."
    );
  }

  const credentials =
    currentCredentials();

  await window.INTZSupabase
    .registerOrVerify(
      credentials.userKey,
      credentials.syncSecret
    );

  return credentials;
}

async function uploadCollection({
  collectionName,
  storageKey,
  prefix,
  uploadFunction
}) {
  const credentials =
    currentCredentials();

  let localItems =
    migrateCollection(
      storageKey,
      prefix
    );

  let deletionLedger =
    detectLocalDeletions(
      collectionName,
      localItems
    );

  const changedItems =
    itemsToUpload(localItems);

  const changedDeletions =
    itemsToUpload(
      deletionLedger
    );

  const attempted = [
    ...changedItems,
    ...changedDeletions
  ];

  if (attempted.length === 0) {
    return {
      uploaded: 0,
      deleted: 0
    };
  }

  const attemptedIds =
    attempted.map(
      item => item._local_id
    );

  try {
    const rows =
      await uploadFunction(
        credentials.userKey,
        credentials.syncSecret,
        attempted
      );

    localItems =
      markUploaded(
        localItems,
        rows
      );

    deletionLedger =
      markUploaded(
        deletionLedger,
        rows
      );

    setNS(
      storageKey,
      localItems
    );

    setDeletionLedger(
      collectionName,
      deletionLedger
    );

    const knownIds =
      new Set(
        getKnownIds(
          collectionName
        )
      );

    for (
      const item of localItems
    ) {
      knownIds.add(
        item._local_id
      );
    }

    for (
      const item of
      deletionLedger
    ) {
      knownIds.add(
        item._local_id
      );
    }

    setKnownIds(
      collectionName,
      Array.from(knownIds)
    );

    return {
      uploaded:
        changedItems.length,

      deleted:
        changedDeletions.length
    };
  } catch (error) {
    localItems =
      markUploadError(
        localItems,
        attemptedIds
      );

    deletionLedger =
      markUploadError(
        deletionLedger,
        attemptedIds
      );

    setNS(
      storageKey,
      localItems
    );

    setDeletionLedger(
      collectionName,
      deletionLedger
    );

    throw error;
  }
}

async function syncUp() {
  await ensureCloud();

  const workoutResult =
    await uploadCollection({
      collectionName:
        "workouts",

      storageKey:
        "custom_workouts_v2",

      prefix:
        "workout",

      uploadFunction:
        (
          userKey,
          syncSecret,
          items
        ) =>
          window.INTZSupabase
            .upsertWorkouts(
              userKey,
              syncSecret,
              items
            )
    });

  const sessionResult =
    await uploadCollection({
      collectionName:
        "sessions",

      storageKey:
        "sessions",

      prefix:
        "session",

      uploadFunction:
        (
          userKey,
          syncSecret,
          items
        ) =>
          window.INTZSupabase
            .upsertSessions(
              userKey,
              syncSecret,
              items
            )
    });

  return {
    workouts_uploaded:
      workoutResult.uploaded,

    workouts_deleted:
      workoutResult.deleted,

    sessions_uploaded:
      sessionResult.uploaded,

    sessions_deleted:
      sessionResult.deleted
  };
}

async function syncDown() {
  const credentials =
    await ensureCloud();

  const localWorkouts =
    migrateCollection(
      "custom_workouts_v2",
      "workout"
    );

  const localSessions =
    migrateCollection(
      "sessions",
      "session"
    );

  const cloudWorkouts =
    await window.INTZSupabase
      .listWorkouts(
        credentials.userKey,
        credentials.syncSecret
      );

  const cloudSessions =
    await window.INTZSupabase
      .listSessions(
        credentials.userKey,
        credentials.syncSecret
      );

  const workoutMerge =
    mergeCollections(
      localWorkouts,
      cloudWorkouts,
      "workout"
    );

  const sessionMerge =
    mergeCollections(
      localSessions,
      cloudSessions,
      "session"
    );

  setNS(
    "custom_workouts_v2",
    workoutMerge.items
  );

  setNS(
    "sessions",
    sessionMerge.items
  );

  setKnownIds(
    "workouts",
    cloudWorkouts
      .map(row => row.local_id)
      .filter(Boolean)
  );

  setKnownIds(
    "sessions",
    cloudSessions
      .map(row => row.local_id)
      .filter(Boolean)
  );

  window.dispatchEvent(
    new CustomEvent(
      "intz:datachange",
      {
        detail: {
          workouts:
            workoutMerge,

          sessions:
            sessionMerge
        }
      }
    )
  );

  return {
    workouts_downloaded:
      workoutMerge.downloaded,

    workouts_replaced:
      workoutMerge.replaced,

    workouts_deleted:
      workoutMerge.deleted,

    sessions_downloaded:
      sessionMerge.downloaded,

    sessions_replaced:
      sessionMerge.replaced,

    sessions_deleted:
      sessionMerge.deleted
  };
}

async function syncAll() {
  const uploadResult =
    await syncUp();

  const downloadResult =
    await syncDown();

  return {
    ...uploadResult,
    ...downloadResult
  };
}

function touch(
  item,
  prefix = "item"
) {
  const updated =
    ensureMetadata(
      {
        ...item,

        _updated_at:
          new Date().toISOString(),

        _sync_status:
          "pending"
      },
      prefix
    );

  updated._sync_hash =
    contentHash(updated);

  return updated;
}

function softDelete(
  item,
  prefix = "item"
) {
  const now =
    new Date().toISOString();

  const deleted =
    ensureMetadata(
      {
        ...item,
        _updated_at: now,
        _deleted_at: now,
        _sync_status: "pending"
      },
      prefix
    );

  deleted._sync_hash =
    contentHash(deleted);

  return deleted;
}

function visible(items) {
  return (items || []).filter(
    item => !item?._deleted_at
  );
}

window.INTZCloud = {
  ensureCloud,
  syncUp,
  syncDown,
  syncAll,
  touch,
  softDelete,
  visible,
  migrateCollection
};