const thoughtInput = document.getElementById("thought-input");
const colorPalette = document.getElementById("color-palette");
const dropBtn = document.getElementById("drop-btn");
const board = document.getElementById("board");
const storageStatus = document.getElementById("storage-status");

const NOTE_LIFESPAN_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const EXPIRY_CHECK_INTERVAL_MS = 1000;
const EXPIRY_FADE_DURATION_MS = 500;
const RESIZE_SAVE_DEBOUNCE_MS = 180;
const STORAGE_KEY = "float.state.v1";
const STORAGE_VERSION = 1;
const NOTE_COLORS = new Set(["yellow", "lavender", "blue", "mint", "peach", "rose"]);
const thoughts = [];
const editingDrafts = new Map();
const expiringThoughtIds = new Set();
const expiryRemovalTimers = new Map();
const cardResizeObservers = new Map();

const isExpired = (note, now = Date.now()) => now >= note.expiresAt;

const setStorageStatus = (message) => {
  storageStatus.textContent = message;
  storageStatus.hidden = message === "";
};

const getSelectedColor = () =>
  colorPalette.querySelector('input[name="note-color"]:checked').value;

const formatRemainingTime = (expiresAt, now = Date.now()) => {
  const remainingMs = expiresAt - now;
  if (remainingMs <= 0) {
    return "Expiring";
  }

  const remainingHours = Math.floor(remainingMs / HOUR_MS);
  if (remainingHours > 0) {
    return `${remainingHours}h left`;
  }

  const remainingMinutes = Math.floor(remainingMs / MINUTE_MS);
  return remainingMinutes > 0 ? `${remainingMinutes}m left` : "Less than a minute";
};

const isValidStoredNote = (note) =>
  note !== null &&
  typeof note === "object" &&
  !Array.isArray(note) &&
  typeof note.id === "string" &&
  note.id.length > 0 &&
  typeof note.text === "string" &&
  note.text.trim().length > 0 &&
  NOTE_COLORS.has(note.color) &&
  typeof note.completed === "boolean" &&
  Number.isSafeInteger(note.createdAt) &&
  Number.isSafeInteger(note.expiresAt) &&
  note.expiresAt === note.createdAt + NOTE_LIFESPAN_MS &&
  (note.width === undefined ||
    (Number.isSafeInteger(note.width) && note.width >= 80 && note.width <= 2000)) &&
  (note.height === undefined ||
    (Number.isSafeInteger(note.height) && note.height >= 100 && note.height <= 1600));

const isValidStoredState = (state) => {
  if (
    state === null ||
    typeof state !== "object" ||
    Array.isArray(state) ||
    state.version !== STORAGE_VERSION ||
    !Array.isArray(state.notes) ||
    !NOTE_COLORS.has(state.selectedColor) ||
    !state.notes.every(isValidStoredNote)
  ) {
    return false;
  }

  const ids = state.notes.map((note) => note.id);
  return new Set(ids).size === ids.length;
};

const clearInvalidStoredState = (message) => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    message += " Browser storage could not be cleared.";
  }

  setStorageStatus(message);
};

const loadState = () => {
  let serializedState;

  try {
    serializedState = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    setStorageStatus("Browser storage is unavailable; notes may not persist.");
    return;
  }

  if (serializedState === null) {
    return;
  }

  let state;
  try {
    state = JSON.parse(serializedState);
  } catch {
    clearInvalidStoredState("Saved notes were unreadable and have been cleared.");
    return;
  }

  if (!isValidStoredState(state)) {
    clearInvalidStoredState("Saved notes were invalid and have been cleared.");
    return;
  }

  for (const note of state.notes) {
    thoughts.push(note);
  }
  colorPalette.querySelector(`input[name="note-color"][value="${state.selectedColor}"]`).checked =
    true;
};

const saveState = () => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        notes: thoughts,
        selectedColor: getSelectedColor()
      })
    );
    setStorageStatus("");
  } catch {
    setStorageStatus("Couldn't save changes; browser storage may be full or unavailable.");
  }
};

