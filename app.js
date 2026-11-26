const thoughtInput = document.getElementById("thought-input");
const colorInput = document.getElementById("color-input");
const dropBtn = document.getElementById("drop-btn");
const board = document.getElementById("board");

const NOTE_LIFESPAN_MS = 24 * 60 * 60 * 1000;
const EXPIRY_CHECK_INTERVAL_MS = 1000;
const thoughts = [];

const isExpired = (note, now = Date.now()) => now >= note.expiresAt;

const renderBoard = () => {
  board.innerHTML = "";
  const activeThoughts = thoughts.filter((item) => !isExpired(item));

  if (activeThoughts.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";

    emptyState.innerHTML = `
      <div class="empty-icon">💭</div>
      <h2>Nothing here yet!</h2>
      <p>Drop your thoughts here. You will thank yourself later!</p>
    `;

    board.appendChild(emptyState);
    return;
  }

  for (const item of activeThoughts) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.color = item.color;

    const text = document.createElement("p");
    text.className = "card-text";
    text.textContent = item.text;

    const meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent = new Date(item.createdAt).toLocaleString();

    card.appendChild(text);
    card.appendChild(meta);

    board.appendChild(card);
  }
};

const removeExpiredThoughts = () => {
  const activeThoughts = thoughts.filter((item) => !isExpired(item));

  if (activeThoughts.length === thoughts.length) {
    return;
  }

  thoughts.splice(0, thoughts.length, ...activeThoughts);
  renderBoard();
};

const drop = () => {
  const cleanText = thoughtInput.value.trim();

  if (cleanText === "") {
    return;
  }

  removeExpiredThoughts();
  const createdAt = Date.now();
  thoughts.push({
    id: crypto.randomUUID(),
    text: cleanText,
    color: colorInput.value,
    completed: false,
    createdAt,
    expiresAt: createdAt + NOTE_LIFESPAN_MS
  });

  thoughtInput.value = "";
  renderBoard();
};

let expiryIntervalId;

const startExpiryChecks = () => {
  removeExpiredThoughts();

  if (expiryIntervalId === undefined) {
    expiryIntervalId = window.setInterval(removeExpiredThoughts, EXPIRY_CHECK_INTERVAL_MS);
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
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    removeExpiredThoughts();
  }
});
window.addEventListener("pagehide", stopExpiryChecks);
window.addEventListener("pageshow", startExpiryChecks);
renderBoard();
startExpiryChecks();