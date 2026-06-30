// ===================== STATE =====================
const LS_PROGRAM = 'runtimer_program';
const LS_V2 = 'runtimer_v2';
// chaves antigas (apenas para migracao one-shot)
const LS_OLD_WEEK = 'runtimer_week';
const LS_OLD_DONE = 'runtimer_done';
const LS_OLD_HIST = 'runtimer_history';

let catalog = [];        // lista de programas (programs.json)
let program = null;      // programa carregado { id, name, weeks: [...] }
let WEEKS = [];          // atalho para program.weeks (com blocos derivados)
let currentWeek = 0;     // indice da semana
let blockIdx = 0;
let elapsed = 0;
let startTime = 0;
let ticker = null;
let wakeLock = null;

const $ = id => document.getElementById(id);

// ===================== HELPERS =====================
function fmt(s) {
  const m = Math.floor(s / 60), ss = s % 60;
  return m + ':' + String(ss).padStart(2, '0');
}
function fmtDur(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  if (s === 0) return m + ' min';
  if (m === 0) return s + 's';
  return m + ' min ' + s + 's';
}

// dialogo de confirmacao generico. Retorna uma Promise<boolean>:
// resolve true se o usuario confirmar, false se cancelar.
// Uso: if (await confirmDialog('Apagar?', 'Apagar')) { ... }
function confirmDialog(title, confirmLabel = 'OK', cancelLabel = 'Cancelar') {
  return new Promise(resolve => {
    const ov = $('confirm-overlay');
    $('confirm-title').textContent = title;
    $('confirm-yes').textContent = confirmLabel;
    $('confirm-no').textContent = cancelLabel;
    ov.classList.add('active');
    const close = (result) => {
      ov.classList.remove('active');
      $('confirm-yes').onclick = null;
      $('confirm-no').onclick = null;
      resolve(result);
    };
    $('confirm-yes').onclick = () => close(true);
    $('confirm-no').onclick = () => close(false);
  });
}

// deriva o label de um bloco a partir dos tempos (nunca lido do JSON)
function deriveLabel(block, i, total) {
  const dur = block.end - block.start;
  if (i === 0) return 'Warm-up walk (' + fmtDur(dur) + ')';
  if (i === total - 1) return 'Cool-down walk (' + fmtDur(dur) + ')';
  return (block.type === 'run' ? 'Run' : 'Walk') + ' (' + fmtDur(dur) + ')';
}

// converte os blocos crus do JSON (["type", duracaoEmSegundos]) em objetos com
// start/end em segundos (acumulando as duracoes), label derivado e display
// "MM:SS-MM:SS"
function buildWeek(week) {
  const n = week.blocos.length;
  let acc = 0;
  const blocos = week.blocos.map((raw, i) => {
    const type = raw[0];
    const dur = Number(raw[1]);
    const start = acc;
    const end = acc + dur;
    acc = end;
    return {
      start, end, type,
      label: deriveLabel({ start, end, type }, i, n),
      display: fmt(start) + '-' + fmt(end)
    };
  });
  return { n: week.n, fase: week.fase, total: week.total, blocos };
}

// ===================== VALIDATION =====================
// retorna null se ok, ou uma string descrevendo o primeiro erro encontrado.
// No formato por-duracao nao existem buracos/sobreposicao por construcao;
// basta garantir que cada bloco tenha tipo valido e duracao positiva.
function validateProgram(prog) {
  if (!prog.weeks || prog.weeks.length === 0) return 'Programa sem semanas.';
  for (const w of prog.weeks) {
    if (!w.blocos || w.blocos.length === 0)
      return 'Semana ' + w.n + ' sem blocos.';
    for (let i = 0; i < w.blocos.length; i++) {
      const raw = w.blocos[i];
      const type = raw[0];
      const dur = Number(raw[1]);
      if (type !== 'run' && type !== 'walk')
        return 'Semana ' + w.n + ', bloco ' + (i + 1) + ': tipo invalido (' + type + ').';
      if (!Number.isFinite(dur) || dur <= 0)
        return 'Semana ' + w.n + ', bloco ' + (i + 1) + ': duracao invalida (' + raw[1] + ').';
    }
  }
  return null;
}

// ===================== PERSISTENCE (por-programa) =====================
function loadStore() {
  return JSON.parse(localStorage.getItem(LS_V2) || '{}');
}
function saveStore(store) {
  localStorage.setItem(LS_V2, JSON.stringify(store));
}
function getProgress(pid) {
  const store = loadStore();
  return store[pid] || { week: 0, done: [], history: [] };
}
function setProgress(pid, progress) {
  const store = loadStore();
  store[pid] = progress;
  saveStore(store);
}