let resizeSaveTimerId;

const scheduleResizeSave = () => {
  window.clearTimeout(resizeSaveTimerId);
  resizeSaveTimerId = window.setTimeout(() => {
    resizeSaveTimerId = undefined;
    saveState();
  }, RESIZE_SAVE_DEBOUNCE_MS);
};

const flushResizeSave = () => {
  if (resizeSaveTimerId === undefined) {
    return;
  }

  window.clearTimeout(resizeSaveTimerId);
  resizeSaveTimerId = undefined;
  saveState();
};

const getNoteCard = (noteId) =>
  Array.from(board.querySelectorAll(".card")).find((card) => card.dataset.noteId === noteId);

const disconnectCardResizeObserver = (noteId) => {
  const registration = cardResizeObservers.get(noteId);
  if (!registration) {
    return;
  }

  registration.observer.disconnect();
  registration.card.removeEventListener("pointerdown", registration.onPointerDown);
  window.removeEventListener("pointerup", registration.onPointerEnd);
  window.removeEventListener("pointercancel", registration.onPointerEnd);
  cardResizeObservers.delete(noteId);
};

const observeCardSize = (card, note) => {
  if (typeof ResizeObserver === "undefined") {
    return;
  }

  let isInitialObservation = true;
  let isResizeGestureActive = false;
  const saveMeasuredSize = () => {
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    if (note.width === width && note.height === height) {
      return;
    }

    note.width = width;
    note.height = height;
    scheduleResizeSave();
  };
  const onPointerDown = (event) => {
    const bounds = card.getBoundingClientRect();
    isResizeGestureActive =
      event.clientX >= bounds.right - 18 && event.clientY >= bounds.bottom - 18;
  };
  const onPointerEnd = () => {
    if (!isResizeGestureActive) {
      return;
    }

    isResizeGestureActive = false;
    window.requestAnimationFrame(() => window.requestAnimationFrame(saveMeasuredSize));
  };
  const observer = new ResizeObserver(() => {
    if (isInitialObservation) {
      isInitialObservation = false;
      return;
    }

    if (isResizeGestureActive) {
      saveMeasuredSize();
    }
  });

  card.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  observer.observe(card);
  cardResizeObservers.set(note.id, {
    card,
    observer,
    onPointerDown,
    onPointerEnd
  });
};

const finishNoteExpiry = (noteId) => {
  if (!expiringThoughtIds.has(noteId)) {
    return;
  }

  window.clearTimeout(expiryRemovalTimers.get(noteId));
  expiryRemovalTimers.delete(noteId);
  expiringThoughtIds.delete(noteId);

  const noteIndex = thoughts.findIndex((note) => note.id === noteId);
  if (noteIndex === -1) {
    return;
  }

  thoughts.splice(noteIndex, 1);
  editingDrafts.delete(noteId);
  disconnectCardResizeObserver(noteId);
  getNoteCard(noteId)?.remove();
  saveState();
  renderBoard();
};

const detectExpiredThoughts = () => {
  for (const note of thoughts) {
    if (!isExpired(note) || expiringThoughtIds.has(note.id)) {
      continue;
    }

    expiringThoughtIds.add(note.id);
    const card = getNoteCard(note.id);

    if (card) {
      card.classList.add("expiring");
      card.addEventListener("animationend", (event) => {
        if (event.target === card && event.animationName === "note-expiry") {
          finishNoteExpiry(note.id);
        }
      });
    }

    expiryRemovalTimers.set(
      note.id,
      window.setTimeout(() => finishNoteExpiry(note.id), EXPIRY_FADE_DURATION_MS + 100)
    );
  }

  const now = Date.now();
  for (const note of thoughts) {
    if (expiringThoughtIds.has(note.id)) {
      continue;
    }

    const card = getNoteCard(note.id);
    if (!card) {
      continue;
    }

    card.querySelector(".card-meta").textContent = formatRemainingTime(note.expiresAt, now);
    card.classList.toggle("near-expiry", note.expiresAt - now <= HOUR_MS);
  }
};

