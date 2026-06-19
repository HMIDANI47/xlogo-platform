require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ALLOWED_LEVELS = ['2AC', '3AC'];
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '120kb' }));
app.use(express.urlencoded({ extended: false, limit: '120kb' }));
app.use(express.static(PUBLIC_DIR));

const dbFiles = {
  users: 'users.json',
  classes: 'classes.json',
  exercises: 'exercises.json',
  submissions: 'submissions.json'
};

const starterExercises = [
  {
    id: 'seed-2ac-carre',
    title: 'Carré simple',
    level: '2AC',
    description: 'Dessine un carré de côté 100 avec une boucle REPETE.',
    hint: 'Un carré possède 4 côtés égaux et 4 angles droits. Utilise REPETE 4 [...].',
    solution: 'REPETE 4 [AVANCE 100 DROITE 90]',
    createdBy: 'system',
    assignedTo: { type: 'all' },
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'seed-2ac-hexagone',
    title: 'Hexagone coloré',
    level: '2AC',
    description: 'Dessine un hexagone régulier en bleu avec des côtés de 60.',
    hint: 'Pour un hexagone, l’angle extérieur est 60 degrés.',
    solution: 'COULEURCRAYON bleu\nREPETE 6 [AVANCE 60 DROITE 60]',
    createdBy: 'system',
    assignedTo: { type: 'all' },
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'seed-3ac-rosace',
    title: 'Rosace',
    level: '3AC',
    description: 'Dessine une rosace composée de 12 carrés tournés autour du centre.',
    hint: 'Répète 12 fois un carré, puis tourne de 30 degrés.',
    solution: 'COULEURCRAYON violet\nREPETE 12 [REPETE 4 [AVANCE 70 DROITE 90] DROITE 30]',
    createdBy: 'system',
    assignedTo: { type: 'all' },
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'seed-3ac-flocon',
    title: 'Flocon simple',
    level: '3AC',
    description: 'Dessine un flocon simple avec 6 branches identiques.',
    hint: 'Une branche peut avancer puis revenir, ensuite tourne de 60 degrés.',
    solution: 'COULEURCRAYON cyan\nREPETE 6 [AVANCE 90 RECULE 90 DROITE 60]',
    createdBy: 'system',
    assignedTo: { type: 'all' },
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const defaults = {
    users: [],
    classes: [],
    exercises: starterExercises,
    submissions: []
  };
  for (const [key, file] of Object.entries(dbFiles)) {
    const full = path.join(DATA_DIR, file);
    try {
      await fs.access(full);
      const raw = await fs.readFile(full, 'utf8');
      JSON.parse(raw || '[]');
    } catch {
      await fs.writeFile(full, JSON.stringify(defaults[key], null, 2));
    }
  }
}

async function readDb(name) {
  const file = path.join(DATA_DIR, dbFiles[name]);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeDb(name, data) {
  const file = path.join(DATA_DIR, dbFiles[name]);
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function cleanText(value, max = 200) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, max);
}

function isValidLevel(level) {
  return ALLOWED_LEVELS.includes(String(level || '').toUpperCase());
}

function normalizeLevel(level) {
  return String(level || '').toUpperCase();
}

function requireTeacher(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || '');
  const expected = process.env.TEACHER_TOKEN || process.env.TEACHER_PASSWORD || 'admin123';
  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Accès enseignant non autorisé.' });
  }
  next();
}

function fallbackExercise(level = '2AC', history = []) {
  const bank = starterExercises.filter(e => e.level === level);
  const used = new Set((history || []).map(h => h.title));
  const candidate = bank.find(e => !used.has(e.title)) || bank[Math.floor(Math.random() * bank.length)] || starterExercises[0];
  return {
    title: candidate.title,
    description: candidate.description,
    hint: candidate.hint,
    solution: candidate.solution,
    fallback: true
  };
}

function extractJson(text) {
  if (!text) throw new Error('Réponse IA vide.');
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Réponse IA non JSON.');
    return JSON.parse(match[0]);
  }
}

