// settings-view.js
// INTZ v10.1
//
// Supabase-konfigurasjon uten separat innlogging.
// Inneholder også:
// - automatisk synkstatus
// - fjerning av duplisert RPE-forklaring fra Innstillinger

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
    const value =
      localStorage.getItem(
        nsKey(key)
      );

    if (value != null) {
      return JSON.parse(value);
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

let cloudWired = false;

function removeSettingsRpeExplanation() {
  const settingsSection =
    document.querySelector(
      'section[data-view="settings"]'
    );

  if (!settingsSection) {
    return;
  }

  const summaries =
    settingsSection.querySelectorAll(
      "details > summary"
    );

  for (const summary of summaries) {
    if (
      summary.textContent
        .toLowerCase()
        .includes("rpe 1–10 forklart") ||
      summary.textContent
        .toLowerCase()
        .includes("rpe 1-10 forklart")
    ) {
      summary.closest(".card")
        ?.remove();
    }
  }
}

function generateSyncSecret() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {
    return (
      window.crypto.randomUUID() +
      "-" +
      window.crypto.randomUUID()
    );
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}

function createCloudIdentityUi() {
  const status =
    document.getElementById(
      "cloud-status"
    );

  if (!status) {
    return;
  }

  const card =
    status.closest(".card");

  if (
    !card ||
    document.getElementById(
      "cloud-identity"
    )
  ) {
    return;
  }

  const container =
    document.createElement("div");

  container.id =
    "cloud-identity";

  container.style.margin =
    "10px 0";

  container.innerHTML = `
    <div class="small">
      Aktiv skyprofil:
      <strong id="cloud-user-key"></strong>
    </div>

    <label
      style="
        display:grid;
        gap:4px;
        margin-top:8px
      "
    >
      <span>Privat synknøkkel</span>

      <input
        id="cloud-sync-secret"
        type="password"
        autocomplete="off"
        placeholder="Minst 12 tegn"
      />
    </label>

    <div
      style="
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:8px
      "
    >
      <button
        id="cloud-save-secret"
        class="secondary"
        type="button"
      >
        Lagre synknøkkel
      </button>

      <button
        id="cloud-generate-secret"
        class="ghost"
        type="button"
      >
        Generer ny nøkkel
      </button>

      <button
        id="cloud-show-secret"
        class="ghost"
        type="button"
      >
        Vis nøkkel
      </button>
    </div>

    <p class="small">
      Automatisk synk sender lokale endringer til skyen
      og henter øktmaler og aktivitetsoversikt.
      Komplette historiske aktiviteter hentes først når
      aktiviteten åpnes eller velges som Ghost.
    </p>
  `;

  const checkbox =
    document.getElementById(
      "cloud-enabled"
    );

  const label =
    checkbox?.closest("label");

  if (label) {
    label.insertAdjacentElement(
      "beforebegin",
      container
    );
  } else {
    card.prepend(container);
  }
}

function formatUploadResult(result) {
  return [
    `Maler opp: ${
      result.workouts_uploaded || 0
    }`,

    `Maler slettet: ${
      result.workouts_deleted || 0
    }`,

    `Økter opp: ${
      result.sessions_uploaded || 0
    }`,

    `Økter slettet: ${
      result.sessions_deleted || 0
    }`
  ].join(" · ");
}

function formatDownloadResult(result) {
  return [
    `Maler ned: ${
      result.workouts_downloaded || 0
    }`,

    `Maler oppdatert: ${
      result.workouts_replaced || 0
    }`,

    `Økter ned: ${
      result.sessions_downloaded || 0
    }`,

    `Økter oppdatert: ${
      result.sessions_replaced || 0
    }`
  ].join(" · ");
}

function formatStatus(detail) {
  if (!detail) {
    return "–";
  }

  if (detail.state === "syncing") {
    return "↻ Synkroniserer...";
  }

  if (detail.state === "synced") {
    const time =
      detail.at
        ? new Date(
            detail.at
          ).toLocaleTimeString()
        : "";

    return (
      "✓ Synkronisert" +
      (
        time
          ? " " + time
          : ""
      )
    );
  }

  if (detail.state === "offline") {
    return "○ Frakoblet. Endringer lagres lokalt.";
  }

  if (detail.state === "error") {
    return (
      "! Synkfeil: " +
      (
        detail.message ||
        "Ukjent feil"
      )
    );
  }

  return detail.message || "–";
}

function wireCloud() {
  removeSettingsRpeExplanation();
  createCloudIdentityUi();

  const checkbox =
    document.getElementById(
      "cloud-enabled"
    );

  const upButton =
    document.getElementById(
      "cloud-sync-up"
    );

  const downButton =
    document.getElementById(
      "cloud-sync-down"
    );

  const status =
    document.getElementById(
      "cloud-status"
    );

  const userDisplay =
    document.getElementById(
      "cloud-user-key"
    );

  const secretInput =
    document.getElementById(
      "cloud-sync-secret"
    );

  const saveButton =
    document.getElementById(
      "cloud-save-secret"
    );

  const generateButton =
    document.getElementById(
      "cloud-generate-secret"
    );

  const showButton =
    document.getElementById(
      "cloud-show-secret"
    );

  if (
    !checkbox ||
    !upButton ||
    !downButton ||
    !status ||
    !secretInput
  ) {
    return;
  }

  const userKey =
    String(activeUser() || "")
      .trim()
      .toLowerCase();

  if (userDisplay) {
    userDisplay.textContent =
      userKey;
  }

  secretInput.value =
    getNS(
      "cloudSyncSecret",
      ""
    );

  checkbox.checked =
    !!getNS(
      "cloudEnabled",
      false
    );

  const previousStatus =
    getNS(
      "cloudSyncStatus",
      null
    );

  status.textContent =
    previousStatus
      ? formatStatus(previousStatus)
      : (
          checkbox.checked
            ? "Automatisk synk er aktivert."
            : "Sky-synk er deaktivert."
        );

  if (cloudWired) {
    return;
  }

  cloudWired = true;

  function setStatus(message) {
    status.textContent = message;
  }

  function saveSecret() {
    const value =
      String(
        secretInput.value || ""
      ).trim();

    if (value.length < 12) {
      throw new Error(
        "Synknøkkelen må inneholde minst 12 tegn."
      );
    }

    setNS(
      "cloudSyncSecret",
      value
    );

    return value;
  }

  saveButton?.addEventListener(
    "click",
    () => {
      try {
        saveSecret();

        setStatus(
          "Synknøkkelen er lagret."
        );

        window.INTZAutoSync
          ?.requestSync(
            "secret-saved",
            true
          );
      } catch (error) {
        setStatus(
          error?.message ||
          String(error)
        );
      }
    }
  );

  generateButton?.addEventListener(
    "click",
    () => {
      const value =
        generateSyncSecret();

      secretInput.value =
        value;

      setNS(
        "cloudSyncSecret",
        value
      );

      setStatus(
        "Ny synknøkkel er generert og lagret."
      );
    }
  );

  showButton?.addEventListener(
    "click",
    () => {
      const hidden =
        secretInput.type ===
        "password";

      secretInput.type =
        hidden
          ? "text"
          : "password";

      showButton.textContent =
        hidden
          ? "Skjul nøkkel"
          : "Vis nøkkel";
    }
  );

  checkbox.addEventListener(
    "change",
    () => {
      if (checkbox.checked) {
        try {
          if (
            userKey === "default"
          ) {
            throw new Error(
              "Opprett en personlig INTZ-profil før skysynk aktiveres."
            );
          }

          saveSecret();

          setNS(
            "cloudEnabled",
            true
          );

          setStatus(
            "Automatisk synk er aktivert."
          );

          window.INTZAutoSync
            ?.requestSync(
              "cloud-enabled",
              true
            );
        } catch (error) {
          checkbox.checked = false;

          setNS(
            "cloudEnabled",
            false
          );

          setStatus(
            error?.message ||
            String(error)
          );
        }
      } else {
        setNS(
          "cloudEnabled",
          false
        );

        setStatus(
          "Sky-synk er deaktivert."
        );
      }
    }
  );

  upButton.addEventListener(
    "click",
    async () => {
      try {
        saveSecret();

        upButton.disabled = true;
        downButton.disabled = true;

        setStatus(
          "Synkroniserer lokale endringer..."
        );

        const result =
          await window.INTZCloud
            .syncUp();

        setStatus(
          "Synk opp fullført. " +
          formatUploadResult(result)
        );
      } catch (error) {
        setStatus(
          "Synk opp feilet: " +
          (
            error?.message ||
            String(error)
          )
        );
      } finally {
        upButton.disabled = false;
        downButton.disabled = false;
      }
    }
  );

  downButton.addEventListener(
    "click",
    async () => {
      try {
        saveSecret();

        upButton.disabled = true;
        downButton.disabled = true;

        setStatus(
          "Henter full historikk. Dette kan bruke mye lokal lagring..."
        );

        const result =
          await window.INTZCloud
            .syncDown();

        setStatus(
          "Full synk ned fullført. " +
          formatDownloadResult(result)
        );
      } catch (error) {
        setStatus(
          "Synk ned feilet: " +
          (
            error?.message ||
            String(error)
          )
        );
      } finally {
        upButton.disabled = false;
        downButton.disabled = false;
      }
    }
  );
}

window.addEventListener(
  "intz:sync-status",
  event => {
    const status =
      document.getElementById(
        "cloud-status"
      );

    if (status) {
      status.textContent =
        formatStatus(
          event.detail
        );
    }
  }
);

window.addEventListener(
  "intz:viewchange",
  event => {
    if (
      event.detail?.view ===
      "settings"
    ) {
      wireCloud();
    }
  }
);

document.addEventListener(
  "DOMContentLoaded",
  wireCloud
);