const purgeExpiredThoughts = () => {
  const activeThoughts = thoughts.filter((note) => !isExpired(note));

  if (activeThoughts.length === thoughts.length) {
    return;
  }

  thoughts.length = 0;
  for (const note of activeThoughts) {
    thoughts.push(note);
  }
  saveState();
};

const createButton = (label, action) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  return button;
};

const createEmptyState = () => {
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";

  const icon = document.createElement("div");
  icon.className = "empty-icon";
  icon.textContent = "💭";

  const heading = document.createElement("h2");
  heading.textContent = "Nothing here yet!";

  const message = document.createElement("p");
  message.textContent = "Drop your thoughts here. You will thank yourself later!";

  emptyState.append(icon, heading, message);
  return emptyState;
};

const createTearLayer = () => {
  const layer = document.createElement("div");
  layer.className = "tear-layer";
  layer.setAttribute("aria-hidden", "true");

  const topHalf = document.createElement("span");
  topHalf.className = "tear-half tear-half-top";

  const bottomHalf = document.createElement("span");
  bottomHalf.className = "tear-half tear-half-bottom";

  layer.append(topHalf, bottomHalf);
  return layer;
};

const createNoteCard = (note) => {
  const card = document.createElement("article");
  card.className = "card entering";
  card.dataset.color = note.color;
  card.dataset.noteId = note.id;
  card.appendChild(createTearLayer());
  if (note.width !== undefined) {
    card.style.width = `${note.width}px`;
  }
  if (note.height !== undefined) {
    card.style.height = `${note.height}px`;
  }
  card.addEventListener("animationend", (event) => {
    if (event.target === card && event.animationName === "note-enter") {
      card.classList.remove("entering");
    }
  });

  if (note.completed) {
    card.classList.add("completed");
  }

  const toolbar = document.createElement("div");
  toolbar.className = "note-toolbar";

  const completionLabel = document.createElement("label");
  completionLabel.className = "completion-control";

  const completionToggle = document.createElement("input");
  completionToggle.type = "checkbox";
  completionToggle.checked = note.completed;
  completionToggle.addEventListener("change", () => {
    note.completed = completionToggle.checked;
    card.classList.toggle("completed", note.completed);
    saveState();
  });

  completionLabel.append(completionToggle, document.createTextNode("Completed"));
  toolbar.appendChild(completionLabel);

  const actions = document.createElement("div");
  actions.className = "note-actions";

  const editing = editingDrafts.has(note.id);

  if (editing) {
    const editor = document.createElement("textarea");
    editor.className = "card-editor";
    editor.value = editingDrafts.get(note.id);
    editor.setAttribute("aria-label", "Edit note");
    editor.required = true;

    const validation = document.createElement("span");
    validation.className = "edit-validation";
    validation.setAttribute("aria-live", "polite");

    const saveButton = createButton("Save", "save");
    saveButton.disabled = editor.value.trim() === "";

    editor.addEventListener("input", () => {
      editingDrafts.set(note.id, editor.value);
      saveButton.disabled = editor.value.trim() === "";
      validation.textContent = saveButton.disabled ? "A note cannot be empty." : "";
    });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelButton.click();
      }
    });

    saveButton.addEventListener("click", () => {
      const updatedText = editor.value.trim();
      if (updatedText === "") {
        validation.textContent = "A note cannot be empty.";
        editor.focus();
        return;
      }

      note.text = updatedText;
      editingDrafts.delete(note.id);
      saveState();
      replaceNoteCard(card, note);
    });

    const cancelButton = createButton("Cancel", "cancel");
    cancelButton.addEventListener("click", () => {
      editingDrafts.delete(note.id);
      replaceNoteCard(card, note);
    });

    actions.append(saveButton, cancelButton);
    card.append(editor, validation);

    queueMicrotask(() => {
      if (editor.isConnected) {
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }
    });
  } else {
    const text = document.createElement("p");
    text.className = "card-text";
    text.textContent = note.text;
    card.appendChild(text);

    const editButton = createButton("Edit", "edit");
    editButton.addEventListener("click", () => {
      editingDrafts.set(note.id, note.text);
      replaceNoteCard(card, note);
    });

    actions.appendChild(editButton);
  }

  const copyButton = createButton("Copy", "copy");
  copyButton.addEventListener("click", async () => {
    const feedback = card.querySelector(".copy-feedback");

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      feedback.textContent = "Copy is unavailable. Check your browser's clipboard permissions.";
      return;
    }

    try {
      await navigator.clipboard.writeText(note.text);
      feedback.textContent = "Copied to clipboard.";
    } catch {
      feedback.textContent = "Copy failed. Check clipboard permissions and try again.";
    }
  });
  actions.appendChild(copyButton);
  toolbar.appendChild(actions);

  const meta = document.createElement("span");
  meta.className = "card-meta";
  meta.textContent = formatRemainingTime(note.expiresAt);

  const feedback = document.createElement("span");
  feedback.className = "copy-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");

  card.prepend(toolbar);
  card.append(meta, feedback);
  return card;
};