async function callGemini(prompt, schema) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante dans le backend.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Erreur Gemini ${response.status}`;
    throw new Error(message);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
  return extractJson(text);
}

function localEvaluate(level, exercise, studentCode) {
  const code = String(studentCode || '').trim();
  if (!code) {
    return { score: 0, comment: 'Le code est vide. Commence par écrire quelques commandes XLOGO.', errors: ['Code vide'], improvement: 'Utilise au moins AVANCE, DROITE/GAUCHE et REPETE si la figure est répétitive.', fallback: true };
  }

  const allowed2 = ['AVANCE', 'AV', 'RECULE', 'RE', 'DROITE', 'DR', 'GAUCHE', 'GA', 'REPETE', 'COULEURCRAYON', 'CC', 'LEVECRAYON', 'LC', 'BAISSECRAYON', 'BC'];
  const allowed3 = allowed2;
  const allowed = level === '3AC' ? allowed3 : allowed2;
  const words = code.toUpperCase().match(/[A-ZÉÈÊÀÙÎÔÇ]+/g) || [];
  const errors = [];
  for (const word of words) {
    const normalized = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!allowed.includes(normalized) && !['ROUGE', 'BLEU', 'VERT', 'JAUNE', 'BLANC', 'NOIR', 'ORANGE', 'VIOLET', 'ROSE', 'CYAN', 'OR', 'TURQUOISE'].includes(normalized)) {
      errors.push(`Commande inconnue possible : ${word}`);
    }
  }
  const hasMove = /\b(AVANCE|AV|RECULE|RE)\b/i.test(code);
  const hasTurn = /\b(DROITE|DR|GAUCHE|GA)\b/i.test(code);
  const hasRepeat = /\bREPETE\b/i.test(code);
  const expectedRepeat = /REPETE/i.test(exercise?.solution || '') || /carr|hexagone|pentagone|rosace|flocon|damier|étoile|etoile|spirale/i.test(exercise?.title + ' ' + exercise?.description);
  let score = 3;
  if (hasMove) score += 2;
  if (hasTurn) score += 2;
  if (!errors.length) score += 1;
  if (!expectedRepeat || hasRepeat) score += 2;
  if (code.replace(/\s/g, '').toLowerCase() === String(exercise?.solution || '').replace(/\s/g, '').toLowerCase()) score = 10;
  score = Math.max(0, Math.min(10, score - Math.min(2, errors.length)));
  return {
    score,
    comment: score >= 8 ? 'Très bon travail. Ton programme semble répondre à la consigne.' : score >= 5 ? 'Bonne tentative, mais la figure peut être améliorée.' : 'Le programme est encore incomplet ou contient des erreurs.',
    errors,
    improvement: expectedRepeat && !hasRepeat ? 'Essaie d’utiliser REPETE pour simplifier ton code.' : 'Vérifie les angles, les distances et l’ordre des commandes.',
    fallback: true
  };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.post('/api/student/login', async (req, res) => {
  const name = cleanText(req.body.name, 70);
  const className = cleanText(req.body.className, 40);
  const level = normalizeLevel(req.body.level);
  if (!name || !className || !isValidLevel(level)) {
    return res.status(400).json({ error: 'Nom, classe et niveau 2AC/3AC obligatoires.' });
  }
  const users = await readDb('users');
  let user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.className.toLowerCase() === className.toLowerCase() && u.level === level);
  const now = new Date().toISOString();
  if (!user) {
    user = { id: randomUUID(), name, className, level, createdAt: now, lastSeenAt: now };
    users.push(user);
  } else {
    user.lastSeenAt = now;
  }
  await writeDb('users', users);
  res.json({ student: user });
});

app.post('/api/generate-exercise', async (req, res) => {
  const level = normalizeLevel(req.body.level);
  const studentName = cleanText(req.body.studentName, 70) || 'élève';
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-8) : [];
  if (!isValidLevel(level)) return res.status(400).json({ error: 'Niveau invalide. Utilise 2AC ou 3AC.' });

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      hint: { type: 'string' },
      solution: { type: 'string' }
    },
    required: ['title', 'description', 'hint', 'solution']
  };

  const prompt = `Tu es un professeur d'informatique au collège marocain. Crée un exercice XLOGO adapté au niveau ${level} pour ${studentName}.
