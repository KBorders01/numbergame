const fireworksCanvas = document.getElementById("fireworks");
const ctx = fireworksCanvas.getContext("2d");
const guessInput = document.getElementById("guess");
const submitBtn = document.getElementById("submit");
const feedback = document.getElementById("feedback");
const guessCount = document.getElementById("guess-count");
const history = document.getElementById("history");
const newGameBtn = document.getElementById("new-game");
const nameEntry = document.getElementById("name-entry");
const playerNameInput = document.getElementById("player-name");
const saveScoreBtn = document.getElementById("save-score");
const highScoresDiv = document.getElementById("high-scores");
const scoreList = document.getElementById("score-list");

const numberGrid = document.getElementById("number-grid");

const STORAGE_KEY = "numbergame-highscores";
const MAX_SCORES = 10;

let secretNumber;
let guesses;
let gameOver;
let low; // current known lower bound (exclusive)
let high; // current known upper bound (exclusive)
let gridCells = [];

function buildGrid() {
  numberGrid.innerHTML = "";
  gridCells = [];
  for (let i = 1; i <= 1000; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell possible";
    cell.textContent = i;
    numberGrid.appendChild(cell);
    gridCells.push(cell);
  }
}

function updateGrid(exactNum) {
  for (let i = 0; i < 1000; i++) {
    const num = i + 1;
    if (exactNum && num === exactNum) {
      gridCells[i].className = "grid-cell exact";
    } else if (num <= low || num >= high) {
      gridCells[i].className = "grid-cell eliminated";
    } else {
      gridCells[i].className = "grid-cell possible";
    }
  }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playClick() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.06);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.08);
}

function speak(text) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 0.9;
  // Prefer a male English voice
  const voices = speechSynthesis.getVoices();
  const male = voices.find(
    (v) => v.lang.startsWith("en") && /male|david|james|daniel|george/i.test(v.name)
  );
  if (male) utterance.voice = male;
  speechSynthesis.speak(utterance);
}

// --- Fireworks ---
const FIREWORK_COLORS = [
  "#ff6b6b", "#48dbfb", "#0be881", "#f9ca24", "#e94560",
  "#a29bfe", "#fd79a8", "#ffeaa7", "#55efc4", "#74b9ff",
];

let rockets = [];
let particles = [];
let fireworksAnimId = null;
let fireworksTimeout = null;

function resizeCanvas() {
  fireworksCanvas.width = window.innerWidth;
  fireworksCanvas.height = window.innerHeight;
}

function playBoom() {
  const bufferSize = audioCtx.sampleRate * 0.4;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, audioCtx.currentTime);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

function playWhistle() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.35);
}

function launchRocket() {
  const x = Math.random() * fireworksCanvas.width * 0.8 + fireworksCanvas.width * 0.1;
  const targetY = Math.random() * fireworksCanvas.height * 0.4 + fireworksCanvas.height * 0.05;
  rockets.push({
    x,
    y: fireworksCanvas.height,
    targetY,
    speed: 6 + Math.random() * 4,
    color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
    trail: [],
  });
  playWhistle();
}

function explode(rocket) {
  const count = 60 + Math.floor(Math.random() * 40);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.01 + Math.random() * 0.015,
      color: rocket.color,
      size: 2 + Math.random() * 2,
    });
  }
  playBoom();
}

