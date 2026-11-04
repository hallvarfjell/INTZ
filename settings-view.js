// settings-view.js
// INTZ v10.1 – Supabase-konfigurasjon uten separat innlogging.

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
    Math.random()
      .toString(36)
      .slice(2) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

function createCloudIdentityUi() {
  const cloudStatus =
    document.getElementById(
      "cloud-status"
    );

  if (!cloudStatus) {
    return;
  }

  const card =
    cloudStatus.closest(".card");

  if (!card) {
    return;
  }

  if (
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
      Bruk samme aktive profil og samme
      synknøkkel på enheter som skal dele
      maler, treningsøkter og Ghost-data.
      Oppbevar synknøkkelen privat.
    </p>
  `;

  const checkbox =
    document.getElementById(
      "cloud-enabled"
    );

  const checkboxLabel =
    checkbox?.closest("label");

  if (checkboxLabel) {
    checkboxLabel.insertAdjacentElement(
      "beforebegin",
      container
    );
  } else {
    card.prepend(container);
  }
}

function formatUploadResult(result) {
  return [
    `Maler lastet opp: ${
      result.workouts_uploaded || 0
    }`,

    `Slettede maler: ${
      result.workouts_deleted || 0
    }`,

    `Økter lastet opp: ${
      result.sessions_uploaded || 0
    }`,

    `Slettede økter: ${
      result.sessions_deleted || 0
    }`
  ].join(" · ");
}

function formatDownloadResult(result) {
  return [
    `Nye maler: ${
      result.workouts_downloaded || 0
    }`,

    `Oppdaterte maler: ${
      result.workouts_replaced || 0
    }`,

    `Slettede maler: ${
      result.workouts_deleted || 0
    }`,

    `Nye økter: ${
      result.sessions_downloaded || 0
    }`,

    `Oppdaterte økter: ${
      result.sessions_replaced || 0
    }`,

    `Slettede økter: ${
      result.sessions_deleted || 0
    }`
  ].join(" · ");
}

function wireCloud() {
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

  const userKeyDisplay =
    document.getElementById(
      "cloud-user-key"
    );

  const secretInput =
    document.getElementById(
      "cloud-sync-secret"
    );

  const saveSecretButton =
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

  if (userKeyDisplay) {
    userKeyDisplay.textContent =
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

  saveSecretButton?.addEventListener(
    "click",
    () => {
      try {
        saveSecret();

        setStatus(
          "Synknøkkelen er lagret lokalt for aktiv profil."
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
      const generated =
        generateSyncSecret();

      secretInput.value =
        generated;

      setNS(
        "cloudSyncSecret",
        generated
      );

      setStatus(
        "En ny synknøkkel er generert og lagret. Kopier nøkkelen til et sikkert sted."
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
            "Sky-synk er aktivert."
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
        if (!checkbox.checked) {
          throw new Error(
            "Aktiver sky-synk først."
          );
        }

        saveSecret();

        upButton.disabled = true;
        downButton.disabled = true;

        setStatus(
          "Synkroniserer lokale endringer til Supabase..."
        );

        const result =
          await window.INTZCloud
            .syncUp();

        setStatus(
          "Synk opp fullført. " +
          formatUploadResult(result)
        );
      } catch (error) {
        console.error(error);

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
        if (!checkbox.checked) {
          throw new Error(
            "Aktiver sky-synk først."
          );
        }

        saveSecret();

        upButton.disabled = true;
        downButton.disabled = true;

        setStatus(
          "Henter og slår sammen data fra Supabase..."
        );

        const result =
          await window.INTZCloud
            .syncDown();

        setStatus(
          "Synk ned fullført. " +
          formatDownloadResult(result)
        );
      } catch (error) {
        console.error(error);

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

  setStatus(
    checkbox.checked
      ? "Sky-synk er aktivert."
      : "Sky-synk er deaktivert."
  );
}

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