function savedWeek(pid) { return getProgress(pid).week || 0; }
function doneWeeks(pid) { return getProgress(pid).done || []; }
function markDone(pid, n) {
  const p = getProgress(pid);
  if (!p.done.includes(n)) p.done.push(n);
  setProgress(pid, p);
}
function setSavedWeek(pid, weekIdx) {
  const p = getProgress(pid);
  p.week = weekIdx;
  setProgress(pid, p);
}
function addHistory(pid, weekN, action, durationSecs) {
  const p = getProgress(pid);
  const date = new Date().toLocaleDateString('pt-BR');
  const dur = Math.floor(durationSecs / 60) + ' min';
  p.history = p.history || [];
  p.history.unshift({ date, week: weekN, action, dur, ts: Date.now() });
  setProgress(pid, p);
}

// migracao one-shot do formato antigo (global) -> c25k_16week
function migrateOldData() {
  if (localStorage.getItem(LS_V2)) return; // ja migrado / formato novo existe
  const oldWeek = localStorage.getItem(LS_OLD_WEEK);
  if (oldWeek === null) return; // nada para migrar
  const store = {};
  store['c25k_16week'] = {
    week: parseInt(oldWeek) || 0,
    done: JSON.parse(localStorage.getItem(LS_OLD_DONE) || '[]'),
    history: JSON.parse(localStorage.getItem(LS_OLD_HIST) || '[]')
  };
  saveStore(store);
  localStorage.setItem(LS_PROGRAM, 'c25k_16week');
  // chaves antigas sao mantidas como backup, mas nao serao mais lidas
}

// ===================== SCREEN NAV =====================
function hideAllScreens() {
  ['screen-programs', 'screen-select', 'screen-workout', 'screen-done', 'screen-history']
    .forEach(id => $(id).classList.remove('active'));
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ===================== PROGRAMS SCREEN =====================
async function loadCatalog() {
  const res = await fetch('./data/programs.json');
  const data = await res.json();
  catalog = data.programs || [];
}

function showPrograms() {
  hideAllScreens();
  $('screen-programs').classList.add('active');
  const list = $('program-list');
  list.innerHTML = '';
  catalog.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'program-card' + (p.available ? '' : ' unavailable');
    btn.innerHTML =
      '<div class="prog-name">' + p.name + '</div>' +
      '<div class="prog-sub">' + (p.subtitle || '') + '</div>' +
      (p.available ? '' : '<div class="prog-badge">Em breve</div>');
    btn.onclick = () => selectProgram(p);
    list.appendChild(btn);
  });
  renderRecentHistory();
}

// agrega o historico de todos os programas e mostra as 5 sessoes mais recentes
// na tela inicial. Entradas antigas sem timestamp caem para o parse da data
// dd/mm/yyyy (sem hora). Entradas mais novas usam o campo ts (ms).
function daysAgoLabel(dateStr, ts) {
  let then;
  if (ts) {
    then = new Date(ts);
  } else if (dateStr) {
    const [d, m, y] = dateStr.split('/').map(Number);
    then = new Date(y, m - 1, d);
  } else {
    return dateStr || '';
  }
  const now = new Date();
  const diffMs = now - then;
  const days = Math.floor(diffMs / 86400000);
  if (days === 0) return '(hoje) ' + dateStr;
  if (days === 1) return '(1d) ' + dateStr;
  return '(' + days + 'd) ' + dateStr;
}

function recentSessions(limit = 5) {
  const store = loadStore();
  const nameById = {};
  catalog.forEach(p => { nameById[p.id] = p.name; });
  const all = [];
  Object.keys(store).forEach(pid => {
    (store[pid].history || []).forEach(h => {
      let ts = h.ts;
      if (ts == null && h.date) {
        const [d, m, y] = h.date.split('/').map(Number);
        if (y && m && d) ts = new Date(y, m - 1, d).getTime();
      }
      all.push({ ...h, ts: ts || 0, programName: nameById[pid] || pid });
    });
  });
  all.sort((a, b) => b.ts - a.ts);
  return all.slice(0, limit);
}

function renderRecentHistory() {
  const box = $('recent-history');
  const sessions = recentSessions(5);
  if (sessions.length === 0) { box.innerHTML = ''; return; }
  box.innerHTML =
    '<h3 class="recent-title">Últimas sessões</h3>' +
    sessions.map(h => `
      <div class="recent-row">
        <div>
          <div class="recent-prog">${h.programName} · Week ${h.week}</div>
          <div class="hist-action-${h.action}">${h.action === 'advance' ? 'Advanced to next week' : 'Repeat week'}</div>
        </div>
        <div class="hist-meta">${daysAgoLabel(h.date, h.ts)}<br>${h.dur}</div>
      </div>`).join('');
}

