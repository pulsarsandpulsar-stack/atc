# Deductive Reasoning Practice

A browser-based practice tool modeled on Aon's "gapChallenge" deductive
reasoning assessment: figure out which shape belongs in the square marked
with `?` in a 4x4 or 5x5 grid, given that no shape repeats in any row or
column.

No build step, no dependencies — plain HTML/CSS/JS.

## Running locally

Just open `index.html` in a browser, or serve the folder with any static
server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## How it works

- `js/engine.js` — generates a valid randomized Latin-square grid, masks
  cells, and includes a constraint-propagation solver used both to validate
  that a puzzle is solvable and to produce the step-by-step explanation.
- `js/difficulty.js` — a single running score maps to a difficulty tier
  (grid size, how many cells are pre-filled, and how many deduction steps
  the puzzle should require). Correct answers raise the score; wrong
  answers lower it, so the game gets harder or easier as you play.
- `js/app.js` — renders the grid/options, handles answers, tracks stats,
  and persists progress + theme to `localStorage`.

## Hosting on GitHub Pages

```
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

Then in the repo's **Settings → Pages**, set the source to the `main`
branch, root folder. The site will be live at
`https://<username>.github.io/<repo-name>/`.
