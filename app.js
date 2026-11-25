const app = document.getElementById("app");
const thoughtInput = document.getElementById("thought-input");
const dropBtn = document.getElementById("drop-btn");
const board = document.getElementById("board");

const lifespan=10*1000; 

const thoughts = [];

const renderBoard = () => {
  board.innerHTML = "";

  if (thoughts.length === 0) {
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

  for (const item of thoughts) {
    const card = document.createElement("div");
    card.className = "card";

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


const drop = () => {
  const date=Date.now();
  const cleanText = thoughtInput.value.trim();

  if (cleanText === "") {
    return;
  }

  thoughts.push({
    id:crypto.randomUUID(),
    text: cleanText,
    createdAt: date,
    color:"default",
    completed:false,
    expiresAt:date + lifespan
  });

  thoughtInput.value = "";
  renderBoard();
};

dropBtn.addEventListener("click", drop);
renderBoard();