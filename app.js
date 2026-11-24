const app=document.getElementById("app");
const thoughtInput = document.getElementById("thought-input");
const dropBtn = document.getElementById("drop-btn");
const board = document.getElementById("board");

const thoughts = [];

const renderBoard = () => {
  
  board.innerHTML = "";
  if(thoughts.length === 0) {
    const emptystate = document.createElement("div");
    emptystate.className = "empty-state";

    emptystate.innerHTML = `
    <div class="empty-icon">💭</div>
    <h2>Nothing here yet!</h2>
    <p>Drop your thoughts here. You will thank yourself later!</p>
    `;

    board.appendChild(emptystate);
    return;
  }
  for (const item of thoughts) {
    const card = document.createElement("div");
    card.className = "card";

    const badge = document.createElement("span");
    badge.className = `badge badge-${item.bucket}`;
    badge.textContent = item.bucket;

    const text = document.createElement("p");
    text.className = "card-text";
    text.textContent = item.text;

    const meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent = item.createdAt;

    card.appendChild(badge);
    card.appendChild(text);
    card.appendChild(meta);

    board.appendChild(card);
  }
};


const drop = () => {
  const cleanText = thoughtInput.value.trim();
  if (cleanText === "") {
    return;
  }

  thoughts.push({ text: cleanText, bucket: "inbox" });
  thoughtInput.value = "";
  renderBoard();
};

dropBtn.addEventListener("click", drop);
renderBoard();