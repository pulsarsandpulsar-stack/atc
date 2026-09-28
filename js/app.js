/* App wiring: state, rendering, event handling. Depends on engine.js and difficulty.js. */

const els = {
  grid: document.getElementById("grid"),
  options: document.getElementById("options"),
  feedback: document.getElementById("feedback"),
  explanation: document.getElementById("explanation"),
  explanationToggle: document.getElementById("explanation-toggle"),
  explanationBody: document.getElementById("explanation-body"),
  nextBtn: document.getElementById("next-btn"),
  statCorrect: document.getElementById("stat-correct"),
  statIncorrect: document.getElementById("stat-incorrect"),
  statStreak: document.getElementById("stat-streak"),
  statTier: document.getElementById("stat-tier"),
  statTimer: document.getElementById("stat-timer"),
  timerToggle: document.getElementById("timer-toggle"),
  themeToggle: document.getElementById("theme-toggle"),
  resetProgress: document.getElementById("reset-progress"),
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  modeSelect: document.getElementById("mode-select"),
  gridSizeSelect: document.getElementById("grid-size-select"),
  levelSelect: document.getElementById("level-select"),
  manualOnlyRows: document.querySelectorAll(".manual-only"),
};

const defaultState = {
  score: 0,
  correct: 0,
  incorrect: 0,
  streak: 0,
  theme: "light",
  timerVisible: true,
  difficultyMode: "auto",
  manualGridSize: 4,
  manualLevel: 0,
};

let state = { ...defaultState, ...(loadState() || {}) };
let currentPuzzle = null;
let answered = false;
let timerSeconds = 0;
let timerInterval = null;

function persist() {
  saveState(state);
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  els.themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
}

function updateStatsUI() {
  els.statCorrect.textContent = state.correct;
  els.statIncorrect.textContent = state.incorrect;
  els.statStreak.textContent = state.streak;
  els.statTier.textContent = resolveDifficulty(state).label;
}

