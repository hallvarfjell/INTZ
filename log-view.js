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

async function deleteSession(selectedSession,deleteButton){if(!confirm("Slette denne økta?"))return;if(deleteButton)deleteButton.disabled=true;try{await window.INTZCloud.deleteSession(selectedSession._local_id||selectedSession.id);renderLog()}catch(e){alert("Sletting feilet: "+e.message);if(deleteButton)deleteButton.disabled=false}}

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
function wireTcxImport(){const b=document.getElementById("tcx-import"),i=document.getElementById("tcx-file"),m=document.getElementById("tcx-import-status");if(!b||!i||b.dataset.wired)return;b.dataset.wired="1";b.onclick=()=>i.click();i.onchange=async()=>{let f=i.files?.[0];if(!f)return;try{m.textContent="Importerer …";let x=await INTZTCX.importFile(f);m.textContent=x?`Importert ${x.points.length} datapunkter. Venter på skysynk.`:"Import avbrutt.";renderLog()}catch(e){m.textContent="Import feilet: "+e.message}finally{i.value=""}}}
document.addEventListener("DOMContentLoaded",wireTcxImport);addEventListener("intz:viewchange",e=>e.detail?.view==="log"&&wireTcxImport());
