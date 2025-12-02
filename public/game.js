const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const playButton = document.getElementById('playButton');
const pipeScoreEl = document.getElementById('pipeScore');
const bestPipesEl = document.getElementById('bestPipes');
const questionScoreEl = document.getElementById('questionScore');
const bestScoreEl = document.getElementById('bestScore');
const overlay = document.getElementById('overlay');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsEl = document.getElementById('options');
const feedbackEl = document.getElementById('feedback');
const questionPause = document.getElementById('questionPause');
const resumeButton = document.getElementById('resumeButton');
const gameOverCard = document.getElementById('gameOverCard');
const finalPipesEl = document.getElementById('finalPipes');
const finalQuestionScoreEl = document.getElementById('finalQuestionScore');
const historyEl = document.getElementById('history');
const restartButton = document.getElementById('restart');
const addQuestionButton = document.getElementById('addQuestion');
const questionModal = document.getElementById('questionModal');
const qText = document.getElementById('qText');
const qOptions = document.getElementById('qOptions');
const qCorrect = document.getElementById('qCorrect');
const qInterval = document.getElementById('qInterval');
const qDifficulty = document.getElementById('qDifficulty');
const saveQuestion = document.getElementById('saveQuestion');
const saveQuestionAgain = document.getElementById('saveQuestionAgain');
const cancelQuestion = document.getElementById('cancelQuestion');
const modalError = document.getElementById('modalError');
const questionList = document.getElementById('questionList');
const closeManager = document.getElementById('closeManager');
const countdownEl = document.getElementById('countdown');

let gameState = {
  running: false,
  bird: { x: 80, y: 320, size: 28, velocity: 0 },
  gravity: 0.35,
  flap: -7.5,
  pipes: [],
  pipeSpacing: 180,
  pipeWidth: 60,
  gap: 140,
  pipeSpeed: 2.6,
  score: 0,
  bestPipeScore: 0,
  questionScore: 0,
  bestQuestionScore: 0,
  questionInterval: 2,
  difficulty: 'Easy',
  answered: [],
  timeSinceLastPipe: 0,
  askPending: false,
  pausedForQuestion: false
};

let questions = [];
let animationId = null;
let currentQuestion = null;
let waitingForResume = false;
let questionAnswered = false;
let questionPool = [];
let countdownTimer = null;
let countdownActive = false;

const difficultyPresets = {
  Relaxed: { pipeSpeed: 1.7, gap: 220, pipeSpacing: 240 },
  Easy: { pipeSpeed: 2.6, gap: 140, pipeSpacing: 180 },
  Normal: { pipeSpeed: 3.0, gap: 130, pipeSpacing: 170 },
  Hard: { pipeSpeed: 3.4, gap: 115, pipeSpacing: 165 }
};

function getCookieNumber(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match) return null;
  const value = Number(decodeURIComponent(match[1]));
  return Number.isFinite(value) ? value : null;
}

function setBestScoreCookie(score) {
  document.cookie = `bestQuestionScore=${score}; max-age=31536000; path=/`;
}

function setBestPipesCookie(score) {
  document.cookie = `bestPipeScore=${score}; max-age=31536000; path=/`;
}

function resetGame() {
  gameState.running = false;
  gameState.bird = { x: 80, y: canvas.height / 2, size: 28, velocity: 0 };
  gameState.pipes = [];
  gameState.score = 0;
  gameState.questionScore = 0;
  gameState.answered = [];
  gameState.timeSinceLastPipe = 0;
  gameState.askPending = false;
  gameState.pausedForQuestion = false;
  waitingForResume = false;
  questionAnswered = false;
  questionPool = [...questions];
  pipeScoreEl.textContent = '0';
  bestPipesEl.textContent = gameState.bestPipeScore;
  questionScoreEl.textContent = '0';
  overlay.classList.add('hidden');
  questionCard.classList.remove('hidden');
  questionPause.classList.add('hidden');
  gameOverCard.classList.add('hidden');
  startScreen.classList.remove('hidden');
  countdownEl.classList.add('hidden');
  countdownActive = false;
  cancelAnimationFrame(animationId);
  drawScene();
}

function applyDifficulty(name) {
  const preset = difficultyPresets[name] || difficultyPresets.Easy;
  gameState.pipeSpeed = preset.pipeSpeed;
  gameState.gap = preset.gap;
  gameState.pipeSpacing = preset.pipeSpacing;
  gameState.difficulty = name || 'Easy';
  if (qDifficulty) qDifficulty.value = gameState.difficulty;
}

