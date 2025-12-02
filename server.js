const express = require('express');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const fallback = {
      questions: [],
      questionInterval: 2,
      bestQuestionScore: 0
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(fallback, null, 2));
  }
}

function readDatabase() {
  ensureDatabase();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/state', (req, res) => {
  try {
    const data = readDatabase();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load data.' });
  }
});

app.post('/api/questions', (req, res) => {
  const { text, options, correctIndex } = req.body;
  if (!text || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Question text and at least two options are required.' });
  }
  if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex >= options.length) {
    return res.status(400).json({ error: 'Valid correctIndex is required.' });
  }

  const data = readDatabase();
  const question = { id: nanoid(), text, options, correctIndex };
  data.questions.push(question);
  writeDatabase(data);
  res.status(201).json(question);
});

app.post('/api/config', (req, res) => {
  const { questionInterval } = req.body;
  const parsedInterval = Number(questionInterval);
  if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
    return res.status(400).json({ error: 'questionInterval must be an integer of at least 1.' });
  }
  const data = readDatabase();
  data.questionInterval = parsedInterval;
  writeDatabase(data);
  res.json({ questionInterval: data.questionInterval });
});

app.post('/api/best-score', (req, res) => {
  const { score } = req.body;
  const parsedScore = Number(score);
  if (!Number.isInteger(parsedScore) || parsedScore < 0) {
    return res.status(400).json({ error: 'Score must be a non-negative integer.' });
  }
  const data = readDatabase();
  if (parsedScore > data.bestQuestionScore) {
    data.bestQuestionScore = parsedScore;
    writeDatabase(data);
  }
  res.json({ bestQuestionScore: data.bestQuestionScore });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
