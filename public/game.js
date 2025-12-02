const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const playButton = document.getElementById('playButton');
const pipeScoreEl = document.getElementById('pipeScore');
const questionScoreEl = document.getElementById('questionScore');
const bestScoreEl = document.getElementById('bestScore');
const overlay = document.getElementById('overlay');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const optionsEl = document.getElementById('options');
const feedbackEl = document.getElementById('feedback');
const closeQuestion = document.getElementById('closeQuestion');
const gameOverCard = document.getElementById('gameOverCard');
const finalPipesEl = document.getElementById('finalPipes');
const finalQuestionScoreEl = document.getElementById('finalQuestionScore');
const historyEl = document.getElementById('history');
const restartButton = document.getElementById('restart');
const intervalInput = document.getElementById('intervalInput');
const intervalSave = document.getElementById('intervalSave');
const addQuestionButton = document.getElementById('addQuestion');
const questionModal = document.getElementById('questionModal');
const qText = document.getElementById('qText');
const qOptions = document.getElementById('qOptions');
const qCorrect = document.getElementById('qCorrect');
const saveQuestion = document.getElementById('saveQuestion');
const saveQuestionAgain = document.getElementById('saveQuestionAgain');
const cancelQuestion = document.getElementById('cancelQuestion');
const modalError = document.getElementById('modalError');

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
  questionScore: 0,
  bestQuestionScore: 0,
  questionInterval: 2,
  answered: [],
  timeSinceLastPipe: 0,
  askPending: false,
  pausedForQuestion: false
};

let questions = [];
let animationId = null;

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
  pipeScoreEl.textContent = '0';
  questionScoreEl.textContent = '0';
  overlay.classList.add('hidden');
  questionCard.classList.remove('hidden');
  gameOverCard.classList.add('hidden');
  startScreen.classList.remove('hidden');
  cancelAnimationFrame(animationId);
  drawScene();
}

async function loadState() {
  const res = await fetch('/api/state');
  const data = await res.json();
  questions = data.questions;
  gameState.questionInterval = data.questionInterval;
  gameState.bestQuestionScore = data.bestQuestionScore;
  intervalInput.value = data.questionInterval;
  bestScoreEl.textContent = data.bestQuestionScore;
}

async function refreshQuestions() {
  const res = await fetch('/api/state');
  const data = await res.json();
  questions = data.questions;
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
  gameState.running = true;
  gameState.pausedForQuestion = false;
  loop.lastTime = null;
  animationId = requestAnimationFrame(loop);
}

function showQuestion() {
  if (!questions.length) return;
  gameState.pausedForQuestion = true;
  overlay.classList.remove('hidden');
  questionCard.classList.remove('hidden');
  gameOverCard.classList.add('hidden');
  const pick = questions[Math.floor(Math.random() * questions.length)];
  questionText.textContent = pick.text;
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  optionsEl.innerHTML = '';
  pick.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `${idx}. ${opt}`;
    btn.addEventListener('click', () => answerQuestion(pick, idx));
    optionsEl.appendChild(btn);
  });
}

function answerQuestion(question, choiceIdx) {
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
      saveBestScore(gameState.bestQuestionScore);
    }
  }
}

function hideQuestion() {
  overlay.classList.add('hidden');
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  gameState.pausedForQuestion = false;
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
      row.innerHTML = `<strong>${entry.question}</strong><br>Selected: ${entry.selected} | Correct: ${entry.correct}`;
      row.className = entry.isCorrect ? 'correct' : 'incorrect';
      historyEl.appendChild(row);
    });
  }
  saveBestScore(gameState.questionScore);
}

async function saveBestScore(score) {
  await fetch('/api/best-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score })
  });
}

async function saveInterval() {
  const value = Number(intervalInput.value);
  if (!Number.isInteger(value) || value < 1) return;
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionInterval: value })
  });
  const data = await res.json();
  gameState.questionInterval = data.questionInterval;
}

function openModal() {
  questionModal.classList.remove('hidden');
  qText.value = '';
  qOptions.value = '';
  qCorrect.value = '0';
  modalError.textContent = '';
}

function closeModal() {
  questionModal.classList.add('hidden');
}

async function submitQuestion(closeAfter = true) {
  const text = qText.value.trim();
  const opts = qOptions.value.split(',').map(o => o.trim()).filter(Boolean);
  const correctIndex = Number(qCorrect.value);
  if (!text || opts.length < 2) {
    modalError.textContent = 'Provide a prompt and at least two options.';
    return;
  }
  if (correctIndex < 0 || correctIndex >= opts.length) {
    modalError.textContent = 'Correct index must point to one of the options.';
    return;
  }
  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, options: opts, correctIndex })
  });
  if (res.ok) {
    await res.json();
    await refreshQuestions();
    if (closeAfter) {
      closeModal();
    } else {
      qText.value = '';
      qOptions.value = '';
      qCorrect.value = '0';
      modalError.textContent = 'Saved! Add another question.';
    }
  } else {
    const err = await res.json();
    modalError.textContent = err.error || 'Failed to save question';
  }
}

playButton.addEventListener('click', startGame);
canvas.addEventListener('mousedown', flap);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    flap();
  }
});
closeQuestion.addEventListener('click', hideQuestion);
restartButton.addEventListener('click', resetGame);
intervalSave.addEventListener('click', saveInterval);
addQuestionButton.addEventListener('click', openModal);
saveQuestion.addEventListener('click', submitQuestion);
saveQuestionAgain.addEventListener('click', () => submitQuestion(false));
cancelQuestion.addEventListener('click', closeModal);

loadState().then(resetGame);