function applySettingsUI() {
  els.modeSelect.value = state.difficultyMode;
  els.gridSizeSelect.value = String(state.manualGridSize);
  els.levelSelect.value = String(state.manualLevel);
  const isManual = state.difficultyMode === "manual";
  els.manualOnlyRows.forEach((row) => row.classList.toggle("hidden", !isManual));
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startTimer() {
  stopTimer();
  timerSeconds = 0;
  els.statTimer.textContent = formatTime(0);
  timerInterval = setInterval(() => {
    timerSeconds += 1;
    els.statTimer.textContent = formatTime(timerSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function renderGrid(puzzle) {
  els.grid.style.setProperty("--grid-size", puzzle.n);
  els.grid.innerHTML = "";
  for (let r = 0; r < puzzle.n; r++) {
    for (let c = 0; c < puzzle.n; c++) {
      const cell = document.createElement("div");
      const isTarget = r === puzzle.targetR && c === puzzle.targetC;
      const value = puzzle.visibleGrid[r][c];
      if (isTarget) {
        cell.className = "cell target";
        cell.innerHTML = '<span class="question-mark">?</span>';
      } else if (value !== null) {
        cell.className = "cell filled";
        cell.innerHTML = shapeSVGMarkup(value);
      } else {
        cell.className = "cell";
      }
      els.grid.appendChild(cell);
    }
  }
}

function renderOptions(puzzle) {
  els.options.innerHTML = "";
  const order = shuffled(puzzle.shapes);
  for (const shapeId of order) {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.dataset.shapeId = shapeId;
    btn.innerHTML = shapeSVGMarkup(shapeId);
    btn.addEventListener("click", () => handleAnswer(shapeId, btn));
    els.options.appendChild(btn);
  }
}

function sentenceForStep(step, isFinal) {
  const shapeName = shapeById(step.shape).name;
  const rowNum = step.r + 1;
  const colNum = step.c + 1;
  const clauses = [];
  if (step.rowCells.length) {
    const names = step.rowCells.map((cell) => shapeById(cell.shape).name).join(", ");
    clauses.push(`row ${rowNum} already has ${names}`);
  }
  if (step.colCells.length) {
    const names = step.colCells.map((cell) => shapeById(cell.shape).name).join(", ");
    clauses.push(`column ${colNum} already has ${names}`);
  }
  const setup = clauses.length ? `Since ${clauses.join(", and ")}, ` : "";
  let sentence = `${setup}only ${shapeName} can go in row ${rowNum}, column ${colNum}.`;
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  if (isFinal) {
    sentence += ` That is the square marked with the question mark, so the answer is ${shapeName}.`;
  }
  return sentence;
}

function buildExplanation(puzzle) {
  const stepByCell = new Map();
  puzzle.steps.forEach((s, i) => stepByCell.set(`${s.r},${s.c}`, i));

  const needed = new Set();
  function include(i) {
    if (needed.has(i)) return;
    needed.add(i);
    const step = puzzle.steps[i];
    [...step.rowCells, ...step.colCells].forEach((cell) => {
      const key = `${cell.r},${cell.c}`;
      if (stepByCell.has(key)) include(stepByCell.get(key));
    });
  }

  const targetIdx = puzzle.steps.findIndex((s) => s.isTarget);
  include(targetIdx);
  const ordered = [...needed].sort((a, b) => a - b);
  return ordered.map((i) => sentenceForStep(puzzle.steps[i], i === targetIdx));
}

function handleAnswer(shapeId, btn) {
  if (answered) return;
  answered = true;
  stopTimer();

  const isCorrect = shapeId === currentPuzzle.answer;
  [...els.options.children].forEach((b) => (b.disabled = true));

  if (isCorrect) {
    btn.classList.add("correct-answer");
    els.feedback.textContent = "Correct!";
    els.feedback.className = "feedback correct";
    state.correct += 1;
    state.streak += 1;
    state.score += 1;
  } else {
    btn.classList.add("wrong-answer");
    const correctBtn = [...els.options.children].find(
      (b) => b.dataset.shapeId === currentPuzzle.answer
    );
    if (correctBtn) correctBtn.classList.add("correct-answer");
    els.feedback.textContent = `Not quite — the correct answer was ${shapeById(currentPuzzle.answer).name}.`;
    els.feedback.className = "feedback incorrect";
    state.incorrect += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 1);
  }

  els.feedback.classList.remove("hidden");
  els.explanation.classList.remove("hidden");
  els.explanationBody.classList.add("hidden");
  els.explanationToggle.textContent = "Show explanation";
  els.explanationBody.innerHTML = buildExplanation(currentPuzzle)
    .map((s) => `<li>${s}</li>`)
    .join("");
  els.nextBtn.classList.remove("hidden");

  updateStatsUI();
  persist();
}

function newQuestion() {
  answered = false;
  els.feedback.classList.add("hidden");
  els.explanation.classList.add("hidden");
  els.nextBtn.classList.add("hidden");

  const tier = resolveDifficulty(state);
  currentPuzzle = generatePuzzle(tier.n, tier.reveal, tier.minSteps);
  renderGrid(currentPuzzle);
  renderOptions(currentPuzzle);
  updateStatsUI();
  startTimer();
}

function resetProgress() {
  if (!confirm("Reset your score, streak, and difficulty progress?")) return;
  state = { ...defaultState, theme: state.theme, timerVisible: state.timerVisible };
  applySettingsUI();
  persist();
  newQuestion();
}

els.themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  persist();
});

els.timerToggle.addEventListener("click", () => {
  state.timerVisible = !state.timerVisible;
  els.statTimer.style.visibility = state.timerVisible ? "visible" : "hidden";
  els.timerToggle.textContent = state.timerVisible ? "hide" : "show";
  persist();
});

els.explanationToggle.addEventListener("click", () => {
  const isHidden = els.explanationBody.classList.contains("hidden");
  els.explanationBody.classList.toggle("hidden");
  els.explanationToggle.textContent = isHidden ? "Hide explanation" : "Show explanation";
});

els.nextBtn.addEventListener("click", newQuestion);
els.resetProgress.addEventListener("click", resetProgress);

els.settingsToggle.addEventListener("click", () => {
  els.settingsPanel.classList.toggle("hidden");
});

els.modeSelect.addEventListener("change", () => {
  state.difficultyMode = els.modeSelect.value;
  applySettingsUI();
  persist();
  newQuestion();
});

els.gridSizeSelect.addEventListener("change", () => {
  state.manualGridSize = Number(els.gridSizeSelect.value);
  persist();
  if (state.difficultyMode === "manual") newQuestion();
});

els.levelSelect.addEventListener("change", () => {
  state.manualLevel = Number(els.levelSelect.value);
  persist();
  if (state.difficultyMode === "manual") newQuestion();
});

applyTheme();
applySettingsUI();
els.statTimer.style.visibility = state.timerVisible ? "visible" : "hidden";
els.timerToggle.textContent = state.timerVisible ? "hide" : "show";
updateStatsUI();
newQuestion();