async function selectProgram(p) {
  if (!p.available || !p.file) {
    toast('Este treino ainda não está disponível');
    return;
  }
  try {
    const res = await fetch(p.file);
    const data = await res.json();
    const err = validateProgram(data);
    if (err) {
      toast('Treino inválido: ' + err);
      return;
    }
    loadProgram(data);
    localStorage.setItem(LS_PROGRAM, data.id);
    currentWeek = savedWeek(data.id);
    showSelect();
  } catch (e) {
    toast('Erro ao carregar o treino.');
  }
}

// carrega um programa ja validado para o estado e deriva os blocos das semanas
function loadProgram(data) {
  program = data;
  WEEKS = data.weeks.map(buildWeek);
}

// ===================== SELECT SCREEN =====================
function showSelect() {
  hideAllScreens();
  $('screen-select').classList.add('active');
  renderSelect();
}

function renderSelect() {
  const w = WEEKS[currentWeek];
  $('prog-header').textContent = program.name;
  $('sel-week').textContent = 'Week ' + w.n;
  $('sel-fase').textContent = w.fase;
  $('sel-total').textContent = w.total;
  const done = doneWeeks(program.id);
  $('saved-note').textContent = done.includes(w.n) ? 'Week ' + w.n + ' completed before' : '';
  renderSelectRecentHistory();
}

function renderSelectRecentHistory() {
  const box = $('select-recent-history');
  const hist = (getProgress(program.id).history || []).slice(0, 5);
  if (hist.length === 0) { box.innerHTML = ''; return; }
  box.innerHTML =
    '<h3 class="recent-title">Últimas sessões</h3>' +
    hist.map(h => `
      <div class="recent-row">
        <div>
          <div class="recent-prog">Week ${h.week}</div>
          <div class="hist-action-${h.action}">${h.action === 'advance' ? 'Advanced to next week' : 'Repeat week'}</div>
        </div>
        <div class="hist-meta">${daysAgoLabel(h.date, h.ts)}<br>${h.dur}</div>
      </div>`).join('');
}

$('btn-prev').onclick = () => { if (currentWeek > 0) { currentWeek--; renderSelect(); } };
$('btn-next-week').onclick = () => { if (currentWeek < WEEKS.length - 1) { currentWeek++; renderSelect(); } };
$('btn-start').onclick = startWorkout;
$('btn-change-program').onclick = () => showPrograms();

// ===================== HISTORY =====================
function showHistory() {
  hideAllScreens();
  $('screen-history').classList.add('active');
  renderHistory();
}

function renderHistory() {
  const hist = getProgress(program.id).history || [];
  const list = $('history-list');
  if (hist.length === 0) {
    list.innerHTML = '<p style="color:#555;text-align:center;margin-top:40px">No sessions yet.</p>';
    return;
  }
  list.innerHTML = hist.map((h, i) => `
    <div class="hist-row">
      <div>
        <div class="hist-week">Week ${h.week}</div>
        <div class="hist-action-${h.action}">${h.action === 'advance' ? 'Advanced to next week' : 'Repeat week'}</div>
      </div>
      <div class="hist-meta">${h.date}<br>${h.dur}</div>
      <button class="hist-del" data-idx="${i}" aria-label="Delete entry">&#10005;</button>
    </div>`).join('');
}

function deleteHistory(idx) {
  const p = getProgress(program.id);
  if (!p.history || idx < 0 || idx >= p.history.length) return;
  p.history.splice(idx, 1);
  setProgress(program.id, p);
  renderHistory();
}

$('history-list').onclick = async (e) => {
  const btn = e.target.closest('.hist-del');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx);
  if (await confirmDialog('Apagar este registro?', 'Apagar', 'Cancelar')) {
    deleteHistory(idx);
  }
};
$('btn-history').onclick = showHistory;
$('btn-back-history').onclick = () => showSelect();

// ===================== WORKOUT =====================
function buildBlocksList() {
  const w = WEEKS[currentWeek];
  const ul = $('blocks-list');
  ul.innerHTML = '';
  w.blocos.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'block-row ' + b.type;
    row.id = 'blk-' + i;
    row.innerHTML = `<div class="block-dot"></div><span>${b.label}</span><span class="block-time">${b.display}</span>`;
    ul.appendChild(row);
  });
}

function updateBlocksList() {
  const w = WEEKS[currentWeek];
  w.blocos.forEach((_, i) => {
    const row = $('blk-' + i);
    if (!row) return;
    row.classList.remove('current', 'done');
    if (i === blockIdx) row.classList.add('current');
    else if (i < blockIdx) row.classList.add('done');
  });
}

function startWorkout() {
  blockIdx = 0;
  elapsed = 0;
  startTime = Date.now();
  buildBlocksList();
  hideAllScreens();
  $('screen-workout').classList.add('active');
  acquireWakeLock();
  playSound(WEEKS[currentWeek].blocos[0].type);
  tick();
  ticker = setInterval(tick, 1000);
}

