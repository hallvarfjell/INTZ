// history-loader.js
// INTZ v10.1
//
// Adapter for selektiv historikk:
// - Logg viser også skyaktiviteter som ikke finnes lokalt.
// - Klikk på en aktivitet laster bare ned den aktiviteten.
// - Ghost viser historikkindeksen.
// - Bare valgte Ghost-økter lastes komplett ned.

(function () {
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

  function localSessions() {
    const sessions =
      getNS("sessions", []);

    return Array.isArray(sessions)
      ? sessions.filter(
          session =>
            session &&
            !session._deleted_at
        )
      : [];
  }

  function sessionIndex() {
    if (
      window.INTZCloud &&
      typeof window.INTZCloud
        .getSessionIndex ===
        "function"
    ) {
      return window.INTZCloud
        .getSessionIndex();
    }

    return [];
  }

  function mergedHistory() {
    const merged = new Map();

    for (
      const summary of
      sessionIndex()
    ) {
      const id =
        summary._local_id ||
        summary.id;

      if (id) {
        merged.set(id, summary);
      }
    }

    for (
      const session of
      localSessions()
    ) {
      const id =
        session._local_id ||
        session.id;

      if (id) {
        merged.set(id, session);
      }
    }

    return Array.from(
      merged.values()
    ).sort(
      (a, b) =>
        Date.parse(
          b.startedAt || 0
        ) -
        Date.parse(
          a.startedAt || 0
        )
    );
  }

  function distanceText(session) {
    if (
      Number.isFinite(
        Number(session.distanceM)
      )
    ) {
      return (
        Number(
          session.distanceM
        ) / 1000
      ).toFixed(2) + " km";
    }

    const points =
      Array.isArray(session.points)
        ? session.points
        : [];

    const last =
      points.length
        ? points[
            points.length - 1
          ]
        : null;

    const distance =
      Number(last?.dist_m);

    return Number.isFinite(distance)
      ? (
          distance / 1000
        ).toFixed(2) + " km"
      : "";
  }

  async function ensureHistoryIndex() {
    if (
      !window.INTZCloud ||
      !navigator.onLine
    ) {
      return sessionIndex();
    }

    try {
      return await window.INTZCloud
        .syncSessionIndex();
    } catch (error) {
      console.warn(
        "[INTZ history] Kunne ikke oppdatere historikk:",
        error
      );

      return sessionIndex();
    }
  }

  async function openSession(id) {
    if (
      !window.INTZCloud ||
      !id
    ) {
      location.hash =
        "results:" + id;

      return;
    }

    await window.INTZCloud
      .ensureSessionsAvailable(
        [id]
      );

    location.hash =
      "results:" + id;
  }

  function createHistoryRow(session) {
    const id =
      session._local_id ||
      session.id;

    const row =
      document.createElement("div");

    row.className =
      "menu-item";

    row.style.display =
      "flex";

    row.style.justifyContent =
      "space-between";

    row.style.alignItems =
      "center";

    row.style.gap =
      "8px";

    const link =
      document.createElement("a");

    const date =
      new Date(
        session.startedAt ||
        Date.now()
      ).toLocaleString();

    link.href =
      "#results:" + id;

    link.textContent =
      `${
        session.name || "Økt"
      } — ${date}`;

    link.style.flex = "1";
    link.style.minWidth = "0";
    link.style.textDecoration =
      "none";

    link.onclick =
      async event => {
        event.preventDefault();

        const original =
          link.textContent;

        link.textContent =
          "Henter aktivitet...";

        try {
          await openSession(id);
        } catch (error) {
          link.textContent =
            original;

          alert(
            "Kunne ikke hente aktiviteten: " +
            (
              error?.message ||
              String(error)
            )
          );
        }
      };

    const right =
      document.createElement("div");

    right.style.display =
      "flex";

    right.style.gap =
      "8px";

    right.style.alignItems =
      "center";

    const source =
      document.createElement("span");

    source.className =
      "small";

    source.textContent =
      session._remote_only
        ? "☁ Sky"
        : (
            session._sync_status ===
              "synced"
              ? "✓ Sky"
              : "Lokal"
          );

    const distance =
      document.createElement("span");

    distance.className =
      "small";

    distance.textContent =
      distanceText(session);

    right.appendChild(source);
    right.appendChild(distance);

    row.appendChild(link);
    row.appendChild(right);

    return row;
  }

  async function renderCloudLog() {
    const list =
      document.getElementById(
        "log-list"
      );

    if (!list) {
      return;
    }

    list.innerHTML =
      '<p class="small">Henter historikk...</p>';

    await ensureHistoryIndex();

    const history =
      mergedHistory();

    list.replaceChildren();

    if (!history.length) {
      const empty =
        document.createElement("p");

      empty.className =
        "small";

      empty.textContent =
        "Ingen økter enda.";

      list.appendChild(empty);
      return;
    }

    const container =
      document.createElement("div");

    container.style.display =
      "grid";

    container.style.gap =
      "8px";

    for (const session of history) {
      container.appendChild(
        createHistoryRow(session)
      );
    }

    list.appendChild(container);
  }

  async function buildGhostHistory() {
    const list =
      document.getElementById(
        "ghost-list"
      );

    if (!list) {
      return;
    }

    list.innerHTML =
      '<div class="small" style="padding:8px">Henter historikk...</div>';

    await ensureHistoryIndex();

    const history =
      mergedHistory();

    list.replaceChildren();

    if (!history.length) {
      list.innerHTML =
        '<div class="small" style="padding:8px">Ingen lagrede økter.</div>';

      return;
    }

    for (const session of history) {
      const id =
        session._local_id ||
        session.id;

      const row =
        document.createElement(
          "label"
        );

      row.className =
        "menu-item";

      const checkbox =
        document.createElement(
          "input"
        );

      checkbox.type =
        "checkbox";

      checkbox.value =
        id;

      const text =
        document.createElement(
          "span"
        );

      const date =
        new Date(
          session.startedAt ||
          Date.now()
        ).toLocaleString();

      text.textContent =
        `${
          session.name || "Økt"
        } – ${date}`;

      row.appendChild(checkbox);
      row.appendChild(text);
      list.appendChild(row);
    }
  }

  async function downloadSelectedGhosts() {
    const list =
      document.getElementById(
        "ghost-list"
      );

    const button =
      document.getElementById(
        "ghost-apply"
      );

    const selected =
      Array.from(
        list?.querySelectorAll(
          'input[type="checkbox"]:checked'
        ) || []
      ).map(
        checkbox =>
          checkbox.value
      );

    if (!selected.length) {
      return;
    }

    if (
      !window.INTZCloud ||
      typeof window.INTZCloud
        .ensureSessionsAvailable !==
        "function"
    ) {
      return;
    }

    const oldText =
      button?.textContent;

    if (button) {
      button.disabled = true;
      button.textContent =
        "Henter...";
    }

    try {
      await window.INTZCloud
        .ensureSessionsAvailable(
          selected
        );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          oldText || "Bruk";
      }
    }
  }

  /*
   * Capture brukes slik at historikken bygges før den gamle
   * Ghost-håndteringen i main.js kjører buildGhostList().
   */
  document.addEventListener(
    "click",
    event => {
      const picker =
        event.target.closest(
          "#ghost-picker"
        );

      if (picker) {
        window.setTimeout(
          buildGhostHistory,
          0
        );

        return;
      }

      const apply =
        event.target.closest(
          "#ghost-apply"
        );

      if (apply) {
        /*
         * Den eksisterende håndteringen kjører etterpå.
         * Nedlastingen startes først, og deretter sendes
         * et nytt klikk når dataene er lokalt tilgjengelige.
         */
        if (
          apply.dataset.historyReady ===
          "true"
        ) {
          delete apply.dataset
            .historyReady;

          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        downloadSelectedGhosts()
          .then(() => {
            apply.dataset.historyReady =
              "true";

            apply.click();
          })
          .catch(error => {
            alert(
              "Kunne ikke hente Ghost-øktene: " +
              (
                error?.message ||
                String(error)
              )
            );
          });
      }
    },
    true
  );

  window.addEventListener(
    "intz:viewchange",
    event => {
      if (
        event.detail?.view ===
        "log"
      ) {
        window.setTimeout(
          renderCloudLog,
          0
        );
      }
    }
  );

  window.addEventListener(
    "intz:historychange",
    () => {
      if (
        window.INTZRoute?.view ===
        "log"
      ) {
        renderCloudLog();
      }
    }
  );

  window.INTZHistory = {
    renderCloudLog,
    buildGhostHistory,
    openSession,
    mergedHistory
  };
})();
