# Flappy Quiz

A pixel-inspired Flappy Bird clone with a quiz twist. Pass pipes to trigger multiple-choice questions, keep your streak alive, and save questions to a local JSON file for quick edits or backups.

## Features
- 1:1-style Flappy Bird controls with tap/space to flap and immediate restarts.
- Question popups after a configurable number of cleared pipes (default every 2).
- File-based storage (`data/db.json`) for questions, best question score, and the question interval.
- Add new questions in-app with a + button; questions are chosen at random.
- Start screen with a large green Play button, live HUD for pipes and question scores, and a game-over summary listing every answered question with correct answers.
- Runs on Node.js (works on Windows/macOS/Linux) with an Express server serving static assets and APIs.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open http://localhost:3000 in your browser. On Windows you can double-click `server.js` from PowerShell with `node server.js` if `node` is on your PATH.

## Customization
- Edit `data/db.json` directly or use the in-game + button to add questions.
- Adjust "Question every N pipes" in the HUD to change how often prompts appear; the value is saved back to `data/db.json`.
- High scores for question streaks are persisted in the same JSON file.

## Notes
- If you deploy or copy the project, include the `data` folder to preserve questions and best scores.
- Default assets rely only on Canvas drawing; no external art pipeline is required.