Contraintes absolues :
- Ne jamais proposer 1AC.
- Commandes 2AC : AVANCE, RECULE, DROITE, GAUCHE, REPETE, COULEURCRAYON, LEVECRAYON, BAISSECRAYON.
- 2AC : carré, rectangle, triangle, losange, pentagone, hexagone, spirale, étoile simple.
- 3AC : toutes les commandes 2AC + rosace, flocon, damier, étoile complexe, symétries, motifs décoratifs, formes composées.
- Canvas environ 420x320, distances raisonnables entre 20 et 130.
- REPETE max 300.
- Réponds seulement en JSON avec title, description, hint, solution.
Historique récent : ${JSON.stringify(history)}`;

  try {
    const ex = await callGemini(prompt, schema);
    return res.json({
      title: cleanText(ex.title, 100),
      description: cleanText(ex.description, 600),
      hint: cleanText(ex.hint, 500),
      solution: String(ex.solution || '').slice(0, 2000),
      source: 'gemini'
    });
  } catch (error) {
    const ex = fallbackExercise(level, history);
    return res.json({ ...ex, source: 'local', warning: error.message });
  }
});

app.post('/api/evaluate', async (req, res) => {
  const level = normalizeLevel(req.body.level);
  const exercise = req.body.exercise || {};
  const studentCode = String(req.body.studentCode || '').slice(0, 6000);
  if (!isValidLevel(level)) return res.status(400).json({ error: 'Niveau invalide. Utilise 2AC ou 3AC.' });
  if (!exercise.title || !exercise.description) return res.status(400).json({ error: 'Exercice invalide.' });

  const schema = {
    type: 'object',
    properties: {
      score: { type: 'integer' },
      comment: { type: 'string' },
      errors: { type: 'array', items: { type: 'string' } },
      improvement: { type: 'string' }
    },
    required: ['score', 'comment', 'errors', 'improvement']
  };

  const prompt = `Tu corriges un code XLOGO de collège niveau ${level}.
