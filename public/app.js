/* XLOGO - Frontend vanilla JS */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const LEVELS = {
  '2AC': {
    label: '2ème AC',
    commands: ['AVANCE 80', 'RECULE 40', 'DROITE 90', 'GAUCHE 90', 'REPETE 4 [AVANCE 80 DROITE 90]', 'COULEURCRAYON bleu', 'LEVECRAYON', 'BAISSECRAYON'],
    examples: [
      'REPETE 4 [AVANCE 90 DROITE 90]',
      'COULEURCRAYON vert\nREPETE 3 [AVANCE 100 DROITE 120]',
      'COULEURCRAYON orange\nREPETE 6 [AVANCE 60 DROITE 60]'
    ]
  },
  '3AC': {
    label: '3ème AC',
    commands: ['AVANCE 70', 'RECULE 70', 'DROITE 30', 'GAUCHE 45', 'REPETE 12 [REPETE 4 [AVANCE 50 DROITE 90] DROITE 30]', 'COULEURCRAYON violet', 'LEVECRAYON', 'BAISSECRAYON'],
    examples: [
      'COULEURCRAYON violet\nREPETE 12 [REPETE 4 [AVANCE 60 DROITE 90] DROITE 30]',
      'COULEURCRAYON cyan\nREPETE 6 [AVANCE 90 RECULE 90 DROITE 60]',
      'COULEURCRAYON rouge\nREPETE 5 [AVANCE 110 DROITE 144]'
    ]
  }
};

const BADGES = [
  { id: 'first', icon: '🎯', name: 'Premier exercice', cond: (s) => s.count >= 1 },
  { id: 'five', icon: '⭐', name: '5 exercices', cond: (s) => s.count >= 5 },
  { id: 'ten', icon: '🔥', name: '10 exercices', cond: (s) => s.count >= 10 },
  { id: 'perfect', icon: '💎', name: '10/10', cond: (s) => s.history.some(x => Number(x.score) === 10) },
  { id: 'regular', icon: '📈', name: 'Régulier', cond: (s) => s.average >= 7 && s.count >= 3 },
  { id: 'master', icon: '👑', name: 'Maître XLOGO', cond: (s) => s.average >= 9 && s.count >= 5 }
];

const state = {
  student: JSON.parse(localStorage.getItem('xlogo_student') || 'null'),
  teacherToken: localStorage.getItem('xlogo_teacher_token') || '',
  teacherName: localStorage.getItem('xlogo_teacher_name') || '',
  currentExercise: null,
  submissions: [],
  students: [],
  classes: [],
  exercises: [],
  dashboard: null
};

class XLogoEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reset();
  }
  reset() {
    this.x = this.canvas.width / 2;
    this.y = this.canvas.height / 2;
    this.angle = -90;
    this.penDown = true;
    this.color = '#60a5fa';
    this.traces = [];
    this.commands = 0;
    this.draw();
  }
  forward(n) {
    const rad = this.angle * Math.PI / 180;
    const nx = this.x + n * Math.cos(rad);
    const ny = this.y + n * Math.sin(rad);
    if (this.penDown) this.traces.push({ x1: this.x, y1: this.y, x2: nx, y2: ny, color: this.color });
    this.x = nx;
    this.y = ny;
    this.commands++;
  }
  back(n) { this.forward(-n); }
  right(n) { this.angle += n; this.commands++; }
  left(n) { this.angle -= n; this.commands++; }
  penUp() { this.penDown = false; this.commands++; }
  penDownFn() { this.penDown = true; this.commands++; }
  setColor(color) { this.color = color; this.commands++; }
  draw() {
    const c = this.ctx;
    c.fillStyle = '#071020';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.strokeStyle = 'rgba(147,197,253,.08)';
    c.lineWidth = 1;
    for (let x = 0; x <= this.canvas.width; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.canvas.height); c.stroke(); }
    for (let y = 0; y <= this.canvas.height; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(this.canvas.width, y); c.stroke(); }
    c.strokeStyle = 'rgba(147,197,253,.18)';
    c.beginPath(); c.moveTo(this.canvas.width / 2, 0); c.lineTo(this.canvas.width / 2, this.canvas.height); c.stroke();
    c.beginPath(); c.moveTo(0, this.canvas.height / 2); c.lineTo(this.canvas.width, this.canvas.height / 2); c.stroke();
    for (const t of this.traces) {
      c.strokeStyle = t.color;
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath(); c.moveTo(t.x1, t.y1); c.lineTo(t.x2, t.y2); c.stroke();
    }
    const rad = this.angle * Math.PI / 180;
    c.save();
    c.translate(this.x, this.y);
    c.rotate(rad);
    c.fillStyle = this.color;
    c.shadowColor = this.color;
    c.shadowBlur = 14;
    c.beginPath();
    c.moveTo(14, 0);
    c.lineTo(-10, -8);
    c.lineTo(-6, 0);
    c.lineTo(-10, 8);
    c.closePath();
    c.fill();
    c.restore();
  }
}

