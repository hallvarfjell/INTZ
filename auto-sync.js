// auto-sync.js
// INTZ v10.1
//
// Automatisk synkronisering mens appen er åpen.
//
// Synk kjøres:
// - ved oppstart
// - når appen kommer online
// - når appen blir synlig igjen
// - når localStorage-data endres
// - etter eksplisitt intz:sync-request
// - hvert femte minutt
//
// Bare én synk kan kjøre samtidig.

(function () {
  const START_DELAY_MS =
    1000;

  const DEBOUNCE_MS =
    1500;

  const PERIODIC_MS =
    5 * 60 * 1000;

  const MIN_BETWEEN_SYNCS_MS =
    20 * 1000;

  let running = false;
  let queued = false;
  let timer = null;
  let lastSyncTimestamp = 0;

  function activeUser() {
    return (
      localStorage.getItem(
        "active_user"
      ) || "default"
    );
  }

  function nsKey(key) {
    return (
      "u:" +
      activeUser() +
      ":" +
      key
    );
  }

  function getNS(key, fallback) {
    try {
      const value =
        localStorage.getItem(
          nsKey(key)
        );

      return value != null
        ? JSON.parse(value)
        : fallback;
    } catch {
      return fallback;
    }
  }

  function setNS(key, value) {
    localStorage.setItem(
      nsKey(key),
      JSON.stringify(value)
    );
  }

  function enabled() {
    const secret =
      String(
        getNS(
          "cloudSyncSecret",
          ""
        )
      );

    return (
      activeUser() !== "default" &&
      !!getNS(
        "cloudEnabled",
        false
      ) &&
      secret.length >= 12 &&
      !!window.INTZCloud
    );
  }

  function publishStatus(
    state,
    message
  ) {
    const status = {
      state,
      message,
      at:
        new Date().toISOString()
    };

    try {
      setNS(
        "cloudSyncStatus",
        status
      );
    } catch {
      /*
       * Status er ikke kritisk dersom localStorage
       * er nær kvotegrensen.
       */
    }

    window.dispatchEvent(
      new CustomEvent(
        "intz:sync-status",
        {
          detail: status
        }
      )
    );
  }

  async function performSync(
    reason = "automatic"
  ) {
    if (!enabled()) {
      return null;
    }

    if (!navigator.onLine) {
      publishStatus(
        "offline",
        "Frakoblet. Endringer er lagret lokalt."
      );

      return null;
    }

    if (running) {
      queued = true;
      return null;
    }

    running = true;
    queued = false;

    publishStatus(
      "syncing",
      "Synkroniserer..."
    );

    try {
      const result =
        await window.INTZCloud
          .syncAutomatic();

      lastSyncTimestamp =
        Date.now();

      try {
        setNS(
          "cloudLastSyncAt",
          new Date(
            lastSyncTimestamp
          ).toISOString()
        );
      } catch {
        /*
         * Sist synk-tid er ikke kritisk.
         */
      }

      publishStatus(
        "synced",
        "Synkronisert"
      );

      return result;
    } catch (error) {
      console.warn(
        "[INTZ auto-sync] Feil:",
        reason,
        error
      );

      publishStatus(
        "error",
        error?.message ||
        String(error)
      );

      return null;
    } finally {
      running = false;

      if (queued) {
        queued = false;

        window.setTimeout(
          () => {
            performSync("queued");
          },
          DEBOUNCE_MS
        );
      }
    }
  }

  function requestSync(
    reason = "change",
    immediate = false
  ) {
    if (!enabled()) {
      return;
    }

    window.clearTimeout(timer);

    const timeSinceLast =
      Date.now() -
      lastSyncTimestamp;

    const delay =
      immediate ||
      timeSinceLast >=
        MIN_BETWEEN_SYNCS_MS
        ? 0
        : DEBOUNCE_MS;

    timer =
      window.setTimeout(
        () => {
          performSync(reason);
        },
        delay
      );
  }

  window.addEventListener(
    "online",
    () => {
      requestSync(
        "online",
        true
      );
    }
  );

  window.addEventListener(
    "offline",
    () => {
      publishStatus(
        "offline",
        "Frakoblet. Endringer lagres lokalt."
      );
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        requestSync(
          "visible",
          false
        );
      }
    }
  );

  window.addEventListener(
    "intz:sync-request",
    event => {
      requestSync(
        event.detail?.reason ||
        "requested",

        !!event.detail?.immediate
      );
    }
  );

  /*
   * Mange av de eksisterende filene bruker setNS()
   * direkte. Ved å observere localStorage.setItem()
   * kan maler, økter og slettinger synkroniseres uten
   * at hele main.js og builder.js må erstattes.
   */
  const originalSetItem =
    Storage.prototype.setItem;

  Storage.prototype.setItem =
    function patchedSetItem(
      key,
      value
    ) {
      const result =
        originalSetItem.call(
          this,
          key,
          value
        );

      const prefix =
        "u:" +
        activeUser() +
        ":";

      const relevant =
        key ===
          prefix +
          "custom_workouts_v2" ||
        key ===
          prefix +
          "sessions" ||
        key ===
          prefix +
          "cloudDeleted_workouts" ||
        key ===
          prefix +
          "cloudDeleted_sessions";

      if (relevant) {
        requestSync(
          "local-storage-change",
          false
        );
      }

      return result;
    };

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      window.setTimeout(
        () => {
          requestSync(
            "startup",
            true
          );
        },
        START_DELAY_MS
      );

      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            requestSync(
              "periodic",
              false
            );
          }
        },
        PERIODIC_MS
      );
    }
  );

  window.INTZAutoSync = {
    enabled,
    requestSync,
    performSync
  };
})();