Retourne uniquement JSON {"score":0-10,"comment":"...","errors":[],"improvement":"..."}.
Barème : 10 parfait, 7-9 correct avec petites erreurs, 4-6 partiel, 1-3 tentative faible, 0 vide/hors sujet.
Exercice : ${JSON.stringify(exercise)}
Code élève :\n${studentCode}`;

  try {
    const ai = await callGemini(prompt, schema);
    const score = Math.max(0, Math.min(10, Number(ai.score) || 0));
    return res.json({
      score,
      comment: cleanText(ai.comment, 700),
      errors: Array.isArray(ai.errors) ? ai.errors.map(e => cleanText(e, 200)).slice(0, 8) : [],
      improvement: cleanText(ai.improvement, 700),
      source: 'gemini'
    });
  } catch (error) {
    const local = localEvaluate(level, exercise, studentCode);
    return res.json({ ...local, source: 'local', warning: error.message });
  }
});

app.post('/api/teacher/login', (req, res) => {
  const password = String(req.body.password || '');
  const expected = process.env.TEACHER_PASSWORD || 'admin123';
  if (password !== expected) return res.status(401).json({ error: 'Mot de passe enseignant incorrect.' });
  res.json({ ok: true, token: process.env.TEACHER_TOKEN || expected, teacherName: process.env.TEACHER_NAME || 'Enseignant' });
});

app.get('/api/teacher/dashboard', requireTeacher, async (req, res) => {
  const [users, classes, exercises, submissions] = await Promise.all([
    readDb('users'), readDb('classes'), readDb('exercises'), readDb('submissions')
  ]);
  const scores = submissions.map(s => Number(s.score)).filter(n => !Number.isNaN(n));
  const average = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;
  const byStudent = users.map(u => {
    const subs = submissions.filter(s => s.studentId === u.id);
    const avg = subs.length ? +(subs.reduce((a, b) => a + Number(b.score || 0), 0) / subs.length).toFixed(2) : 0;
    return { ...u, submissions: subs.length, average: avg, lastScore: subs.at(-1)?.score ?? null };
  });
  const best = byStudent.filter(s => s.submissions).sort((a, b) => b.average - a.average).slice(0, 5);
  const difficulty = byStudent.filter(s => s.submissions && s.average < 5.5).sort((a, b) => a.average - b.average).slice(0, 8);
  const classStats = classes.map(c => {
    const students = users.filter(u => u.className === c.name && u.level === c.level);
    const ids = new Set(students.map(s => s.id));
    const subs = submissions.filter(s => ids.has(s.studentId));
    const avg = subs.length ? +(subs.reduce((a, b) => a + Number(b.score || 0), 0) / subs.length).toFixed(2) : 0;
    return { ...c, studentCount: students.length, submissions: subs.length, average: avg };
  });
  res.json({
    counts: { students: users.length, classes: classes.length, exercises: exercises.length, submissions: submissions.length },
    average,
    best,
    difficulty,
    classStats,
    recentSubmissions: submissions.slice(-20).reverse()
  });
});

app.get('/api/students', requireTeacher, async (req, res) => {
  const users = await readDb('users');
  const submissions = await readDb('submissions');
  const { className, level, minScore, maxScore } = req.query;
  let list = users.map(u => {
    const subs = submissions.filter(s => s.studentId === u.id);
    const avg = subs.length ? +(subs.reduce((a, b) => a + Number(b.score || 0), 0) / subs.length).toFixed(2) : 0;
    return { ...u, submissions: subs.length, average: avg, lastSubmissionAt: subs.at(-1)?.createdAt || null };
  });
  if (className) list = list.filter(u => u.className === className);
  if (level && isValidLevel(level)) list = list.filter(u => u.level === normalizeLevel(level));
  if (minScore !== undefined && minScore !== '') list = list.filter(u => u.average >= Number(minScore));
  if (maxScore !== undefined && maxScore !== '') list = list.filter(u => u.average <= Number(maxScore));
  res.json(list);
});

app.post('/api/students', requireTeacher, async (req, res) => {
  const name = cleanText(req.body.name, 70);
  const className = cleanText(req.body.className, 40);
  const level = normalizeLevel(req.body.level);
  if (!name || !className || !isValidLevel(level)) return res.status(400).json({ error: 'Nom, classe et niveau valides obligatoires.' });
  const users = await readDb('users');
  const user = { id: randomUUID(), name, className, level, createdAt: new Date().toISOString(), lastSeenAt: null };
  users.push(user);
  await writeDb('users', users);
  res.status(201).json(user);
});

app.delete('/api/students/:id', requireTeacher, async (req, res) => {
  const users = await readDb('users');
  const next = users.filter(u => u.id !== req.params.id);
  await writeDb('users', next);
  res.json({ ok: true, deleted: users.length - next.length });
});

app.get('/api/classes', async (req, res) => {
  const classes = await readDb('classes');
  res.json(classes);
});

app.post('/api/classes', requireTeacher, async (req, res) => {
  const name = cleanText(req.body.name, 40);
  const level = normalizeLevel(req.body.level);
  if (!name || !isValidLevel(level)) return res.status(400).json({ error: 'Nom de classe et niveau 2AC/3AC obligatoires.' });
  const classes = await readDb('classes');
  if (classes.some(c => c.name.toLowerCase() === name.toLowerCase() && c.level === level)) {
    return res.status(409).json({ error: 'Cette classe existe déjà.' });
  }
  const cls = { id: randomUUID(), name, level, createdAt: new Date().toISOString() };
  classes.push(cls);
  await writeDb('classes', classes);
  res.status(201).json(cls);
});

app.get('/api/exercises', async (req, res) => {
  const exercises = await readDb('exercises');
  const { level, studentId, className } = req.query;
  let list = exercises;
  if (level && isValidLevel(level)) list = list.filter(e => e.level === normalizeLevel(level));
  if (studentId || className) {
    list = list.filter(e => {
      const a = e.assignedTo || { type: 'all' };
      return a.type === 'all' || (a.type === 'class' && a.className === className) || (a.type === 'student' && a.studentId === studentId);
    });
  }
  res.json(list.slice().reverse());
});

app.post('/api/exercises', requireTeacher, async (req, res) => {
  const level = normalizeLevel(req.body.level);
  const title = cleanText(req.body.title, 100);
  const description = cleanText(req.body.description, 800);
  const hint = cleanText(req.body.hint, 600);
  const solution = String(req.body.solution || '').slice(0, 3000).trim();
  const assignedTo = req.body.assignedTo || { type: 'all' };
  if (!isValidLevel(level) || !title || !description || !solution) {
    return res.status(400).json({ error: 'Titre, description, solution et niveau valides obligatoires.' });
  }
  if (!['all', 'class', 'student'].includes(assignedTo.type)) return res.status(400).json({ error: 'Type d’affectation invalide.' });
  const exercises = await readDb('exercises');
  const ex = { id: randomUUID(), level, title, description, hint, solution, assignedTo, createdBy: 'teacher', createdAt: new Date().toISOString() };
  exercises.push(ex);
  await writeDb('exercises', exercises);
  res.status(201).json(ex);
});

app.post('/api/teacher/generate-exercise', requireTeacher, async (req, res) => {
  const level = normalizeLevel(req.body.level);
  if (!isValidLevel(level)) return res.status(400).json({ error: 'Niveau invalide.' });
  req.body.studentName = 'classe';
  req.body.history = [];
  // Reuse the public generation logic manually to avoid internal HTTP calls.
  const schema = {
    type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, hint: { type: 'string' }, solution: { type: 'string' } }, required: ['title', 'description', 'hint', 'solution']
  };
  const prompt = `Crée un exercice XLOGO niveau ${level} pour un enseignant. Réponds seulement JSON title, description, hint, solution. 2AC commandes de base + couleurs; 3AC figures complexes.`;
  try {
    const ex = await callGemini(prompt, schema);
    res.json({ ...ex, source: 'gemini' });
  } catch (error) {
    res.json({ ...fallbackExercise(level, []), source: 'local', warning: error.message });
  }
});

app.get('/api/submissions', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const expected = process.env.TEACHER_TOKEN || process.env.TEACHER_PASSWORD || 'admin123';
  const submissions = await readDb('submissions');
  const users = await readDb('users');
  let list = submissions.map(s => ({ ...s, student: users.find(u => u.id === s.studentId) || null }));
  const isTeacher = token && token === expected;
  if (!isTeacher) {
    if (!req.query.studentId) return res.status(401).json({ error: 'Accès non autorisé.' });
    list = list.filter(s => s.studentId === req.query.studentId);
  }
  const { className, level, date, minScore, maxScore, studentId } = req.query;
  if (studentId) list = list.filter(s => s.studentId === studentId);
  if (className) list = list.filter(s => s.student?.className === className);
  if (level && isValidLevel(level)) list = list.filter(s => s.level === normalizeLevel(level));
  if (date) list = list.filter(s => String(s.createdAt || '').startsWith(date));
  if (minScore !== undefined && minScore !== '') list = list.filter(s => Number(s.score) >= Number(minScore));
  if (maxScore !== undefined && maxScore !== '') list = list.filter(s => Number(s.score) <= Number(maxScore));
  res.json(list.slice().reverse());
});

app.post('/api/submissions', async (req, res) => {
  const studentId = cleanText(req.body.studentId, 80);
  const level = normalizeLevel(req.body.level);
  const exercise = req.body.exercise || {};
  const studentCode = String(req.body.studentCode || '').slice(0, 6000);
  const score = Math.max(0, Math.min(10, Number(req.body.score) || 0));
  const comment = cleanText(req.body.comment, 1000);
  if (!studentId || !isValidLevel(level) || !exercise.title) return res.status(400).json({ error: 'Soumission invalide.' });
  const submissions = await readDb('submissions');
  const sub = {
    id: randomUUID(), studentId, level,
    exercise: { title: cleanText(exercise.title, 120), description: cleanText(exercise.description, 700), solution: String(exercise.solution || '').slice(0, 2000) },
    studentCode,
    score,
    comment,
    manualScore: null,
    manualComment: '',
    createdAt: new Date().toISOString()
  };
  submissions.push(sub);
  await writeDb('submissions', submissions);
  res.status(201).json(sub);
});

app.patch('/api/submissions/:id', requireTeacher, async (req, res) => {
  const submissions = await readDb('submissions');
  const sub = submissions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Réponse introuvable.' });
  if (req.body.manualScore !== undefined) sub.manualScore = Math.max(0, Math.min(10, Number(req.body.manualScore)));
  if (req.body.manualComment !== undefined) sub.manualComment = cleanText(req.body.manualComment, 1000);
  sub.correctedAt = new Date().toISOString();
  await writeDb('submissions', submissions);
  res.json(sub);
});

app.get('/api/export/csv', requireTeacher, async (req, res) => {
  const submissions = await readDb('submissions');
  const users = await readDb('users');
  const rows = [['Date', 'Eleve', 'Classe', 'Niveau', 'Exercice', 'Score IA', 'Score manuel', 'Commentaire']];
  for (const s of submissions) {
    const u = users.find(user => user.id === s.studentId) || {};
    rows.push([s.createdAt, u.name || '', u.className || '', s.level, s.exercise?.title || '', s.score, s.manualScore ?? '', (s.manualComment || s.comment || '').replace(/\n/g, ' ')]);
  }
  const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="xlogo-resultats.csv"');
  res.send('\ufeff' + csv);
});

app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Erreur serveur. Vérifie les logs Render ou le terminal.' });
});

ensureDataFiles().then(() => {
  app.listen(PORT, () => console.log(`XLOGO lancé sur http://localhost:${PORT}`));
});