let turtle = null;
let homeTurtle = null;

function normalizeCode(code) {
  return String(code || '')
    .replace(/;.*$/gm, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bav\b/g, 'avance')
    .replace(/\bre\b/g, 'recule')
    .replace(/\btd\b|\bdr\b/g, 'droite')
    .replace(/\btg\b|\bga\b/g, 'gauche')
    .replace(/\blc\b/g, 'levecrayon')
    .replace(/\bbc\b/g, 'baissecrayon')
    .replace(/\bcc\b/g, 'couleurcrayon');
}

function tokenize(code) {
  const s = normalizeCode(code);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    if ('[]'.includes(s[i])) { tokens.push(s[i++]); continue; }
    let w = '';
    while (i < s.length && !/[\s\[\]]/.test(s[i])) w += s[i++];
    if (w) tokens.push(w);
  }
  return tokens;
}

function runXLogo(code, engine) {
  engine.reset();
  const tokens = tokenize(code);
  let p = 0;
  let totalLoop = 0;
  const colors = {
    rouge: '#f87171', bleu: '#60a5fa', vert: '#34d399', jaune: '#fbbf24', blanc: '#ffffff', noir: '#111827',
    orange: '#fb923c', violet: '#a78bfa', rose: '#f472b6', cyan: '#22d3ee', or: '#f59e0b', turquoise: '#2dd4bf'
  };
  const number = () => {
    if (p >= tokens.length) throw new Error('Nombre attendu après la commande.');
    const n = Number(tokens[p++]);
    if (!Number.isFinite(n)) throw new Error(`Nombre invalide : ${tokens[p - 1]}`);
    if (Math.abs(n) > 1000) throw new Error('Distance ou angle trop grand. Maximum conseillé : 1000.');
    return n;
  };
  const color = () => {
    if (p >= tokens.length) throw new Error('Couleur attendue après COULEURCRAYON.');
    const c = tokens[p++];
    if (colors[c]) return colors[c];
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    throw new Error(`Couleur inconnue : ${c}`);
  };
  const parseBlock = () => {
    if (tokens[p] !== '[') return [parseCommand()];
    p++;
    const cmds = [];
    while (p < tokens.length && tokens[p] !== ']') cmds.push(parseCommand());
    if (tokens[p] !== ']') throw new Error('Crochet fermant ] manquant.');
    p++;
    return cmds;
  };
  const parseCommand = () => {
    if (p >= tokens.length) return () => {};
    const t = tokens[p++];
    if (t === ']') throw new Error('Crochet ] inattendu.');
    switch (t) {
      case 'avance': { const n = number(); return () => engine.forward(n); }
      case 'recule': { const n = number(); return () => engine.back(n); }
      case 'droite': { const n = number(); return () => engine.right(n); }
      case 'gauche': { const n = number(); return () => engine.left(n); }
      case 'levecrayon': return () => engine.penUp();
      case 'baissecrayon': return () => engine.penDownFn();
      case 'couleurcrayon': { const c = color(); return () => engine.setColor(c); }
      case 'repete': {
        const n = number();
        if (n < 0) throw new Error('REPETE ne peut pas être négatif.');
        if (n > 300) throw new Error('Boucle trop grande : REPETE est limité à 300 pour protéger la plateforme.');
        totalLoop += n;
        if (totalLoop > 2000) throw new Error('Trop de répétitions cumulées. Simplifie le programme.');
        const block = parseBlock();
        return () => { for (let i = 0; i < n; i++) block.forEach(fn => fn()); };
      }
      default:
        throw new Error(`Commande inconnue : ${t}`);
    }
  };
  const program = [];
  while (p < tokens.length) program.push(parseCommand());
  program.forEach(fn => fn());
  engine.draw();
  return { ok: true, commands: engine.commands, message: `${engine.commands} commande(s) exécutée(s).` };
}