function fireworksLoop() {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
  ctx.globalCompositeOperation = "lighter";

  // Update rockets
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.trail.push({ x: r.x, y: r.y });
    if (r.trail.length > 8) r.trail.shift();
    r.y -= r.speed;

    // Draw trail
    for (let t = 0; t < r.trail.length; t++) {
      const alpha = t / r.trail.length * 0.6;
      ctx.beginPath();
      ctx.arc(r.trail[t].x, r.trail[t].y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
      ctx.fill();
    }

    // Draw rocket head
    ctx.beginPath();
    ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    if (r.y <= r.targetY) {
      explode(r);
      rockets.splice(i, 1);
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04; // gravity
    p.vx *= 0.99;
    p.life -= p.decay;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  fireworksAnimId = requestAnimationFrame(fireworksLoop);
}

function startFireworks() {
  resizeCanvas();
  fireworksCanvas.classList.add("active");
  rockets = [];
  particles = [];

  // Launch rockets in bursts over 4 seconds
  let launched = 0;
  const launchInterval = setInterval(() => {
    const burst = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burst; i++) launchRocket();
    launched++;
    if (launched >= 10) clearInterval(launchInterval);
  }, 400);

  fireworksLoop();

  // Stop after 6 seconds
  fireworksTimeout = setTimeout(stopFireworks, 6000);
}

function stopFireworks() {
  if (fireworksAnimId) {
    cancelAnimationFrame(fireworksAnimId);
    fireworksAnimId = null;
  }
  if (fireworksTimeout) {
    clearTimeout(fireworksTimeout);
    fireworksTimeout = null;
  }
  ctx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
  fireworksCanvas.classList.remove("active");
  rockets = [];
  particles = [];
}

window.addEventListener("resize", () => {
  if (fireworksCanvas.classList.contains("active")) resizeCanvas();
});

function getHighScores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHighScore(name, score) {
  const scores = getHighScores();
  scores.push({ name, score, date: Date.now() });
  scores.sort((a, b) => a.score - b.score);
  if (scores.length > MAX_SCORES) scores.length = MAX_SCORES;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  return scores;
}

function renderHighScores(highlightIndex) {
  const scores = getHighScores();
  scoreList.innerHTML = "";

  if (scores.length === 0) {
    scoreList.innerHTML = "<li>No scores yet. Be the first!</li>";
    return;
  }

  scores.forEach((entry, i) => {
    const li = document.createElement("li");
    if (i === highlightIndex) li.className = "current";

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${i + 1}`;

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = entry.name;

    const score = document.createElement("span");
    score.className = "score";
    score.textContent = `${entry.score} ${entry.score === 1 ? "guess" : "guesses"}`;

    li.append(rank, name, score);
    scoreList.appendChild(li);
  });
}

function showNameEntry() {
  nameEntry.classList.remove("hidden");
  playerNameInput.value = "";
  playerNameInput.focus();
}

function handleSaveScore() {
  const name = playerNameInput.value.trim();
  if (!name) return;

  const scores = saveHighScore(name, guesses);
  nameEntry.classList.add("hidden");

  // Find the index of the just-saved score to highlight it
  const idx = scores.findIndex(
    (s) => s.name === name && s.score === guesses
  );
  renderHighScores(idx);
}

function startGame() {
  stopFireworks();
  secretNumber = Math.floor(Math.random() * 1000) + 1;
  guesses = 0;
  gameOver = false;
  low = 0;   // exclusive: numbers <= low are eliminated
  high = 1001; // exclusive: numbers >= high are eliminated
  buildGrid();
  feedback.textContent = "";
  guessCount.textContent = "";
  history.innerHTML = "";
  guessInput.value = "";
  guessInput.disabled = false;
  submitBtn.disabled = false;
  nameEntry.classList.add("hidden");
  guessInput.focus();
  renderHighScores(-1);
}

function makeGuess() {
  if (gameOver) return;

  const value = guessInput.value.trim();
  if (!value) return;

  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > 1000) {
    feedback.textContent = "Please enter a number between 1 and 1,000.";
    return;
  }

  guesses++;
  const li = document.createElement("li");
  li.textContent = num.toLocaleString();

  if (num < secretNumber) {
    feedback.textContent = `The number is higher than ${num.toLocaleString()}.`;
    li.className = "low";
    if (num > low) low = num;
    updateGrid();
    speak(`The number is higher than ${num.toLocaleString()}`);
  } else if (num > secretNumber) {
    feedback.textContent = `The number is lower than ${num.toLocaleString()}.`;
    li.className = "high";
    if (num < high) high = num;
    updateGrid();
    speak(`The number is lower than ${num.toLocaleString()}`);
  } else {
    feedback.textContent = `You got it! The number was ${secretNumber.toLocaleString()}.`;
    li.className = "correct";
    gameOver = true;
    guessInput.disabled = true;
    submitBtn.disabled = true;
    updateGrid(num);
    speak("Congratulations, you win!");
    startFireworks();
    showNameEntry();
  }

  guessCount.textContent = `Guesses: ${guesses}`;
  history.appendChild(li);
  guessInput.value = "";
  if (!gameOver) guessInput.focus();
}

submitBtn.addEventListener("click", () => { playClick(); makeGuess(); });
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { playClick(); makeGuess(); }
});
saveScoreBtn.addEventListener("click", () => { playClick(); handleSaveScore(); });
playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { playClick(); handleSaveScore(); }
});
newGameBtn.addEventListener("click", startGame);

startGame();
