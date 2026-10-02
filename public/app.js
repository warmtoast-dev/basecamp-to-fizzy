const $ = (id) => document.getElementById(id);
const state = { cardTables: [] };

function setProgress(active) {
  $("progress")?.classList.toggle("active", active);
}

function celebrate() {
  const colors = ["#1b9e5a", "#f5c542", "#2563eb", "#e76f51", "#9b5de5"];
  const count = 90;

  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = 45 + Math.random() * 10 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--x", (Math.random() - 0.5) * 500 + "px");
    piece.style.setProperty("--r", (Math.random() - 0.5) * 720 + "deg");
    piece.style.setProperty("--delay", Math.random() * 0.18 + "s");
    piece.style.setProperty("--duration", 0.9 + Math.random() * 0.7 + "s");
    document.body.appendChild(piece);

    piece.addEventListener("animationend", () => piece.remove(), {
      once: true
    });
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      "Server returned invalid JSON (" +
      response.status +
      " " +
      response.statusText +
      ") from " +
      path +
      ": " +
      text.slice(0, 200)
    );
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      "Request failed (" + response.status + " " + response.statusText + ")"
    );
    error.status = response.status;
    throw error;
  }

  if (data === null) {
    throw new Error(
      "Server returned an empty response (" +
      response.status +
      " " +
      response.statusText +
      ") from " +
      path
    );
  }

  return data;
}

function show(id) {
  ["start", "workspace", "done"].forEach((name) =>
    $(name).classList.toggle("hidden", name !== id)
  );
}

async function loadCardTables() {
  show("workspace");
  setProgress(true);

  // Use the original Basecamp request flow, but load projects one at a time.
  // This avoids firing a request for every project simultaneously.
  const projects = await api("/api/projects");

  state.cardTables = [];
  $("cardTable").innerHTML = '<option value="">Loading Card Tables…</option>';
  $("import").disabled = true;

  for (const project of projects) {
    const tables = await api(
      "/api/projects/" + project.id + "/card-tables"
    );

    for (const table of tables) {
      state.cardTables.push({
        ...table,
        projectName: project.name
      });
    }
  }

  $("cardTable").innerHTML = state.cardTables.length
    ? state.cardTables
        .map((table) =>
          '<option value="' + table.id + '">' +
          escapeHtml(table.projectName + " — " + (table.title || table.name)) +
          "</option>"
        )
        .join("")
    : '<option value="">No Card Tables found</option>';

  $("import").disabled = !state.cardTables.length;
  setProgress(false);
}

function showAuthentication(errorMessage = "") {
  show("start");

  const existing = $("start").querySelector(".auth-message");
  if (existing) existing.remove();

  if (errorMessage) {
    const message = document.createElement("p");
    message.className = "auth-message";
    message.textContent = errorMessage;
    $("start").insertBefore(message, $("start").querySelector(".button"));
  }
}

async function init() {
  try {
    const session = await api("/api/session");

    if (!session.authenticated) {
      showAuthentication();
      return;
    }

    await loadCardTables();
  } catch (error) {
    setProgress(false);
    console.error(error);

    if (error.status === 401) {
      showAuthentication("Your Basecamp session has expired. Please reconnect.");
      return;
    }

    alert(error.message);
  }
}

async function importSelected() {
  const cardTableId = $("cardTable").value;
  if (!cardTableId) return;

  const button = $("import");
  button.disabled = true;
  button.textContent = "Importing…";
  setProgress(true);

  try {
    const data = await api("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardTableId })
    });

    show("done");
    setProgress(false);
    celebrate();

    $("result").innerHTML =
      "<strong>" + data.cardsCreated + " cards imported.</strong> " +
      '<a href="' + escapeHtml(data.boardUrl) +
      '" target="_blank" rel="noreferrer">Open the new Fizzy board →</a>';
  } catch (error) {
    setProgress(false);

    if (error.status === 401) {
      showAuthentication("Your Basecamp session has expired. Please reconnect.");
      return;
    }

    button.disabled = false;
    button.textContent = "Import to Fizzy";
    alert(error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("import")?.addEventListener("click", importSelected);

init();
