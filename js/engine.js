/* Puzzle engine: shape defs, Latin-square generation, constraint-propagation solver. */

const SHAPES = [
  { id: "circle", name: "Circle", color: "#7c3aed" },
  { id: "triangle", name: "Triangle", color: "#4b9b3f" },
  { id: "square", name: "Square", color: "#d6336c" },
  { id: "cross", name: "Cross", color: "#e8720c" },
  { id: "star", name: "Star", color: "#2b9bb5" },
];

function shapeById(id) {
  return SHAPES.find((s) => s.id === id);
}

function starPoints(cx, cy, outerR, innerR, points) {
  const pts = [];
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + i * step;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function shapeSVGMarkup(shapeId) {
  const shape = shapeById(shapeId);
  const color = shape.color;
  let inner = "";
  switch (shapeId) {
    case "circle":
      inner = `<circle cx="50" cy="50" r="38" fill="${color}"/>`;
      break;
    case "square":
      inner = `<rect x="14" y="14" width="72" height="72" rx="8" fill="${color}"/>`;
      break;
    case "triangle":
      inner = `<polygon points="50,10 92,88 8,88" fill="${color}"/>`;
      break;
    case "cross":
      inner = `<path d="M38,8 H62 V38 H92 V62 H62 V92 H38 V62 H8 V38 H38 Z" fill="${color}"/>`;
      break;
    case "star":
      inner = `<polygon points="${starPoints(50, 52, 42, 17, 5)}" fill="${color}"/>`;
      break;
    default:
      inner = "";
  }
  return `<svg viewBox="0 0 100 100" class="shape-svg" role="img" aria-label="${shape.name}">${inner}</svg>`;
}

/** Fisher-Yates shuffle, returns a new array. */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Builds a randomized n x n Latin square using `n` shape ids from `shapeIdPool`.
 * grid[r][c] holds a shapeId; every row/column contains each chosen shape exactly once.
 */
function generateLatinSquare(n, shapeIdPool) {
  const chosenShapes = shuffled(shapeIdPool).slice(0, n);
  const rowOrder = shuffled([...Array(n).keys()]);
  const colOrder = shuffled([...Array(n).keys()]);
  const symbolOrder = shuffled([...Array(n).keys()]);

  const grid = Array.from({ length: n }, () => Array(n).fill(null));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const baseSymbol = (colOrder[c] + rowOrder[r]) % n;
      const shapeIndex = symbolOrder[baseSymbol];
      grid[r][c] = chosenShapes[shapeIndex];
    }
  }
  return { grid, shapes: chosenShapes };
}

function candidatesFor(known, n, shapeIds, r, c) {
  if (known[r][c] !== null) return [];
  const rowShapes = new Set(known[r]);
  const colShapes = new Set(known.map((row) => row[c]));
  return shapeIds.filter((s) => !rowShapes.has(s) && !colShapes.has(s));
}

/**
 * Constraint-propagation solver. Repeatedly fills any cell whose candidate
 * set (given currently known cells) has exactly one option. Safe because the
 * board originates from an actual valid Latin square: a forced single can
 * only equal the true value.
 */
function solvePuzzle(knownGrid, n, shapeIds, targetR, targetC) {
  const known = knownGrid.map((row) => row.slice());
  const steps = [];
  let progress = true;
  while (known[targetR][targetC] === null && progress) {
    progress = false;
    outer: for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (known[r][c] !== null) continue;
        const cands = candidatesFor(known, n, shapeIds, r, c);
        if (cands.length === 1) {
          const rowCells = [];
          for (let cc = 0; cc < n; cc++) {
            if (cc !== c && known[r][cc] !== null) rowCells.push({ r, c: cc, shape: known[r][cc] });
          }
          const colCells = [];
          for (let rr = 0; rr < n; rr++) {
            if (rr !== r && known[rr][c] !== null) colCells.push({ r: rr, c, shape: known[rr][c] });
          }
          known[r][c] = cands[0];
          steps.push({
            r,
            c,
            shape: cands[0],
            rowCells,
            colCells,
            isTarget: r === targetR && c === targetC,
          });
          progress = true;
          break outer;
        }
      }
    }
  }
  return { solved: known[targetR][targetC] !== null, steps, known };
}

/**
 * Generates a full puzzle: a solved Latin square, a target cell, and a mask
 * of which non-target cells are revealed, tuned to a reveal-count range and
 * a minimum number of deduction steps to keep difficulty consistent.
 */
function generatePuzzle(n, revealRange, minSteps) {
  const attemptsBudget = 80;
  let best = null;

  for (let attempt = 0; attempt < attemptsBudget; attempt++) {
    const { grid, shapes } = generateLatinSquare(n, SHAPES.map((s) => s.id));
    const targetR = randInt(0, n - 1);
    const targetC = randInt(0, n - 1);
    const otherCells = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (r === targetR && c === targetC) continue;
        otherCells.push([r, c]);
      }
    }
    const revealCount = Math.min(
      otherCells.length,
      randInt(revealRange[0], revealRange[1])
    );
    const revealSet = new Set(
      shuffled(otherCells)
        .slice(0, revealCount)
        .map(([r, c]) => `${r},${c}`)
    );

    const known = Array.from({ length: n }, () => Array(n).fill(null));
    for (const [r, c] of otherCells) {
      if (revealSet.has(`${r},${c}`)) known[r][c] = grid[r][c];
    }

    const result = solvePuzzle(known, n, shapes, targetR, targetC);
    if (!result.solved) continue;

    const candidate = {
      n,
      shapes,
      solutionGrid: grid,
      visibleGrid: known,
      targetR,
      targetC,
      answer: grid[targetR][targetC],
      steps: result.steps,
    };

    if (result.steps.length >= minSteps) {
      return candidate;
    }
    if (!best || result.steps.length > best.steps.length) {
      best = candidate;
    }
  }

  // Fallback: relax the reveal count until something solvable is guaranteed.
  if (best) return best;
  return generatePuzzle(n, [revealRange[0] + 1, Math.min(n * n - 1, revealRange[1] + 3)], 1);
}
