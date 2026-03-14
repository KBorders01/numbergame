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

const STORAGE_KEY = "numbergame-highscores";
const MAX_SCORES = 10;

let secretNumber;
let guesses;
let gameOver;

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
  secretNumber = Math.floor(Math.random() * 1000000) + 1;
  guesses = 0;
  gameOver = false;
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
  if (isNaN(num) || num < 1 || num > 1000000) {
    feedback.textContent = "Please enter a number between 1 and 1,000,000.";
    return;
  }

  guesses++;
  const li = document.createElement("li");
  li.textContent = num.toLocaleString();

  if (num < secretNumber) {
    feedback.textContent = "Too low! Go higher.";
    li.className = "low";
    speak("Higher");
  } else if (num > secretNumber) {
    feedback.textContent = "Too high! Go lower.";
    li.className = "high";
    speak("Lower");
  } else {
    feedback.textContent = `You got it! The number was ${secretNumber.toLocaleString()}.`;
    li.className = "correct";
    gameOver = true;
    guessInput.disabled = true;
    submitBtn.disabled = true;
    speak("Congratulations, you win!");
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