function toast(message, type = 'info') {
  const box = document.createElement('div');
  box.className = `toast ${type}`;
  box.textContent = message;
  $('#toast').appendChild(box);
  setTimeout(() => box.remove(), 3600);
}

function setView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.go === name));
  if (name === 'progress') renderProgress();
  if (name === 'teacher' && state.teacherToken) loadTeacher();
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.teacher) headers.Authorization = `Bearer ${state.teacherToken}`;
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.error || 'Erreur réseau.');
  return data;
}

function log(message, type = 'info') {
  const line = document.createElement('div');
  line.className = type;
  line.textContent = `> ${message}`;
  $('#consoleLog').appendChild(line);
  $('#consoleLog').scrollTop = $('#consoleLog').scrollHeight;
}

function updateSessionUi() {
  const badge = $('#studentBadge');
  if (state.student) {
    badge.textContent = `${state.student.name} • ${state.student.level}`;
    badge.classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
  } else if (state.teacherToken) {
    badge.textContent = state.teacherName || 'Enseignant';
    badge.classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    $('#logoutBtn').classList.add('hidden');
  }
}

function initTheme() {
  const saved = localStorage.getItem('xlogo_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  $('#themeToggle i').className = saved === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('xlogo_theme', next);
  $('#themeToggle i').className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function renderCommands(level) {
  const zone = $('#commandChips');
  zone.innerHTML = '';
  LEVELS[level].commands.forEach(cmd => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.textContent = cmd;
    btn.onclick = () => insertCode(cmd);
    zone.appendChild(btn);
  });
  const examples = $('#quickExamples');
  examples.innerHTML = '';
  LEVELS[level].examples.forEach(ex => {
    const div = document.createElement('button');
    div.className = 'example';
    div.type = 'button';
    div.textContent = ex;
    div.onclick = () => { $('#codeEditor').value = ex; saveDraft(); runCurrentCode(); };
    examples.appendChild(div);
  });
}

function insertCode(text) {
  const ed = $('#codeEditor');
  const start = ed.selectionStart;
  const end = ed.selectionEnd;
  const sep = ed.value && !ed.value.endsWith('\n') ? '\n' : '';
  ed.value = ed.value.slice(0, start) + sep + text + ed.value.slice(end);
  ed.focus();
  ed.selectionStart = ed.selectionEnd = start + sep.length + text.length;
  saveDraft();
}

async function studentLogin(event) {
  event.preventDefault();
  const payload = {
    name: $('#studentName').value,
    className: $('#studentClass').value,
    level: $('#studentLevel').value
  };
  try {
    const data = await api('/api/student/login', { method: 'POST', body: JSON.stringify(payload) });
    state.student = data.student;
    localStorage.setItem('xlogo_student', JSON.stringify(state.student));
    $('#studentLogin').classList.add('hidden');
    $('#studentWorkspace').classList.remove('hidden');
    updateSessionUi();
    await loadStudentSubmissions();
    await loadAssignedExerciseOrGenerate();
    toast('Connexion élève réussie.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadStudentSubmissions() {
  if (!state.student) return;
  state.submissions = await api(`/api/submissions?studentId=${encodeURIComponent(state.student.id)}`);
  renderStudentStats();
}

async function loadAssignedExerciseOrGenerate() {
  if (!state.student) return;
  const list = await api(`/api/exercises?level=${state.student.level}&studentId=${encodeURIComponent(state.student.id)}&className=${encodeURIComponent(state.student.className)}`);
  const doneTitles = new Set(state.submissions.map(s => s.exercise?.title));
  const next = list.find(e => !doneTitles.has(e.title)) || null;
  if (next) setExercise(next, 'enseignant');
  else await generateExercise();
}

async function generateExercise() {
  if (!state.student) return toast('Connecte-toi d’abord comme élève.', 'warn');
  $('#newExerciseBtn').disabled = true;
  try {
    const history = state.submissions.slice(0, 8).map(s => ({ title: s.exercise?.title, score: s.score }));
    const ex = await api('/api/generate-exercise', { method: 'POST', body: JSON.stringify({ level: state.student.level, studentName: state.student.name, history }) });
    setExercise(ex, ex.source || 'gemini');
    if (ex.warning) toast('IA indisponible : exercice local utilisé.', 'warn');
  } catch (e) { toast(e.message, 'error'); }
  finally { $('#newExerciseBtn').disabled = false; }
}

function setExercise(ex, source = '') {
  state.currentExercise = ex;
  $('#exerciseTitle').textContent = ex.title;
  $('#exerciseDescription').textContent = ex.description;
  $('#currentLevelPill').textContent = state.student?.level || ex.level || '2AC';
  $('#exerciseSource').textContent = source ? `Source : ${source}` : '';
  $('#hintBox').textContent = `💡 ${ex.hint || 'Relis bien la consigne et utilise les commandes disponibles.'}`;
  $('#hintBox').classList.add('hidden');
  $('#solutionContent').textContent = ex.solution || '';
  $('#feedback').classList.add('hidden');
  const draft = localStorage.getItem(draftKey());
  $('#codeEditor').value = draft || '';
  $('#consoleLog').innerHTML = '';
  renderCommands(state.student?.level || ex.level || '2AC');
  resetCanvas();
}

function draftKey() {
  return `xlogo_draft_${state.student?.id || 'guest'}`;
}

function saveDraft() {
  if (!state.student) return;
  localStorage.setItem(draftKey(), $('#codeEditor').value);
  $('#autosaveState').textContent = 'Sauvegardé automatiquement';
}

function resetCanvas() {
  turtle.reset();
  $('#consoleLog').innerHTML = '';
  log('Canvas réinitialisé.', 'info');
}

function runCurrentCode() {
  $('#consoleLog').innerHTML = '';
  try {
    const result = runXLogo($('#codeEditor').value, turtle);
    log(result.message, 'ok');
  } catch (e) {
    turtle.draw();
    log(e.message, 'err');
    toast(e.message, 'error');
  }
}

async function evaluateCurrentCode() {
  if (!state.currentExercise) return toast('Aucun exercice chargé.', 'warn');
  const code = $('#codeEditor').value;
  try {
    runCurrentCode();
    $('#evaluateBtn').disabled = true;
    const evaluation = await api('/api/evaluate', { method: 'POST', body: JSON.stringify({ level: state.student.level, exercise: state.currentExercise, studentCode: code }) });
    const sub = await api('/api/submissions', { method: 'POST', body: JSON.stringify({ studentId: state.student.id, level: state.student.level, exercise: state.currentExercise, studentCode: code, score: evaluation.score, comment: `${evaluation.comment}\n${evaluation.improvement || ''}` }) });
    state.submissions.unshift(sub);
    localStorage.removeItem(draftKey());
    renderFeedback(evaluation);
    renderStudentStats();
    renderProgress();
  } catch (e) { toast(e.message, 'error'); }
  finally { $('#evaluateBtn').disabled = false; }
}

function renderFeedback(ev) {
  const fb = $('#feedback');
  const score = Number(ev.score || 0);
  fb.className = 'feedback ' + (score >= 8 ? 'good' : score >= 5 ? 'mid' : 'bad');
  fb.innerHTML = `
    <h3>${score >= 8 ? 'Excellent travail' : score >= 5 ? 'Bonne tentative' : 'À améliorer'} — <strong class="score">${score}/10</strong></h3>
    <p>${escapeHtml(ev.comment || '')}</p>
    ${ev.errors?.length ? `<p><strong>Erreurs :</strong> ${ev.errors.map(escapeHtml).join(', ')}</p>` : ''}
    <p><strong>Conseil :</strong> ${escapeHtml(ev.improvement || 'Continue à t’entraîner.')}</p>
    ${ev.warning ? `<p><strong>Note :</strong> correction locale utilisée car Gemini n’a pas répondu.</p>` : ''}
    <button class="secondary" id="afterNextExercise"><i class="fa-solid fa-forward"></i> Exercice suivant</button>`;
  fb.classList.remove('hidden');
  $('#afterNextExercise').onclick = loadAssignedExerciseOrGenerate;
}

function progressSummary() {
  const h = state.submissions || [];
  const count = h.length;
  const total = h.reduce((a, b) => a + Number(b.score || 0), 0);
  const average = count ? +(total / count).toFixed(1) : 0;
  const earned = BADGES.filter(b => b.cond({ count, average, history: h }));
  return { count, total, average, earned, history: h };
}

function renderStudentStats() {
  const s = progressSummary();
  $('#scoreAverage').textContent = s.average;
  $('#scoreCount').textContent = s.count;
  $('#badgeCount').textContent = s.earned.length;
}

function renderProgress() {
  const hasStudent = !!state.student;
  $('#progressTitle').textContent = hasStudent ? `${state.student.name} — ${state.student.level}` : 'Aucun élève connecté';
  $('#progressSubtitle').textContent = hasStudent ? `Classe : ${state.student.className}` : 'Connecte-toi comme élève pour afficher ton historique.';
  const s = progressSummary();
  $('#progressStats').innerHTML = [
    ['Moyenne', `${s.average}/10`], ['Exercices', s.count], ['Points', s.total], ['Badges', s.earned.length]
  ].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('#badges').innerHTML = BADGES.map(b => `<div class="badge ${s.earned.some(e => e.id === b.id) ? 'earned' : ''}"><span>${b.icon}</span><small>${b.name}</small></div>`).join('');
  $('#historyList').innerHTML = s.history.length ? s.history.map(h => `<div class="history-item"><div><strong>${escapeHtml(h.exercise?.title || 'Exercice')}</strong><small>${new Date(h.createdAt).toLocaleString('fr-FR')}</small></div><strong>${h.score}/10</strong></div>`).join('') : '<p class="muted">Aucun exercice réalisé.</p>';
}

function exportPng() {
  const a = document.createElement('a');
  a.download = `xlogo-${Date.now()}.png`;
  a.href = $('#turtleCanvas').toDataURL('image/png');
  a.click();
}

async function teacherLogin(event) {
  event.preventDefault();
  try {
    const data = await api('/api/teacher/login', { method: 'POST', body: JSON.stringify({ password: $('#teacherPassword').value }) });
    state.teacherToken = data.token;
    state.teacherName = data.teacherName;
    localStorage.setItem('xlogo_teacher_token', state.teacherToken);
    localStorage.setItem('xlogo_teacher_name', state.teacherName);
    $('#teacherLogin').classList.add('hidden');
    $('#teacherDashboard').classList.remove('hidden');
    updateSessionUi();
    await loadTeacher();
    toast('Connexion enseignant réussie.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadTeacher() {
  if (!state.teacherToken) return;
  try {
    const [dashboard, students, classes, exercises, submissions] = await Promise.all([
      api('/api/teacher/dashboard', { teacher: true }),
      api(buildStudentFilterUrl(), { teacher: true }),
      api('/api/classes'),
      api('/api/exercises'),
      api(buildSubmissionFilterUrl(), { teacher: true })
    ]);
    Object.assign(state, { dashboard, students, classes, exercises, teacherSubmissions: submissions });
    $('#teacherLogin').classList.add('hidden');
    $('#teacherDashboard').classList.remove('hidden');
    $('#csvLink').onclick = (e) => {
      e.preventDefault();
      window.open(`/api/export/csv?token=${encodeURIComponent(state.teacherToken)}`, '_blank');
      toast('Si le téléchargement ne démarre pas, utilise un outil comme Postman avec le header Authorization.', 'warn');
    };
    renderTeacher();
  } catch (e) {
    toast(e.message, 'error');
    if (e.message.includes('non autorisé')) logout();
  }
}

function buildStudentFilterUrl() {
  const params = new URLSearchParams();
  if ($('#filterClass')?.value) params.set('className', $('#filterClass').value);
  if ($('#filterLevel')?.value) params.set('level', $('#filterLevel').value);
  if ($('#filterMinScore')?.value) params.set('minScore', $('#filterMinScore').value);
  if ($('#filterMaxScore')?.value) params.set('maxScore', $('#filterMaxScore').value);
  return `/api/students?${params.toString()}`;
}

function buildSubmissionFilterUrl() {
  const params = new URLSearchParams();
  if ($('#submissionClass')?.value) params.set('className', $('#submissionClass').value);
  if ($('#submissionLevel')?.value) params.set('level', $('#submissionLevel').value);
  if ($('#submissionDate')?.value) params.set('date', $('#submissionDate').value);
  if ($('#submissionMin')?.value) params.set('minScore', $('#submissionMin').value);
  if ($('#submissionMax')?.value) params.set('maxScore', $('#submissionMax').value);
  return `/api/submissions?${params.toString()}`;
}

function renderTeacher() {
  const d = state.dashboard;
  $('#teacherStats').innerHTML = [
    ['Élèves', d.counts.students], ['Classes', d.counts.classes], ['Exercices', d.counts.exercises], ['Moyenne globale', `${d.average}/10`]
  ].map(([l, v]) => `<div><strong>${v}</strong><span>${l}</span></div>`).join('');
  renderStudentsTable();
  renderClassesTable();
  renderExercisesTable();
  renderSubmissions();
  renderTeacherStats();
}

function renderStudentsTable() {
  $('#studentsTable').innerHTML = `<thead><tr><th>Nom</th><th>Classe</th><th>Niveau</th><th>Moyenne</th><th>Exos</th><th>Action</th></tr></thead><tbody>${state.students.map(s => `<tr><td><strong>${escapeHtml(s.name)}</strong><br><small>${s.id}</small></td><td>${escapeHtml(s.className)}</td><td>${s.level}</td><td>${s.average}/10</td><td>${s.submissions}</td><td><button class="ghost danger small" data-del-student="${s.id}">Supprimer</button></td></tr>`).join('') || '<tr><td colspan="6">Aucun élève.</td></tr>'}</tbody>`;
  $$('[data-del-student]').forEach(b => b.onclick = async () => {
    if (!confirm('Supprimer cet élève ?')) return;
    await api(`/api/students/${b.dataset.delStudent}`, { method: 'DELETE', teacher: true });
    await loadTeacher();
  });
}

function renderClassesTable() {
  $('#classesTable').innerHTML = `<thead><tr><th>Classe</th><th>Niveau</th><th>Créée le</th></tr></thead><tbody>${state.classes.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${c.level}</td><td>${new Date(c.createdAt).toLocaleDateString('fr-FR')}</td></tr>`).join('') || '<tr><td colspan="3">Aucune classe.</td></tr>'}</tbody>`;
}

function renderExercisesTable() {
  $('#exercisesTable').innerHTML = `<thead><tr><th>Titre</th><th>Niveau</th><th>Affectation</th><th>Solution</th></tr></thead><tbody>${state.exercises.map(e => `<tr><td><strong>${escapeHtml(e.title)}</strong><br><small>${escapeHtml(e.description || '')}</small></td><td>${e.level}</td><td>${formatAssign(e.assignedTo)}</td><td><code>${escapeHtml(String(e.solution || '').slice(0, 60))}</code></td></tr>`).join('') || '<tr><td colspan="4">Aucun exercice.</td></tr>'}</tbody>`;
}

function renderSubmissions() {
  const list = state.teacherSubmissions || [];
  $('#submissionsList').innerHTML = list.length ? list.map(s => `<article class="submission-card"><header><div><strong>${escapeHtml(s.student?.name || 'Élève')}</strong><br><small>${escapeHtml(s.student?.className || '')} • ${s.level} • ${new Date(s.createdAt).toLocaleString('fr-FR')}</small></div><strong>${s.manualScore ?? s.score}/10</strong></header><p><strong>Exercice :</strong> ${escapeHtml(s.exercise?.title || '')}</p><pre>${escapeHtml(s.studentCode || '')}</pre><p class="muted">${escapeHtml(s.manualComment || s.comment || '')}</p><button class="secondary small" data-correct="${s.id}" data-score="${s.manualScore ?? s.score}" data-comment="${escapeHtml(s.manualComment || '')}">Corriger manuellement</button></article>`).join('') : '<p class="muted">Aucune réponse.</p>';
  $$('[data-correct]').forEach(btn => btn.onclick = () => openManualCorrection(btn.dataset.correct, btn.dataset.score, btn.dataset.comment));
}

function renderTeacherStats() {
  $('#bestStudents').innerHTML = (state.dashboard.best || []).map(s => `<div class="rank-item"><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.className)} • ${s.submissions} exos</small></div><strong>${s.average}/10</strong></div>`).join('') || '<p class="muted">Aucun score.</p>';
  $('#weakStudents').innerHTML = (state.dashboard.difficulty || []).map(s => `<div class="rank-item"><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.className)} • ${s.submissions} exos</small></div><strong>${s.average}/10</strong></div>`).join('') || '<p class="muted">Aucun élève en difficulté.</p>';
  $('#classStatsTable').innerHTML = `<thead><tr><th>Classe</th><th>Niveau</th><th>Élèves</th><th>Exercices réalisés</th><th>Moyenne</th></tr></thead><tbody>${(state.dashboard.classStats || []).map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${c.level}</td><td>${c.studentCount}</td><td>${c.submissions}</td><td>${c.average}/10</td></tr>`).join('') || '<tr><td colspan="5">Aucune statistique.</td></tr>'}</tbody>`;
}

