/* Difficulty configuration.
 *
 * Two orthogonal axes: grid size (4 or 5) and a named level (0-4). Each
 * (gridSize, level) pair maps to a { reveal, minSteps } puzzle-generation
 * config. "Auto" mode derives both axes from a single running score;
 * "Manual" mode lets the player pick either axis directly via Settings.
 *
 * Reveal-count vs. required-reasoning-depth is NOT monotonic: push reveals
 * too low and puzzles mostly stop being solvable at all, and the rare ones
 * that *are* solvable tend to be accidentally simple (a short lucky chain),
 * not hard. Empirically (see js/engine.js solvePuzzle), average forced-single
 * chain length peaks at a mid-range reveal count and falls off on both
 * sides. So difficulty climbs by narrowing toward that peak band, then (for
 * the hardest levels) raises minSteps to bias generation toward the longer
 * chains that still occur within that band, rather than continuing to strip
 * reveals below it. All reveal/minSteps values below were empirically
 * measured, not guessed — see conversation history / dev notes for the
 * measurement script.
 */

const LEVEL_LABELS = ["Easy", "Moderate", "Challenging", "Hard", "Expert"];

const PRESETS = {
  4: [
    { reveal: [11, 13], minSteps: 1 },
    { reveal: [9, 10], minSteps: 2 },
    { reveal: [7, 8], minSteps: 3 },
    { reveal: [5, 6], minSteps: 4 },
    { reveal: [5, 6], minSteps: 6 },
  ],
  5: [
    { reveal: [16, 18], minSteps: 1 },
    { reveal: [13, 15], minSteps: 3 },
    { reveal: [11, 13], minSteps: 4 },
    { reveal: [9, 11], minSteps: 5 },
    { reveal: [8, 9], minSteps: 9 },
  ],
};

function presetFor(n, levelIndex) {
  const preset = PRESETS[n][levelIndex];
  return { n, levelIndex, reveal: preset.reveal, minSteps: preset.minSteps, label: `${LEVEL_LABELS[levelIndex]} (${n}x${n})` };
}

/* Auto mode walks through both grid sizes' levels in order, gaining one
   step every 3 score points. */
const AUTO_PROGRESSION = [
  { minScore: 0, n: 4, levelIndex: 0 },
  { minScore: 3, n: 4, levelIndex: 1 },
  { minScore: 6, n: 4, levelIndex: 2 },
  { minScore: 9, n: 4, levelIndex: 3 },
  { minScore: 12, n: 4, levelIndex: 4 },
  { minScore: 15, n: 5, levelIndex: 0 },
  { minScore: 18, n: 5, levelIndex: 1 },
  { minScore: 21, n: 5, levelIndex: 2 },
  { minScore: 24, n: 5, levelIndex: 3 },
  { minScore: 27, n: 5, levelIndex: 4 },
];

function tierForScore(score) {
  let entry = AUTO_PROGRESSION[0];
  for (const e of AUTO_PROGRESSION) {
    if (score >= e.minScore) entry = e;
  }
  return presetFor(entry.n, entry.levelIndex);
}

/** Resolves the config to actually generate a puzzle with, given app state. */
function resolveDifficulty(state) {
  if (state.difficultyMode === "manual") {
    return presetFor(state.manualGridSize, state.manualLevel);
  }
  return tierForScore(state.score);
}

const STORAGE_KEY = "deductive-reasoning-practice:state";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.score !== "number") return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* ignore persistence failures (e.g. private browsing) */
  }
}