async function loadState() {
  const res = await fetch('/api/state');
  const data = await res.json();
  questions = data.questions;
  gameState.questionInterval = data.questionInterval;
  applyDifficulty(data.difficulty || 'Easy');
  if (qInterval) qInterval.value = data.questionInterval;
  const cookieBest = getCookieNumber('bestQuestionScore');
  const best = cookieBest !== null ? Math.max(cookieBest, data.bestQuestionScore) : data.bestQuestionScore;
  gameState.bestQuestionScore = best;
  bestScoreEl.textContent = best;
  if (cookieBest === null && best > 0) {
    setBestScoreCookie(best);
  }
  if (cookieBest !== null && cookieBest > data.bestQuestionScore) {
    await saveBestScore(cookieBest);
  }
  const cookiePipes = getCookieNumber('bestPipeScore');
  const bestPipes = cookiePipes !== null ? cookiePipes : 0;
  gameState.bestPipeScore = bestPipes;
  bestPipesEl.textContent = bestPipes;
  if (cookiePipes === null && bestPipes > 0) {
    setBestPipesCookie(bestPipes);
  }
  questionPool = [...questions];
}

async function refreshQuestions(render = false) {
  const res = await fetch('/api/questions');
  const data = await res.json();
  questions = data;
  questionPool = [...questions];
  if (render) renderQuestionList();
}

function renderQuestionList() {
  if (!questionList) return;
  questionList.innerHTML = '';
  if (!questions.length) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'No questions yet. Add one below!';
    questionList.appendChild(empty);
    return;
  }

  questions.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'question-item';

    const header = document.createElement('header');
    const title = document.createElement('div');
    title.textContent = `${idx + 1}. ${q.text}`;
    header.appendChild(title);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Delete';
    removeBtn.addEventListener('click', () => deleteQuestion(q.id));
    header.appendChild(removeBtn);
    item.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const correctLabel = q.options[q.correctIndex] ?? 'N/A';
    meta.textContent = `Options: ${q.options.join(', ')} | Correct: ${correctLabel} (choice ${q.correctIndex + 1})`;
    item.appendChild(meta);

    questionList.appendChild(item);
  });
}

function drawScene() {
  ctx.fillStyle = '#4ca2f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGround();
  drawBird();
  drawPipes();
}

function drawGround() {
  ctx.fillStyle = '#5dbe6e';
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
  ctx.fillStyle = '#4d9b5b';
  for (let x = 0; x < canvas.width; x += 12) {
    ctx.fillRect(x, canvas.height - 84, 8, 8);
  }
}

function drawBird() {
  const { x, y, size } = gameState.bird;
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.fillStyle = '#f25f5c';
  ctx.fillRect(x + size / 4, y - size / 6, size / 3, size / 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + size / 6, y - size / 4, size / 3, size / 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + size / 4, y - size / 6, size / 8, size / 8);
}

function drawPipes() {
  ctx.fillStyle = '#1b8f3a';
  gameState.pipes.forEach(pipe => {
    ctx.fillRect(pipe.x, 0, gameState.pipeWidth, pipe.top);
    ctx.fillRect(pipe.x, pipe.top + gameState.gap, gameState.pipeWidth, canvas.height - (pipe.top + gameState.gap));
    ctx.fillStyle = '#0f6b2b';
    ctx.fillRect(pipe.x - 4, pipe.top - 10, gameState.pipeWidth + 8, 12);
    ctx.fillRect(pipe.x - 4, pipe.top + gameState.gap - 2, gameState.pipeWidth + 8, 12);
    ctx.fillStyle = '#1b8f3a';
  });
}

function flap() {
  if (!gameState.running) return;
  gameState.bird.velocity = gameState.flap;
}

function handleTap() {
  if (countdownActive) {
    finishCountdown(true);
    return;
  }
  if (waitingForResume) {
    resumeAfterQuestion();
    return;
  }
  flap();
}

function spawnPipe() {
  const top = 60 + Math.random() * 200;
  gameState.pipes.push({ x: canvas.width, top, scored: false });
}

function maybeSpawnPipe() {
  const last = gameState.pipes[gameState.pipes.length - 1];
  if (!last || last.x <= canvas.width - gameState.pipeSpacing) {
    spawnPipe();
  }
}

function pickQuestion() {
  if (!questions.length) return null;
  if (!questionPool.length) {
    questionPool = [...questions];
  }
  const idx = Math.floor(Math.random() * questionPool.length);
  const [next] = questionPool.splice(idx, 1);
  return next;
}