function formatAssign(a = {}) {
  if (!a || a.type === 'all') return 'Tous les élèves';
  if (a.type === 'class') return `Classe : ${escapeHtml(a.className || '')}`;
  if (a.type === 'student') return `Élève : ${escapeHtml(a.studentId || '')}`;
  return 'Tous les élèves';
}

async function createClass(event) {
  event.preventDefault();
  try {
    await api('/api/classes', { method: 'POST', teacher: true, body: JSON.stringify({ name: $('#className').value, level: $('#classLevel').value }) });
    event.target.reset();
    await loadTeacher();
    toast('Classe créée.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function createStudent(event) {
  event.preventDefault();
  try {
    await api('/api/students', { method: 'POST', teacher: true, body: JSON.stringify({ name: $('#newStudentName').value, className: $('#newStudentClass').value, level: $('#newStudentLevel').value }) });
    event.target.reset();
    await loadTeacher();
    toast('Élève ajouté.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function createExercise(event) {
  event.preventDefault();
  const assignType = $('#assignType').value;
  const assignValue = $('#assignValue').value.trim();
  const assignedTo = assignType === 'all' ? { type: 'all' } : assignType === 'class' ? { type: 'class', className: assignValue } : { type: 'student', studentId: assignValue };
  try {
    await api('/api/exercises', { method: 'POST', teacher: true, body: JSON.stringify({ level: $('#exerciseFormLevel').value, title: $('#exerciseFormTitle').value, description: $('#exerciseFormDescription').value, hint: $('#exerciseFormHint').value, solution: $('#exerciseFormSolution').value, assignedTo }) });
    event.target.reset();
    await loadTeacher();
    toast('Exercice créé.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function generateTeacherExercise() {
  try {
    $('#generateTeacherExercise').disabled = true;
    const level = $('#exerciseFormLevel').value;
    const ex = await api('/api/teacher/generate-exercise', { method: 'POST', teacher: true, body: JSON.stringify({ level }) });
    $('#exerciseFormTitle').value = ex.title || '';
    $('#exerciseFormDescription').value = ex.description || '';
    $('#exerciseFormHint').value = ex.hint || '';
    $('#exerciseFormSolution').value = ex.solution || '';
    if (ex.warning) toast('Exercice local généré car Gemini n’a pas répondu.', 'warn');
  } catch (e) { toast(e.message, 'error'); }
  finally { $('#generateTeacherExercise').disabled = false; }
}

function openManualCorrection(id, score, comment) {
  $('#manualSubmissionId').value = id;
  $('#manualScore').value = score || 0;
  $('#manualComment').value = comment || '';
  $('#manualCorrectionDialog').showModal();
}

async function saveManualCorrection(event) {
  event.preventDefault();
  try {
    await api(`/api/submissions/${$('#manualSubmissionId').value}`, { method: 'PATCH', teacher: true, body: JSON.stringify({ manualScore: $('#manualScore').value, manualComment: $('#manualComment').value }) });
    $('#manualCorrectionDialog').close();
    await loadTeacher();
    toast('Correction enregistrée.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function logout() {
  state.student = null;
  state.teacherToken = '';
  state.teacherName = '';
  localStorage.removeItem('xlogo_student');
  localStorage.removeItem('xlogo_teacher_token');
  localStorage.removeItem('xlogo_teacher_name');
  $('#studentLogin').classList.remove('hidden');
  $('#studentWorkspace').classList.add('hidden');
  $('#teacherLogin').classList.remove('hidden');
  $('#teacherDashboard').classList.add('hidden');
  updateSessionUi();
  setView('home');
}

function drawHomeDemo() {
  homeTurtle = new XLogoEngine($('#homeCanvas'));
  try { runXLogo('COULEURCRAYON cyan\nREPETE 12 [REPETE 4 [AVANCE 45 DROITE 90] DROITE 30]', homeTurtle); } catch {}
}

function bindEvents() {
  $$('#homeBtn, [data-go]').forEach(el => el.addEventListener('click', () => setView(el.dataset.go || 'home')));
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#logoutBtn').addEventListener('click', logout);
  $('#studentForm').addEventListener('submit', studentLogin);
  $('#teacherForm').addEventListener('submit', teacherLogin);
  $('#newExerciseBtn').addEventListener('click', generateExercise);
  $('#hintBtn').addEventListener('click', () => $('#hintBox').classList.toggle('hidden'));
  $('#solutionBtn').addEventListener('click', () => $('#solutionDialog').showModal());
  $('#copySolutionBtn').addEventListener('click', async () => { await navigator.clipboard.writeText(state.currentExercise?.solution || ''); toast('Solution copiée.', 'success'); });
  $('#runBtn').addEventListener('click', runCurrentCode);
  $('#evaluateBtn').addEventListener('click', evaluateCurrentCode);
  $('#resetCanvasBtn').addEventListener('click', resetCanvas);
  $('#exportPngBtn').addEventListener('click', exportPng);
  $('#codeEditor').addEventListener('input', saveDraft);
  $('#refreshTeacherBtn').addEventListener('click', loadTeacher);
  $('#classForm').addEventListener('submit', createClass);
  $('#studentCreateForm').addEventListener('submit', createStudent);
  $('#addStudentBtn').addEventListener('click', () => $('#studentCreateForm').classList.toggle('hidden'));
  $('#exerciseForm').addEventListener('submit', createExercise);
  $('#generateTeacherExercise').addEventListener('click', generateTeacherExercise);
  $('#applyStudentFilters').addEventListener('click', loadTeacher);
  $('#applySubmissionFilters').addEventListener('click', loadTeacher);
  $('#manualCorrectionForm').addEventListener('submit', saveManualCorrection);
  $('#closeManualCorrection').addEventListener('click', () => $('#manualCorrectionDialog').close());
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`#tab-${tab.dataset.tab}`).classList.add('active');
  }));
}

async function init() {
  initTheme();
  bindEvents();
  turtle = new XLogoEngine($('#turtleCanvas'));
  drawHomeDemo();
  updateSessionUi();
  if (state.student) {
    $('#studentLogin').classList.add('hidden');
    $('#studentWorkspace').classList.remove('hidden');
    $('#studentName').value = state.student.name;
    $('#studentClass').value = state.student.className;
    $('#studentLevel').value = state.student.level;
    try {
      await loadStudentSubmissions();
      await loadAssignedExerciseOrGenerate();
    } catch (e) { toast(e.message, 'error'); }
  }
  if (state.teacherToken) {
    $('#teacherLogin').classList.add('hidden');
    $('#teacherDashboard').classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', init);
