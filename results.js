// results.js
// INTZ v10.1 – Resultatvisning, TCX-eksport og JSON-eksport.

let SESSION = null;

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

function currentRoute() {
  return (
    window.INTZRoute ||
    (
      window.INTZRouter &&
      window.INTZRouter.parseHash &&
      window.INTZRouter.parseHash()
    ) ||
    {
      view: "dashboard",
      arg: null
    }
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

function pickSession() {
  const route = currentRoute();

  const id =
    route.view === "results" &&
    route.arg
      ? route.arg
      : (
          location.hash.startsWith(
            "#results:"
          )
            ? location.hash.slice(9)
            : null
        );

  const sessions =
    visibleSessions();

  if (!sessions.length) {
    return null;
  }

  if (id) {
    return (
      sessions.find(
        session =>
          session.id === id ||
          session._local_id === id
      ) || null
    );
  }

  return sessions[
    sessions.length - 1
  ];
}

function formatMMSS(seconds) {
  const total =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const minutes =
    Math.floor(total / 60);

  return (
    minutes +
    ":" +
    String(total % 60)
      .padStart(2, "0")
  );
}

function average(values) {
  return values.length
    ? values.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / values.length
    : null;
}

function computeSummary(session) {
  const points =
    Array.isArray(session.points)
      ? session.points
      : [];

  const duration =
    session.startedAt &&
    session.endedAt
      ? Math.max(
          0,
          (
            new Date(session.endedAt) -
            new Date(session.startedAt)
          ) / 1000
        )
      : 0;

  const heartRates =
    points
      .map(point =>
        Number(point.hr)
      )
      .filter(value =>
        Number.isFinite(value) &&
        value > 0
      );

  const watts =
    points
      .map(point =>
        Number(point.watt)
      )
      .filter(Number.isFinite);

  const lastPoint =
    points.length
      ? points[points.length - 1]
      : null;

  const distanceMetres =
    Number(lastPoint?.dist_m);

  return {
    points,
    duration,

    distanceKm:
      Number.isFinite(
        distanceMetres
      )
        ? distanceMetres / 1000
        : 0,

    averageHr:
      average(heartRates),

    maximumHr:
      heartRates.length
        ? Math.max(...heartRates)
        : null,

    averageWatt:
      average(watts)
  };
}

function renderSummary(session) {
  const target =
    document.getElementById(
      "summary"
    );

  if (!target) {
    return;
  }

  const summary =
    computeSummary(session);

  target.innerHTML = `
    <div>
      <strong>
        ${session.name || "Økt"}
      </strong>
    </div>

    <div>
      Varighet:
      ${formatMMSS(summary.duration)}
    </div>

    <div>
      Distanse:
      ${summary.distanceKm.toFixed(2)}
      km
    </div>

    <div>
      Snittpuls:
      ${
        summary.averageHr != null
          ? Math.round(
              summary.averageHr
            ) + " bpm"
          : "–"
      }
    </div>

    <div>
      Makspuls:
      ${
        summary.maximumHr != null
          ? Math.round(
              summary.maximumHr
            ) + " bpm"
          : "–"
      }
    </div>

    <div>
      Snittwatt:
      ${
        summary.averageWatt != null
          ? Math.round(
              summary.averageWatt
            ) + " W"
          : "–"
      }
    </div>

    <div>
      Datapunkter:
      ${summary.points.length}
    </div>
  `;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pointTimestamp(
  point,
  fallback
) {
  if (
    point?.iso &&
    !Number.isNaN(
      Date.parse(point.iso)
    )
  ) {
    return new Date(
      point.iso
    ).toISOString();
  }

  const timestamp =
    Number(point?.ts);

  if (
    Number.isFinite(timestamp)
  ) {
    return new Date(
      timestamp
    ).toISOString();
  }

  return fallback;
}

function buildTCX(session) {
  const points =
    Array.isArray(session.points)
      ? session.points
      : [];

  if (!points.length) {
    throw new Error(
      "Økten inneholder ingen datapunkter."
    );
  }

  const summary =
    computeSummary(session);

  const startTime =
    session.startedAt &&
    !Number.isNaN(
      Date.parse(session.startedAt)
    )
      ? new Date(
          session.startedAt
        ).toISOString()
      : pointTimestamp(
          points[0],
          new Date().toISOString()
        );

  const totalDistanceMetres =
    Math.max(
      0,
      Math.round(
        summary.distanceKm * 1000
      )
    );

  const averageHr =
    summary.averageHr != null
      ? Math.round(
          summary.averageHr
        )
      : 0;

  const maximumHr =
    summary.maximumHr != null
      ? Math.round(
          summary.maximumHr
        )
      : 0;

  const trackpoints =
    points.map(point => {
      const time =
        pointTimestamp(
          point,
          startTime
        );

      const distance =
        Math.max(
          0,
          Number(point.dist_m) || 0
        );

      const heartRate =
        Math.max(
          0,
          Math.round(
            Number(point.hr) || 0
          )
        );

      const speed =
        Math.max(
          0,
          Number(point.speed_ms) || 0
        );

      const watt =
        Math.max(
          0,
          Math.round(
            Number(point.watt) || 0
          )
        );

      return `
        <Trackpoint>
          <Time>${time}</Time>
          <DistanceMeters>${distance.toFixed(2)}</DistanceMeters>
          ${
            heartRate > 0
              ? `
          <HeartRateBpm>
            <Value>${heartRate}</Value>
          </HeartRateBpm>`
              : ""
          }
          <Extensions>
            <ns3:TPX>
              <ns3:Speed>${speed.toFixed(3)}</ns3:Speed>
              <ns3:Watts>${watt}</ns3:Watts>
            </ns3:TPX>
          </Extensions>
        </Trackpoint>
      `;
    }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xsi:schemaLocation="
    http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
    http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd
  "
>
  <Activities>
    <Activity Sport="Running">
      <Id>${startTime}</Id>

      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${Math.round(summary.duration)}</TotalTimeSeconds>
        <DistanceMeters>${totalDistanceMetres}</DistanceMeters>
        <Calories>0</Calories>

        ${
          averageHr > 0
            ? `
        <AverageHeartRateBpm>
          <Value>${averageHr}</Value>
        </AverageHeartRateBpm>`
            : ""
        }

        ${
          maximumHr > 0
            ? `
        <MaximumHeartRateBpm>
          <Value>${maximumHr}</Value>
        </MaximumHeartRateBpm>`
            : ""
        }

        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>

        <Track>
          ${trackpoints}
        </Track>
      </Lap>

      <Notes>${xmlEscape(session.notes || "")}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

function safeFileName(value) {
  return String(value || "intz-okt")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) ||
    "intz-okt";
}

function downloadBlob(
  fileName,
  content,
  contentType
) {
  const blob =
    new Blob(
      [content],
      {
        type: contentType
      }
    );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(url);
    },
    1500
  );
}

function saveNotes() {
  if (!SESSION) {
    return;
  }

  const notes =
    document.getElementById(
      "notes"
    );

  if (!notes) {
    return;
  }

  const sessions =
    getNS("sessions", []);

  const index =
    sessions.findIndex(
      session => {
        if (
          SESSION._local_id &&
          session._local_id
        ) {
          return (
            session._local_id ===
            SESSION._local_id
          );
        }

        return (
          session.id === SESSION.id
        );
      }
    );

  if (index < 0) {
    alert(
      "Fant ikke økten i lokal lagring."
    );

    return;
  }

  sessions[index] = {
    ...sessions[index],
    notes: notes.value || "",
    _updated_at:
      new Date().toISOString(),
    _sync_status: "pending"
  };

  SESSION = sessions[index];

  setNS("sessions", sessions);

  alert("Merknaden er lagret.");
}

function wireButtons() {
  const tcxButton =
    document.getElementById(
      "btn-download-tcx"
    );

  const jsonButton =
    document.getElementById(
      "btn-dump-json"
    );

  const notesButton =
    document.getElementById(
      "save-notes"
    );

  if (tcxButton) {
    tcxButton.onclick = () => {
      try {
        if (!SESSION) {
          throw new Error(
            "Ingen økt er valgt."
          );
        }

        const tcx =
          buildTCX(SESSION);

        downloadBlob(
          safeFileName(
            SESSION.name
          ) + ".tcx",
          tcx,
          "application/vnd.garmin.tcx+xml;charset=utf-8"
        );
      } catch (error) {
        console.error(
          "[INTZ results] TCX-eksport feilet:",
          error
        );

        alert(
          "TCX-eksport feilet: " +
          (
            error?.message ||
            String(error)
          )
        );
      }
    };
  }

  if (jsonButton) {
    jsonButton.onclick = () => {
      try {
        if (!SESSION) {
          throw new Error(
            "Ingen økt er valgt."
          );
        }

        downloadBlob(
          safeFileName(
            SESSION.name
          ) + ".json",
          JSON.stringify(
            SESSION,
            null,
            2
          ),
          "application/json;charset=utf-8"
        );
      } catch (error) {
        alert(
          "JSON-eksport feilet: " +
          (
            error?.message ||
            String(error)
          )
        );
      }
    };
  }

  if (notesButton) {
    notesButton.onclick =
      saveNotes;
  }
}

function renderChart(session) {
  const canvas =
    document.getElementById(
      "r-chart"
    );

  if (!canvas) {
    return;
  }

  const rect =
    canvas.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    Math.max(
      1,
      Math.floor(
        rect.width * ratio
      )
    );

  canvas.height =
    Math.max(
      1,
      Math.floor(
        rect.height * ratio
      )
    );

  const context =
    canvas.getContext("2d");

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const points =
    Array.isArray(session.points)
      ? session.points
      : [];

  const validPoints =
    points.filter(point =>
      Number.isFinite(
        Number(point.hr)
      ) &&
      Number(point.hr) > 0
    );

  if (
    validPoints.length < 2
  ) {
    context.fillStyle =
      "#64748b";

    context.font =
      `${14 * ratio}px system-ui`;

    context.fillText(
      "Ikke nok pulsdata til graf.",
      20 * ratio,
      30 * ratio
    );

    return;
  }

  const values =
    validPoints.map(point =>
      Number(point.hr)
    );

  let minimum =
    Math.min(...values) - 5;

  let maximum =
    Math.max(...values) + 5;

  if (maximum <= minimum) {
    maximum = minimum + 1;
  }

  const left = 48 * ratio;
  const right = 16 * ratio;
  const top = 18 * ratio;
  const bottom = 24 * ratio;

  const width =
    canvas.width -
    left -
    right;

  const height =
    canvas.height -
    top -
    bottom;

  const firstTime =
    Number(validPoints[0].ts);

  const lastTime =
    Number(
      validPoints[
        validPoints.length - 1
      ].ts
    );

  const duration =
    Math.max(
      1,
      lastTime - firstTime
    );

  const xFor = point =>
    left +
    (
      (
        Number(point.ts) -
        firstTime
      ) / duration
    ) *
    width;

  const yFor = point =>
    top +
    (
      1 -
      (
        Number(point.hr) -
        minimum
      ) /
      (
        maximum -
        minimum
      )
    ) *
    height;

  context.strokeStyle =
    "#e2e8f0";

  context.lineWidth = ratio;

  context.strokeRect(
    left,
    top,
    width,
    height
  );

  context.beginPath();

  validPoints.forEach(
    (point, index) => {
      const x = xFor(point);
      const y = yFor(point);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
  );

  context.strokeStyle =
    "#ef4444";

  context.lineWidth =
    2 * ratio;

  context.stroke();
}

function renderResults() {
  SESSION = pickSession();

  const noSession =
    document.getElementById(
      "no-session"
    );

  if (
    !SESSION ||
    !Array.isArray(
      SESSION.points
    ) ||
    !SESSION.points.length
  ) {
    noSession?.classList.remove(
      "hidden"
    );

    return;
  }

  noSession?.classList.add(
    "hidden"
  );

  const notes =
    document.getElementById(
      "notes"
    );

  if (notes) {
    notes.value =
      SESSION.notes || "";
  }

  renderSummary(SESSION);
  renderChart(SESSION);
  wireButtons();
}

document.addEventListener(
  "DOMContentLoaded",
  renderResults
);

window.addEventListener(
  "intz:viewchange",
  event => {
    if (
      event.detail?.view ===
      "results"
    ) {
      renderResults();
    }
  }
);

window.addEventListener(
  "resize",
  () => {
    if (SESSION) {
      renderChart(SESSION);
    }
  }
);