function update(delta) {
  if (!gameState.running || gameState.pausedForQuestion) return;

  maybeSpawnPipe();

  gameState.bird.velocity += gameState.gravity;
  gameState.bird.y += gameState.bird.velocity;

  gameState.pipes.forEach(pipe => {
    const speed = gameState.pipeSpeed * (delta / 16.67);
    pipe.x -= speed;
    if (!pipe.scored && pipe.x + gameState.pipeWidth < gameState.bird.x) {
      pipe.scored = true;
      gameState.score += 1;
      pipeScoreEl.textContent = gameState.score;
      if (gameState.score > gameState.bestPipeScore) {
        gameState.bestPipeScore = gameState.score;
        bestPipesEl.textContent = gameState.bestPipeScore;
        setBestPipesCookie(gameState.bestPipeScore);
      }
      if (gameState.score % gameState.questionInterval === 0) {
        gameState.askPending = true;
      }
    }
  });

  gameState.pipes = gameState.pipes.filter(pipe => pipe.x + gameState.pipeWidth > 0);

  if (gameState.bird.y + gameState.bird.size / 2 >= canvas.height - 80 || gameState.bird.y - gameState.bird.size / 2 <= 0) {
    endGame();
  }

  if (gameState.pipes.some(pipe => collides(pipe))) {
    endGame();
  }

  if (gameState.askPending) {
    gameState.askPending = false;
    showQuestion();
  }
}

function collides(pipe) {
  const b = gameState.bird;
  const withinX = b.x + b.size / 2 > pipe.x && b.x - b.size / 2 < pipe.x + gameState.pipeWidth;
  const hitTop = b.y - b.size / 2 < pipe.top;
  const hitBottom = b.y + b.size / 2 > pipe.top + gameState.gap;
  return withinX && (hitTop || hitBottom);
}

function loop(timestamp) {
  const delta = timestamp - (loop.lastTime || timestamp);
  loop.lastTime = timestamp;
  update(delta);
  drawScene();
  animationId = requestAnimationFrame(loop);
}

function startGame() {
  startScreen.classList.add('hidden');
  overlay.classList.add('hidden');
  questionPause.classList.add('hidden');
  gameState.running = true;
  gameState.pausedForQuestion = false;
  loop.lastTime = null;
  animationId = requestAnimationFrame(loop);
}

function showQuestion() {
  if (!questions.length || waitingForResume) return;
  const pick = pickQuestion();
  if (!pick) return;
  currentQuestion = pick;
  questionAnswered = false;
  gameState.pausedForQuestion = true;
  overlay.classList.remove('hidden');
  questionCard.classList.remove('hidden');
  questionPause.classList.add('hidden');
  gameOverCard.classList.add('hidden');
  questionText.textContent = pick.text;
  optionsEl.innerHTML = '';
  pick.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `${idx + 1}. ${opt}`;
    btn.addEventListener('click', () => answerQuestion(pick, idx));
    optionsEl.appendChild(btn);
  });
}

function answerQuestion(question, choiceIdx) {
  if (questionAnswered) return;
  questionAnswered = true;
  optionsEl.querySelectorAll('button').forEach(btn => btn.disabled = true);
  const correct = choiceIdx === question.correctIndex;
  const message = correct ? 'Correct' : 'Incorrect';
  feedbackEl.textContent = message;
  feedbackEl.className = correct ? 'correct' : 'incorrect';
  gameState.answered.push({ question: question.text, selected: question.options[choiceIdx], correct: question.options[question.correctIndex], isCorrect: correct });
  if (correct) {
    gameState.questionScore += 1;
    questionScoreEl.textContent = gameState.questionScore;
    if (gameState.questionScore > gameState.bestQuestionScore) {
      gameState.bestQuestionScore = gameState.questionScore;
      bestScoreEl.textContent = gameState.bestQuestionScore;
      setBestScoreCookie(gameState.bestQuestionScore);
      saveBestScore(gameState.bestQuestionScore);
    }
    launchConfetti();
  }

  pauseAfterQuestion(message, correct);
}

function pauseAfterQuestion(message) {
  waitingForResume = true;
  questionCard.classList.add('hidden');
  questionPause.classList.remove('hidden');
  feedbackEl.textContent = message;
  overlay.classList.remove('hidden');
}

function startCountdown(skip = false) {
  if (countdownTimer) clearTimeout(countdownTimer);
  if (skip) {
    finishCountdown(true);
    return;
  }
  countdownActive = true;
  countdownEl.textContent = '3';
  countdownEl.classList.remove('hidden');
  gameState.pausedForQuestion = true;
  let remaining = 3;
  const tick = () => {
    if (!countdownActive) return;
    remaining -= 1;
    if (remaining <= 0) {
      finishCountdown();
    } else {
      countdownEl.textContent = `${remaining}`;
      countdownTimer = setTimeout(tick, 1000);
    }
  };
  countdownTimer = setTimeout(tick, 1000);
}

function finishCountdown() {
  if (countdownTimer) clearTimeout(countdownTimer);
  countdownTimer = null;
  countdownActive = false;
  countdownEl.classList.add('hidden');
  gameState.pausedForQuestion = false;
}