const replaceNoteCard = (card, note) => {
  disconnectCardResizeObserver(note.id);
  const replacement = createNoteCard(note);
  card.replaceWith(replacement);
  observeCardSize(replacement, note);
};

const renderBoard = () => {
  const visibleThoughts = thoughts.filter((note) => !expiringThoughtIds.has(note.id));
  const noteIds = new Set(thoughts.map((note) => note.id));

  for (const card of board.querySelectorAll(".card")) {
    if (!noteIds.has(card.dataset.noteId)) {
      disconnectCardResizeObserver(card.dataset.noteId);
      card.remove();
    }
  }

  const renderedIds = new Set(
    Array.from(board.querySelectorAll(".card"), (card) => card.dataset.noteId)
  );

  for (const item of visibleThoughts) {
    if (!renderedIds.has(item.id)) {
      const card = createNoteCard(item);
      board.appendChild(card);
      observeCardSize(card, item);
    }
  }

  const emptyState = board.querySelector(".empty-state");
  if (visibleThoughts.length === 0 && expiringThoughtIds.size === 0 && !emptyState) {
    board.appendChild(createEmptyState());
  } else if ((visibleThoughts.length > 0 || expiringThoughtIds.size > 0) && emptyState) {
    emptyState.remove();
  }
};

const drop = () => {
  const cleanText = thoughtInput.value.trim();

  if (cleanText === "") {
    return;
  }

  detectExpiredThoughts();
  const createdAt = Date.now();
  thoughts.push({
    id: crypto.randomUUID(),
    text: cleanText,
    color: getSelectedColor(),
    completed: false,
    createdAt,
    expiresAt: createdAt + NOTE_LIFESPAN_MS
  });

  thoughtInput.value = "";
  saveState();
  renderBoard();
};

let expiryIntervalId;

const startExpiryChecks = () => {
  detectExpiredThoughts();

  if (expiryIntervalId === undefined) {
    expiryIntervalId = window.setInterval(detectExpiredThoughts, EXPIRY_CHECK_INTERVAL_MS);
  }
};

const stopExpiryChecks = () => {
  if (expiryIntervalId === undefined) {
    return;
  }

  window.clearInterval(expiryIntervalId);
  expiryIntervalId = undefined;
};

dropBtn.addEventListener("click", drop);
thoughtInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    drop();
  }
});
colorPalette.addEventListener("change", saveState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    detectExpiredThoughts();
  }
});
window.addEventListener("pagehide", () => {
  stopExpiryChecks();
  flushResizeSave();
});
window.addEventListener("pageshow", startExpiryChecks);
loadState();
purgeExpiredThoughts();
renderBoard();
startExpiryChecks();
