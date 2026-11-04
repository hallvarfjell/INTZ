// log-view.js
// INTZ v10.1 – Loggvisning med robust sletting.
//
// Økten fjernes fysisk fra localStorage.
// cloud-sync.js oppdager deretter at en tidligere kjent
// økt mangler og laster opp en tombstone ved neste synk.

function activeUser() {
  return (
    localStorage.getItem("active_user") ||
    "default"
  );
}

function nsKey(key) {
  return `u:${activeUser()}:${key}`;
}

function getNS(key, fallback) {
  try {
    const current =
      localStorage.getItem(nsKey(key));

    if (current != null) {
      return JSON.parse(current);
    }

    const legacy =
      localStorage.getItem(key);

    return legacy != null
      ? JSON.parse(legacy)
      : fallback;
  } catch (error) {
    console.error(
      "[INTZ log] Kunne ikke lese localStorage:",
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

function visibleSessions() {
  const sessions =
    getNS("sessions", []);

  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions.filter(
    session =>
      session &&
      !session._deleted_at
  );
}

function findSessionIndex(
  sessions,
  selectedSession
) {
  return sessions.findIndex(
    session => {
      if (
        session?._local_id &&
        selectedSession?._local_id
      ) {
        return (
          session._local_id ===
          selectedSession._local_id
        );
      }

      return (
        session?.id ===
        selectedSession?.id
      );
    }
  );
}

function syncStatusLabel(session) {
  if (
    session?._sync_status === "synced"
  ) {
    return "✓ Sky";
  }

  if (
    session?._sync_status === "error"
  ) {
    return "! Synkfeil";
  }

  return "Lokal";
}

async function deleteSession(
  selectedSession,
  deleteButton
) {
  if (
    !confirm(
      "Slette denne økta?"
    )
  ) {
    return;
  }

  if (deleteButton) {
    deleteButton.disabled = true;
  }

  try {
    const allSessions =
      getNS("sessions", []);

    if (!Array.isArray(allSessions)) {
      throw new Error(
        "Øktlisten har ugyldig format."
      );
    }

    const index =
      findSessionIndex(
        allSessions,
        selectedSession
      );

    if (index < 0) {
      throw new Error(
        "Fant ikke økten i lokal lagring."
      );
    }

    /*
     * Fysisk fjerning brukes her.
     *
     * Dette reduserer lagringsbruken umiddelbart og virker
     * også dersom localStorage ligger nær kvotegrensen.
     *
     * cloud-sync.js har en known-ID-liste og oppdager ved
     * neste syncUp at en kjent økt er borte.
     */
    allSessions.splice(index, 1);

    setNS(
      "sessions",
      allSessions
    );

    renderLog();

    window.dispatchEvent(
      new CustomEvent(
        "intz:datachange",
        {
          detail: {
            type: "session-deleted",
            id:
              selectedSession._local_id ||
              selectedSession.id
          }
        }
      )
    );

    const cloudEnabled =
      !!getNS(
        "cloudEnabled",
        false
      );

    if (
      cloudEnabled &&
      window.INTZCloud
    ) {
      try {
        await window.INTZCloud
          .syncUp();

        renderLog();
      } catch (syncError) {
        console.warn(
          "[INTZ log] Økten ble slettet lokalt, men skysynkronisering feilet:",
          syncError
        );

        alert(
          "Økten ble slettet lokalt, men slettingen ble ikke synkronisert. Prøv Synk opp senere."
        );
      }
    }
  } catch (error) {
    console.error(
      "[INTZ log] Sletting feilet:",
      error
    );

    alert(
      "Kunne ikke slette økten: " +
      (
        error?.message ||
        String(error)
      )
    );

    if (deleteButton) {
      deleteButton.disabled = false;
    }
  }
}

function createSessionRow(session) {
  const row =
    document.createElement("div");

  row.className = "menu-item";

  row.style.display = "flex";
  row.style.justifyContent =
    "space-between";
  row.style.alignItems = "center";
  row.style.gap = "8px";

  const startedAt =
    new Date(
      session.startedAt ||
      Date.now()
    ).toLocaleString();

  const points =
    Array.isArray(session.points)
      ? session.points
      : [];

  const lastPoint =
    points.length
      ? points[points.length - 1]
      : null;

  const distanceMetres =
    Number(lastPoint?.dist_m);

  const distance =
    Number.isFinite(distanceMetres)
      ? (
          distanceMetres / 1000
        ).toFixed(2) + " km"
      : "";

  const link =
    document.createElement("a");

  link.href =
    "#results:" +
    (
      session.id ||
      session._local_id
    );

  link.textContent =
    `${session.name || "Økt"} — ${startedAt}`;

  link.style.flex = "1";
  link.style.minWidth = "0";
  link.style.textDecoration = "none";

  const controls =
    document.createElement("div");

  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.alignItems = "center";
  controls.style.flexShrink = "0";

  const syncStatus =
    document.createElement("span");

  syncStatus.className = "small";
  syncStatus.textContent =
    syncStatusLabel(session);

  const distanceLabel =
    document.createElement("span");

  distanceLabel.className = "small";
  distanceLabel.textContent = distance;

  const deleteButton =
    document.createElement("button");

  deleteButton.type = "button";
  deleteButton.className = "ghost";
  deleteButton.title = "Slett økt";
  deleteButton.setAttribute(
    "aria-label",
    "Slett økt"
  );

  deleteButton.innerHTML =
    '<i class="ph-trash"></i>';

  /*
   * onclick brukes i stedet for addEventListener.
   * Dermed får knappen bare én klikkbehandler.
   */
  deleteButton.onclick =
    event => {
      event.preventDefault();
      event.stopPropagation();

      deleteSession(
        session,
        deleteButton
      );
    };

  controls.appendChild(syncStatus);
  controls.appendChild(distanceLabel);
  controls.appendChild(deleteButton);

  row.appendChild(link);
  row.appendChild(controls);

  return row;
}

function renderLog() {
  const list =
    document.getElementById(
      "log-list"
    );

  if (!list) {
    return;
  }

  list.replaceChildren();

  const sessions =
    visibleSessions();

  if (!sessions.length) {
    const empty =
      document.createElement("p");

    empty.className = "small";
    empty.textContent =
      "Ingen økter enda.";

    list.appendChild(empty);
    return;
  }

  const container =
    document.createElement("div");

  container.style.display = "grid";
  container.style.gap = "8px";

  sessions
    .slice()
    .reverse()
    .forEach(session => {
      container.appendChild(
        createSessionRow(session)
      );
    });

  list.appendChild(container);
}

window.addEventListener(
  "intz:viewchange",
  event => {
    if (
      event.detail?.view === "log"
    ) {
      renderLog();
    }
  }
);

window.addEventListener(
  "intz:datachange",
  renderLog
);

document.addEventListener(
  "DOMContentLoaded",
  renderLog
);