function tick() {
  const w = WEEKS[currentWeek];
  elapsed = Math.floor((Date.now() - startTime) / 1000);

  // avanca blockIdx para onde realmente estamos (lida com background)
  while (blockIdx < w.blocos.length - 1 && elapsed >= w.blocos[blockIdx].end) {
    blockIdx++;
    playSound(w.blocos[blockIdx].type);
  }

  if (elapsed >= w.blocos[w.blocos.length - 1].end) {
    finishWorkout();
    return;
  }

  const b = w.blocos[blockIdx];
  const blockRemain = b.end - elapsed;

  $('wk-title').textContent = 'Week ' + w.n;
  $('wk-block-count').textContent = 'Block ' + (blockIdx + 1) + '/' + w.blocos.length;

  $('cur-type').textContent = b.type === 'run' ? 'RUN' : 'WALK';
  $('cur-type').className = 'current-type ' + b.type;
  $('cur-time').textContent = fmt(blockRemain);

  const next = w.blocos[blockIdx + 1];
  if (next) {
    $('next-info').innerHTML = 'Next: <span>' + (next.type === 'run' ? 'Run' : 'Walk') + '</span> in ' + fmt(blockRemain);
  } else {
    $('next-info').textContent = 'Last block!';
  }

  const totalSecs = w.blocos[w.blocos.length - 1].end;
  const pct = Math.min(100, Math.round(elapsed / totalSecs * 100));
  $('prog-bar').style.width = pct + '%';
  $('prog-label').textContent = fmt(elapsed) + ' / ' + fmt(totalSecs);

  updateBlocksList();
}

function finishWorkout() {
  clearInterval(ticker);
  releaseWakeLock();
  playSound('done');
  markDone(program.id, WEEKS[currentWeek].n);
  const next = WEEKS[currentWeek + 1];
  $('done-title').textContent = 'Week ' + WEEKS[currentWeek].n + ' done!';
  $('done-sub').textContent = WEEKS[currentWeek].total;
  $('btn-next').style.display = next ? '' : 'none';
  if (next) { $('btn-next').textContent = 'Go to Week ' + next.n + ' \u25ba'; }
  $('btn-repeat').textContent = 'Repeat Week ' + WEEKS[currentWeek].n;
  hideAllScreens();
  $('screen-done').classList.add('active');
  setSavedWeek(program.id, Math.min(currentWeek + 1, WEEKS.length - 1));
}

// ===================== PAUSE / FINISH =====================
$('btn-pause').onclick = () => $('pause-overlay').classList.add('active');
$('btn-finish').onclick = async () => {
  if (await confirmDialog('Finish workout?', 'Finish', 'Cancel')) {
    clearInterval(ticker);
    releaseWakeLock();
    finishWorkout();
  }
};
$('btn-resume').onclick = () => $('pause-overlay').classList.remove('active');
$('btn-restart').onclick = () => {
  $('pause-overlay').classList.remove('active');
  clearInterval(ticker);
  startTime = Date.now();
  startWorkout();
};
$('btn-quit').onclick = () => {
  clearInterval(ticker);
  releaseWakeLock();
  $('pause-overlay').classList.remove('active');
  showSelect();
};

// ===================== DONE =====================
$('btn-next').onclick = () => {
  addHistory(program.id, WEEKS[currentWeek].n, 'advance', elapsed);
  currentWeek = Math.min(currentWeek + 1, WEEKS.length - 1);
  showSelect();
};
$('btn-repeat').onclick = () => {
  addHistory(program.id, WEEKS[currentWeek].n, 'repeat', elapsed);
  showSelect();
};

// ===================== SOUND =====================
function playSound(type) {
  const id = type === 'run' ? 'snd-run' : type === 'done' ? 'snd-done' : 'snd-walk';
  const el = $(id);
  el.currentTime = 0;
  el.play().catch(() => {});
}

// ===================== WAKELOCK =====================
async function acquireWakeLock() {
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

// ===================== INIT =====================
async function init() {
  migrateOldData();
  await loadCatalog();

  const savedPid = localStorage.getItem(LS_PROGRAM);
  if (savedPid) {
    const entry = catalog.find(p => p.id === savedPid);
    if (entry && entry.available && entry.file) {
      try {
        const res = await fetch(entry.file);
        const data = await res.json();
        if (!validateProgram(data)) {
          loadProgram(data);
          currentWeek = savedWeek(data.id);
          showSelect();
          registerSW();
          return;
        }
      } catch (e) { /* cai para o catalogo */ }
    }
  }
  showPrograms();
  registerSW();
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
}

init();