function resumeAfterQuestion() {
  if (!waitingForResume) return;
  waitingForResume = false;
  overlay.classList.add('hidden');
  questionCard.classList.remove('hidden');
  questionPause.classList.add('hidden');
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  startCountdown();
}

function launchConfetti() {
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#ff9ff3'];
  const pieces = 30;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    piece.style.opacity = `${0.7 + Math.random() * 0.3}`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1600);
  }
}

function endGame() {
  gameState.running = false;
  overlay.classList.remove('hidden');
  questionCard.classList.add('hidden');
  gameOverCard.classList.remove('hidden');
  finalPipesEl.textContent = gameState.score;
  finalQuestionScoreEl.textContent = gameState.questionScore;
  historyEl.innerHTML = '';
  if (gameState.answered.length === 0) {
    historyEl.textContent = 'No questions answered yet.';
  } else {
    gameState.answered.forEach(entry => {
      const row = document.createElement('div');
      row.innerHTML = `<strong>${entry.question}</strong><br><span class="label">Selected:</span> ${entry.selected}<br><span class="label">Correct:</span> ${entry.correct}`;
      row.className = `history-entry ${entry.isCorrect ? 'correct' : 'incorrect'}`;
      historyEl.appendChild(row);
    });
  }
  if (gameState.score > gameState.bestPipeScore) {
    gameState.bestPipeScore = gameState.score;
    bestPipesEl.textContent = gameState.bestPipeScore;
    setBestPipesCookie(gameState.bestPipeScore);
  }
  saveBestScore(gameState.questionScore);
}

async function saveBestScore(score) {
  setBestScoreCookie(score);
  await fetch('/api/best-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score })
  });
}

async function saveConfig() {
  const value = Number(qInterval.value);
  if (!Number.isInteger(value) || value < 1) {
    modalError.textContent = 'Interval must be at least 1 pipe.';
    return false;
  }
  const chosenDifficulty = qDifficulty ? qDifficulty.value : gameState.difficulty;
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionInterval: value, difficulty: chosenDifficulty })
  });
  const data = await res.json();
  gameState.questionInterval = data.questionInterval;
  applyDifficulty(data.difficulty);
  modalError.textContent = '';
  return true;
}

async function openModal() {
  questionModal.classList.remove('hidden');
  qText.value = '';
  qOptions.value = '';
  qCorrect.value = '1';
  qInterval.value = gameState.questionInterval;
  if (qDifficulty) qDifficulty.value = gameState.difficulty;
  modalError.textContent = '';
  await refreshQuestions(true);
}

function closeModal() {
  questionModal.classList.add('hidden');
}

async function submitQuestion(closeAfter = true) {
  const text = qText.value.trim();
  const opts = qOptions.value ? qOptions.value.split(',').map(o => o.trim()).filter(Boolean) : [];
  const correctInput = Number(qCorrect.value);
  const hasQuestion = Boolean(text) || opts.length > 0;

  if (!hasQuestion) {
    const intervalSaved = await saveConfig();
    if (intervalSaved && closeAfter) closeModal();
    if (!intervalSaved) modalError.textContent = 'Enter a question or a valid interval.';
    return;
  }

  if (!text || opts.length < 2) {
    modalError.textContent = 'Provide a question and at least two options.';
    return;
  }
  const correctIndex = correctInput - 1;
  if (correctInput < 1 || correctIndex >= opts.length) {
    modalError.textContent = 'Correct option must match one of the choices.';
    return;
  }
  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, options: opts, correctIndex })
  });
  if (res.ok) {
    await res.json();
    await refreshQuestions(true);
    questionPool = [...questions];
    await saveConfig();
    if (closeAfter) {
      closeModal();
    } else {
      qText.value = '';
      qOptions.value = '';
      qCorrect.value = '1';
      modalError.textContent = 'Saved! Add another question.';
    }
  } else {
    const err = await res.json();
    modalError.textContent = err.error || 'Failed to save question';
  }
}

async function deleteQuestion(id) {
  const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await refreshQuestions(true);
  } else {
    const err = await res.json();
    modalError.textContent = err.error || 'Failed to delete question';
  }
}

playButton.addEventListener('click', startGame);
canvas.addEventListener('mousedown', handleTap);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    e.preventDefault();
    if (countdownActive) {
      finishCountdown(true);
    } else if (waitingForResume) {
      resumeAfterQuestion();
    } else {
      flap();
    }
  }
});
restartButton.addEventListener('click', resetGame);
addQuestionButton.addEventListener('click', openModal);
saveQuestion.addEventListener('click', submitQuestion);
saveQuestionAgain.addEventListener('click', () => submitQuestion(false));
cancelQuestion.addEventListener('click', closeModal);
closeManager.addEventListener('click', closeModal);
resumeButton.addEventListener('click', resumeAfterQuestion);

loadState().then(resetGame);
