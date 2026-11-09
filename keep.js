// keep.js — funcionalidade oculta de notas (estilo Keep), sincronizada e cifrada.
//
// Fluxo: gesto secreto (5 toques em "Versão:") abre a tela -> login (Firebase
// Auth) -> senha de criptografia (deriva a chave E2E) -> notas (add/remove) com
// sincronização em tempo real via Firestore.
//
// Segurança: o texto é cifrado no aparelho (keep-crypto.js) ANTES de subir; o
// Firestore guarda só ciphertext+iv. As regras (firestore.rules) travam tudo no
// seu UID. A config do Firebase é pública e não é segredo; suas senhas nunca
// ficam no repositório.
//
// Carregamento: o SDK do Firebase é importado dinamicamente do CDN só quando a
// tela é aberta — assim o app de corrida continua funcionando offline
// normalmente (esta tela precisa de rede para carregar o SDK e para logar).

import * as kc from './keep-crypto.js';
import * as grp from './keep-groups.js';
import * as rep from './keep-repport.js';
import { firebaseConfig, OWNER_UID, RECAPTCHA_SITE_KEY, isConfigured } from './keep-config.js';

// Versão do SDK do Firebase (CDN). Pode ser atualizada conforme necessário.
const FB = 'https://www.gstatic.com/firebasejs/10.12.2';

const $ = id => document.getElementById(id);
const LS_KEY = 'keep_key';            // chave AES cacheada (b64) — conveniência
const LS_ACTIVE = 'keep_active_group'; // grupo ativo por aparelho
const VERIFIER_TOKEN = 'keep-verifier-v1';
const REPPORT_TAB_ID = '__REPPORT__'; // ID especial para identificar a aba Repport

let fb = null;         // { app, db, authInst, auth (módulo), fs (módulo) }
let cryptoKey = null;  // CryptoKey em memória
let currentUser = null;
let unsubNotes = null;
let unsubOwner = null;         // onSnapshot do doc do dono (grupos)

// estado de grupos
let groups = [];               // [{ id, name }]
let defaultGroupId = null;
let activeGroupId = null;
let latestNotes = [];          // notas já decifradas: [{ id, payload, createdAt, ok }]
let creatingDefault = false;   // trava contra criar "Geral" em duplicidade

// ===================== GESTO SECRETO =====================
let tapCount = 0, tapTimer = null;

function wireSecretGesture() {
  ['app-version-prog', 'app-version-sel'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', onSecretTap);
  });
}

function onSecretTap() {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
  if (tapCount >= 5) {
    tapCount = 0;
    openKeep();
  }
}

function openKeep() {
  $('screen-keep').classList.add('keep-open');
  route();
}

function closeKeep() {
  $('screen-keep').classList.remove('keep-open');
}

// ===================== FIREBASE (carregado sob demanda) =====================
async function ensureFirebase() {
  if (fb) return fb;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-firestore.js`)
  ]);

  const app = appMod.initializeApp(firebaseConfig);

  // App Check (opcional): só ativa se houver site key configurada. Deve ser
  // inicializado LOGO após o app, antes de Firestore/Auth, para que os tokens
  // sejam anexados às requisições desses serviços.
  if (RECAPTCHA_SITE_KEY) {
    try {
      // Em localhost, habilita o "debug token": o reCAPTCHA não valida
      // 127.0.0.1/localhost, então o SDK imprime um token no console que você
      // registra em App Check > Apps > Gerenciar tokens de depuração. Em
      // produção (github.io) isto fica desligado e usa o reCAPTCHA de verdade.
      const host = location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      const ac = await import(`${FB}/firebase-app-check.js`);
      ac.initializeAppCheck(app, {
        provider: new ac.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    } catch (e) { console.warn('[keep] App Check indisponível', e); }
  }

  // Firestore com cache offline persistente (IndexedDB): as notas ficam
  // disponíveis offline e as escritas entram em fila até reconectar.
  let db;
  try {
    db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentSingleTabManager() })
    });
  } catch (e) {
    // fallback se a persistência não puder ser habilitada (ex.: aba duplicada)
    db = fsMod.getFirestore(app);
  }

  const authInst = authMod.getAuth(app);
  try { await authMod.setPersistence(authInst, authMod.browserLocalPersistence); } catch (e) {}

  fb = { app, db, authInst, auth: authMod, fs: fsMod };

  // observa o estado de login; ao mudar, re-roteia se a tela estiver aberta.
  await new Promise(resolve => {
    authMod.onAuthStateChanged(authInst, u => {
      currentUser = u;
      resolve();
      if ($('screen-keep').classList.contains('keep-open')) route();
    });
  });

  return fb;
}

// ===================== ROTEAMENTO ENTRE PAINÉIS =====================
function showPanel(id) {
  ['keep-notconfigured', 'keep-login', 'keep-unlock', 'keep-notes'].forEach(p => {
    const el = $(p);
    if (el) el.style.display = (p === id) ? 'flex' : 'none';
  });
}

async function route() {
  if (!isConfigured()) { showPanel('keep-notconfigured'); return; }

  try {
    await ensureFirebase();
  } catch (e) {
    showPanel('keep-login');
    $('keep-login-error').textContent = 'Sem conexão para carregar o Firebase. Conecte-se e tente novamente.';
    return;
  }

  if (!currentUser) { showPanel('keep-login'); return; }

  // logado: tenta usar a chave cacheada (conveniência)
  if (!cryptoKey) {
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      try { cryptoKey = await kc.importKey(cached); }
      catch (e) { cryptoKey = null; localStorage.removeItem(LS_KEY); }
    }
  }

  if (!cryptoKey) { showPanel('keep-unlock'); return; }

  showPanel('keep-notes');
  subscribeOwner();
  subscribeNotes();
}

// ===================== LOGIN =====================
async function doLogin() {
  const errEl = $('keep-login-error');
  errEl.textContent = '';
  let f;
  try { f = await ensureFirebase(); }
  catch (e) { errEl.textContent = 'Sem conexão. Tente novamente online.'; return; }

  const email = $('keep-email').value.trim();
  const pass = $('keep-password').value;
  if (!email || !pass) { errEl.textContent = 'Preencha e-mail e senha.'; return; }

  $('keep-login-btn').disabled = true;
  try {
    await f.auth.signInWithEmailAndPassword(f.authInst, email, pass);
    $('keep-password').value = '';
    route();
  } catch (e) {
    errEl.textContent = 'Não foi possível entrar. Verifique e-mail e senha.';
  } finally {
    $('keep-login-btn').disabled = false;
  }
}

// ===================== UNLOCK (senha de criptografia) =====================
async function doUnlock() {
  const errEl = $('keep-unlock-error');
  errEl.textContent = '';
  const pass = $('keep-passphrase').value;
  if (!pass) { errEl.textContent = 'Digite a senha de criptografia.'; return; }

  const f = fb;
  $('keep-unlock-btn').disabled = true;
  try {
    const ref = f.fs.doc(f.db, 'notes', OWNER_UID);
    const snap = await f.fs.getDoc(ref);

    let salt, verifier = null;
    if (snap.exists() && snap.data().salt) {
      salt = kc.b64ToBytes(snap.data().salt);
      verifier = snap.data().verifier || null;
    } else {
      salt = kc.newSalt();
    }

    const key = await kc.deriveKey(pass, salt);

    if (verifier) {
      // já existe verifier: confere se a senha está correta
      try {
        const v = await kc.decrypt(verifier, key);
        if (!v || v.token !== VERIFIER_TOKEN) throw new Error('mismatch');
      } catch (e) {
        errEl.textContent = 'Senha de criptografia incorreta.';
        return;
      }
    } else {
      // primeira vez: grava salt + verifier no doc do dono
      const v = await kc.encrypt({ token: VERIFIER_TOKEN }, key);
      await f.fs.setDoc(ref, { salt: kc.bytesToB64(salt), verifier: v }, { merge: true });
    }

    cryptoKey = key;
    localStorage.setItem(LS_KEY, await kc.exportKey(key));
    $('keep-passphrase').value = '';
    route();
  } catch (e) {
    errEl.textContent = 'Erro ao destravar. Você está online?';
  } finally {
    $('keep-unlock-btn').disabled = false;
  }
}

// ===================== GRUPOS (sync via doc do dono) =====================
function subscribeOwner() {
  if (unsubOwner) return;
  const f = fb;
  const ref = f.fs.doc(f.db, 'notes', OWNER_UID);
  unsubOwner = f.fs.onSnapshot(ref, async snap => {
    const data = snap.exists() ? snap.data() : null;
    if (data && data.groupsEnc) {
      try {
        const obj = await kc.decrypt(data.groupsEnc, cryptoKey);
        groups = Array.isArray(obj.groups) ? obj.groups : [];
        defaultGroupId = obj.defaultId || (groups[0] && groups[0].id) || null;
      } catch (e) { /* chave incompatível: ignora e mantém o estado atual */ }
    } else if (!creatingDefault) {
      // primeira vez (ou conta legada sem grupos): cria "Geral" e migra as
      // notas existentes para ele implicitamente (elas não têm groupId e são
      // resolvidas para o defaultId em tempo de render).
      creatingDefault = true;
      const g0 = grp.makeGroup('Geral');
      groups = [g0];
      defaultGroupId = g0.id;
      // persiste sem bloquear (offline: entra em fila). creatingDefault
      // permanece true até resolver, evitando criar "Geral" em duplicidade.
      persistGroups()
        .catch(() => { /* offline: será re-tentado ao reconectar */ })
        .finally(() => { creatingDefault = false; });
    }
    ensureActiveGroupValid();
    renderAll();
  }, err => { $('keep-status').textContent = 'Erro ao sincronizar grupos: ' + (err.code || err); });
}

async function persistGroups() {
  const f = fb;
  const enc = await kc.encrypt({ groups, defaultId: defaultGroupId }, cryptoKey);
  const ref = f.fs.doc(f.db, 'notes', OWNER_UID);
  await f.fs.setDoc(ref, { groupsEnc: enc }, { merge: true });
}

function ensureActiveGroupValid() {
  const saved = activeGroupId || localStorage.getItem(LS_ACTIVE);
  if (saved && groups.some(g => g.id === saved)) { activeGroupId = saved; return; }
  activeGroupId = defaultGroupId || (groups[0] && groups[0].id) || null;
}

function setActiveGroup(id) {
  activeGroupId = id;
  try { localStorage.setItem(LS_ACTIVE, id); } catch (e) {}
  renderAll();
}

// ===================== NOTAS (sync em tempo real) =====================
function subscribeNotes() {
  if (unsubNotes) return;
  const f = fb;
  const col = f.fs.collection(f.db, 'notes', OWNER_UID, 'items');
  const q = f.fs.query(col, f.fs.orderBy('createdAt', 'desc'));
  unsubNotes = f.fs.onSnapshot(q,
    async snap => {
      latestNotes = await decryptAll(snap.docs.map(d => ({ id: d.id, data: d.data() })));
      renderAll();
    },
    err => { $('keep-status').textContent = 'Erro de sincronização: ' + (err.code || err); }
  );
}

async function decryptAll(raw) {
  const out = [];
  for (const it of raw) {
    let payload, ok = true;
    try {
      payload = await kc.decrypt({ ciphertext: it.data.ciphertext, iv: it.data.iv }, cryptoKey);
    } catch (e) {
      ok = false;
      payload = { text: '[não foi possível decifrar esta nota]' };
    }
    out.push({ id: it.id, payload, createdAt: it.data.createdAt, ok });
  }
  return out;
}

function renderAll() {
  renderTabs();
  renderNotesList();
  migrateOrdersIfNeeded();
}

// ===================== ORDER: MIGRAÇÃO LAZY + PERSISTÊNCIA =====================
let migratingOrders = false;

// Detecta grupos cujas notas ainda não têm `order` (contas legadas) e atribui um
// order sequencial baseado na ordem visual atual (createdAt desc → 0,1,2…),
// re-cifrando e gravando cada nota afetada. É idempotente: assim que todas as
// notas do grupo têm order, nada mais é escrito (evita loop com o onSnapshot).
async function migrateOrdersIfNeeded() {
  if (migratingOrders || !cryptoKey || !fb || !groups.length) return;
  const changes = [];
  for (const g of groups) {
    const inGroup = grp.notesForGroup(latestNotes, g.id, groups, defaultGroupId);
    const needs = inGroup.some(n => typeof (n.payload && n.payload.order) !== 'number');
    if (!needs) continue;
    // sem order, sortNotesByOrder cai no fallback createdAt desc (mais nova no topo)
    const sorted = grp.sortNotesByOrder(inGroup);
    const orders = grp.assignSequentialOrders(sorted);
    for (const n of sorted) {
      const cur = n.payload && n.payload.order;
      if (cur !== orders[n.id]) changes.push({ id: n.id, order: orders[n.id] });
    }
  }
  if (!changes.length) return;
  migratingOrders = true;
  try { await persistNoteOrders(changes); }
  catch (e) { /* offline: será re-tentado no próximo snapshot */ }
  finally { migratingOrders = false; }
}

// Re-cifra e grava o novo `order` das notas indicadas (mantém text/groupId).
async function persistNoteOrders(changes) {
  const f = fb;
  for (const ch of changes) {
    const note = latestNotes.find(n => n.id === ch.id);
    if (!note || !note.ok) continue; // não mexe em nota que não decifrou
    const newPayload = { ...note.payload, order: ch.order };
    const enc = await kc.encrypt(newPayload, cryptoKey);
    await f.fs.updateDoc(f.fs.doc(f.db, 'notes', OWNER_UID, 'items', ch.id), {
      ciphertext: enc.ciphertext, iv: enc.iv
    });
  }
}

function renderTabs() {
  const bar = $('keep-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  
  // Aba fixa REPPORT (sempre primeira)
  const repportTab = document.createElement('button');
  repportTab.className = 'keep-tab keep-tab-repport' + (activeGroupId === REPPORT_TAB_ID ? ' keep-tab-active' : '');
  repportTab.textContent = 'Repport';
  repportTab.title = 'Diário write-only';
  repportTab.onclick = () => { if (activeGroupId !== REPPORT_TAB_ID) setActiveGroup(REPPORT_TAB_ID); };
  bar.appendChild(repportTab);
  
  // Separador visual (opcional)
  const sep = document.createElement('div');
  sep.className = 'keep-tab-separator';
  bar.appendChild(sep);
  
  // Grupos normais
  for (const g of groups) {
    const tab = document.createElement('button');
    tab.className = 'keep-tab' + (g.id === activeGroupId ? ' keep-tab-active' : '');
    tab.textContent = g.name;
    tab.title = 'Toque para abrir · segure para gerenciar';
    const tprog = document.createElement('div');
    tprog.className = 'keep-holdprogress';
    tab.appendChild(tprog);
    tab.onclick = () => { if (g.id !== activeGroupId) setActiveGroup(g.id); };
    attachLongPress(tab, { onTrigger: () => groupActionSheet(g) });
    bar.appendChild(tab);
  }
  const add = document.createElement('button');
  add.className = 'keep-tab keep-tab-add';
  add.textContent = '+';
  add.setAttribute('aria-label', 'Novo grupo');
  add.onclick = () => createGroupFlow();
  bar.appendChild(add);
}

function renderNotesList() {
  const list = $('keep-list');
  if (!list) return;
  list.innerHTML = '';
  $('keep-status').textContent = '';
  
  // Se a aba Repport está ativa, mostra placeholder explicativo (write-only)
  if (activeGroupId === REPPORT_TAB_ID) {
    list.innerHTML = '<div class="keep-empty">🔒 Repport é write-only.<br>As entradas são salvas cifradas e não aparecem aqui.<br>Use o script de leitura no computador para acessá-las.</div>';
    return;
  }
  
  // Abas normais: mostra as notas do grupo
  const items = grp.sortNotesByOrder(grp.notesForGroup(latestNotes, activeGroupId, groups, defaultGroupId));
  if (!items.length) {
    list.innerHTML = '<div class="keep-empty">Nenhuma nota neste grupo.</div>';
    return;
  }

  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'keep-note';
    row.title = 'Segure para opções';

    // barra de progresso do long-press (preenche enquanto segura)
    const prog = document.createElement('div');
    prog.className = 'keep-holdprogress';
    row.appendChild(prog);

    const body = document.createElement('div');
    body.className = 'keep-note-text' + (it.ok ? '' : ' keep-note-undecipherable');
    body.textContent = it.payload.text;

    row.appendChild(body);
    attachLongPress(row, { onTrigger: () => noteActionSheet(it) });
    list.appendChild(row);
  }
}

function confirmDeleteNote(it) {
  const snippet = grp.truncateSnippet(it.payload.text, 40);
  confirmDialog({
    title: 'Apagar nota',
    message: `Apagar a nota "${snippet}"?`,
    confirmText: 'Apagar',
    onConfirm: () => deleteNote(it.id)
  });
}

// Action sheet da nota (long-press): mover na ordem, apagar.
function noteActionSheet(it) {
  const gid = grp.resolveEffectiveGroupId(it.payload, groups, defaultGroupId);
  const sorted = grp.sortNotesByOrder(grp.notesForGroup(latestNotes, gid, groups, defaultGroupId));
  const idx = sorted.findIndex(n => n.id === it.id);
  const actions = [];
  actions.push({ label: 'Editar', onClick: () => { closeModal(); editNoteFlow(it); } });
  if (idx > 0) {
    actions.push({ label: '↑ Mover para cima', onClick: () => { closeModal(); moveNoteBy(it, 'up'); } });
  }
  if (idx > -1 && idx < sorted.length - 1) {
    actions.push({ label: '↓ Mover para baixo', onClick: () => { closeModal(); moveNoteBy(it, 'down'); } });
  }
  actions.push({ label: 'Apagar', danger: true, onClick: () => { closeModal(); confirmDeleteNote(it); } });
  actions.push({ label: 'Fechar', onClick: () => closeModal() });
  openModal({
    title: 'Nota',
    message: grp.truncateSnippet(it.payload.text, 60),
    actions
  });
}

function moveNoteBy(it, direction) {
  let changes;
  try { changes = grp.moveNote(latestNotes, it.id, direction, groups, defaultGroupId); }
  catch (e) { $('keep-status').textContent = e.message; return; }
  if (!changes.length) return; // já no extremo
  // atualiza otimista o estado local para refletir na hora, depois persiste.
  for (const ch of changes) {
    const n = latestNotes.find(x => x.id === ch.id);
    if (n) n.payload = { ...n.payload, order: ch.order };
  }
  renderNotesList();
  persistNoteOrders(changes).catch(err => { $('keep-status').textContent = 'Erro ao reordenar: ' + (err.code || err); });
}

// Editar o texto de uma nota (mesmo esquema do renomear grupo, mas multilinha).
// Mantém groupId e order; só troca o texto. Re-cifra e atualiza o doc.
function editNoteFlow(it) {
  if (!it.ok) { infoDialog('Não é possível editar', 'Esta nota não pôde ser decifrada.'); return; }
  openModal({
    title: 'Editar nota',
    input: { multiline: true, placeholder: 'Texto da nota', value: it.payload.text || '' },
    actions: [
      { label: 'Cancelar', onClick: () => closeModal() },
      { label: 'Salvar', primary: true, onClick: (val) => {
          const text = (val || '').trim();
          if (!text) { modalError('A nota não pode ficar vazia.'); return; }
          if (text === (it.payload.text || '')) { closeModal(); return; } // sem mudança
          closeModal();
          saveNoteEdit(it, text);
        } }
    ]
  });
}

function saveNoteEdit(it, text) {
  const f = fb;
  const newPayload = { ...it.payload, text };
  // update otimista para refletir na hora
  const local = latestNotes.find(n => n.id === it.id);
  if (local) local.payload = newPayload;
  renderNotesList();
  kc.encrypt(newPayload, cryptoKey).then(enc =>
    f.fs.updateDoc(f.fs.doc(f.db, 'notes', OWNER_UID, 'items', it.id), {
      ciphertext: enc.ciphertext, iv: enc.iv
    })
  ).catch(err => { $('keep-status').textContent = 'Erro ao editar: ' + (err.code || err); });
}

function addNote() {
  const ta = $('keep-new');
  const text = ta.value.trim();
  if (!text || !cryptoKey) return;
  
  // Se a aba Repport está ativa, salva como repport (write-only)
  if (activeGroupId === REPPORT_TAB_ID) {
    addRepport();
    return;
  }
  
  // Salva como nota normal
  const f = fb;
  const gid = activeGroupId || defaultGroupId;
  // order = max do grupo + 1: a nova nota entra no FINAL da lista.
  const order = grp.nextOrderForGroup(latestNotes, gid, groups, defaultGroupId);
  // não bloqueia a UI: offline, a escrita entra em fila e o onSnapshot já
  // mostra a nota a partir do cache local (latency compensation).
  kc.encrypt({ text, groupId: gid, order }, cryptoKey).then(payload => {
    const col = f.fs.collection(f.db, 'notes', OWNER_UID, 'items');
    return f.fs.addDoc(col, {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      createdAt: f.fs.serverTimestamp()
    });
  }).catch(err => { $('keep-status').textContent = 'Erro ao salvar: ' + (err.code || err); });
  ta.value = '';
}

function addRepport() {
  const ta = $('keep-new');
  const text = ta.value.trim();
  if (!text) return;
  if (!cryptoKey || !fb) {
    $('keep-status').textContent = 'Não foi possível salvar. Tente novamente.';
    return;
  }
  
  const btn = $('keep-add-btn');
  if (btn) btn.disabled = true;
  
  rep.addRepport(text, cryptoKey, fb, OWNER_UID)
    .then(() => {
      ta.value = '';
      // Feedback visual breve
      $('keep-status').textContent = '✓ Repport salvo (cifrado)';
      setTimeout(() => { $('keep-status').textContent = ''; }, 2000);
    })
    .catch(err => {
      $('keep-status').textContent = 'Erro ao salvar repport: ' + (err.message || err.code || err);
    })
    .finally(() => {
      if (btn) btn.disabled = false;
    });
}

function deleteNote(id) {
  const f = fb;
  f.fs.deleteDoc(f.fs.doc(f.db, 'notes', OWNER_UID, 'items', id))
    .catch(err => { $('keep-status').textContent = 'Erro ao apagar: ' + (err.code || err); });
}

// ===================== GERÊNCIA DE GRUPOS (criar/renomear/apagar) =====================
function createGroupFlow() {
  openModal({
    title: 'Novo grupo',
    input: { placeholder: 'Nome do grupo' },
    actions: [
      { label: 'Cancelar', onClick: () => closeModal() },
      { label: 'Criar', primary: true, onClick: (val) => {
          const name = (val || '').trim();
          if (!name) { modalError('Digite um nome.'); return; }
          let r;
          try { r = grp.addGroup(groups, name); }
          catch (e) { modalError(e.message); return; }
          groups = r.list;
          closeModal();
          setActiveGroup(r.group.id);
          // persiste sem bloquear a UI (offline: entra em fila; o onSnapshot
          // do doc do dono reflete a mudança a partir do cache local).
          persistGroups().catch(err => { $('keep-status').textContent = 'Erro ao salvar grupo: ' + (err.code || err); });
        } }
    ]
  });
}

function renameGroupFlow(g) {
  openModal({
    title: 'Renomear grupo',
    input: { placeholder: 'Nome do grupo', value: g.name },
    actions: [
      { label: 'Cancelar', onClick: () => closeModal() },
      { label: 'Salvar', primary: true, onClick: (val) => {
          const name = (val || '').trim();
          if (!name) { modalError('Digite um nome.'); return; }
          let next;
          try { next = grp.renameGroup(groups, g.id, name); }
          catch (e) { modalError(e.message); return; }
          groups = next;
          closeModal();
          renderAll();
          persistGroups().catch(err => { $('keep-status').textContent = 'Erro ao salvar grupo: ' + (err.code || err); });
        } }
    ]
  });
}

function groupActionSheet(g) {
  const counts = grp.countNotesByGroup(latestNotes, groups, defaultGroupId);
  const count = counts[g.id] || 0;
  const idx = groups.findIndex(x => x.id === g.id);
  const actions = [
    { label: 'Renomear', onClick: () => { closeModal(); renameGroupFlow(g); } }
  ];
  if (idx > 0) {
    actions.push({ label: '↑ Mover para cima', onClick: () => { closeModal(); moveGroupBy(g, 'up'); } });
  }
  if (idx > -1 && idx < groups.length - 1) {
    actions.push({ label: '↓ Mover para baixo', onClick: () => { closeModal(); moveGroupBy(g, 'down'); } });
  }
  actions.push({ label: 'Apagar', danger: true, onClick: () => { closeModal(); deleteGroupFlow(g); } });
  actions.push({ label: 'Fechar', onClick: () => closeModal() });
  openModal({
    title: g.name,
    message: count > 0 ? `${count} nota(s) neste grupo.` : 'Grupo vazio.',
    actions
  });
}

function moveGroupBy(g, direction) {
  let next;
  try { next = grp.moveGroup(groups, g.id, direction); }
  catch (e) { $('keep-status').textContent = e.message; return; }
  groups = next;
  renderAll();
  persistGroups().catch(err => { $('keep-status').textContent = 'Erro ao salvar grupo: ' + (err.code || err); });
}

function deleteGroupFlow(g) {
  const counts = grp.countNotesByGroup(latestNotes, groups, defaultGroupId);
  if ((counts[g.id] || 0) > 0) {
    infoDialog('Não é possível apagar', `Esvazie o grupo "${g.name}" antes de apagá-lo.`);
    return;
  }
  if (groups.length <= 1) {
    infoDialog('Não é possível apagar', 'É preciso manter pelo menos um grupo.');
    return;
  }
  confirmDialog({
    title: 'Apagar grupo',
    message: `Apagar o grupo "${g.name}"?`,
    confirmText: 'Apagar',
    onConfirm: () => {
      let r;
      try {
        const counts2 = grp.countNotesByGroup(latestNotes, groups, defaultGroupId);
        r = grp.removeGroup(groups, g.id, { noteCountsById: counts2, defaultId: defaultGroupId });
      } catch (e) { $('keep-status').textContent = e.message; return; }
      groups = r.list;
      defaultGroupId = r.defaultId;
      if (activeGroupId === g.id) { activeGroupId = defaultGroupId; try { localStorage.setItem(LS_ACTIVE, activeGroupId); } catch (e) {} }
      renderAll();
      persistGroups().catch(err => { $('keep-status').textContent = 'Erro ao salvar grupo: ' + (err.code || err); });
    }
  });
}

// ===================== LONG-PRESS (segurar para acionar) =====================
// Usa Pointer Events para funcionar igual em toque (celular) e mouse (Windows).
// Uma barra .keep-holdprogress dentro do elemento preenche durante o hold;
// soltar/mover antes do tempo cancela. Suprime menu de contexto no desktop.
function attachLongPress(el, { onTrigger, threshold = 700 }) {
  let timer = null, active = false, startX = 0, startY = 0;
  const MOVE_CANCEL = 12; // px de tolerância antes de cancelar

  const prog = () => el.querySelector(':scope > .keep-holdprogress');

  function start(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // só botão esquerdo
    el._lpTriggered = false;
    active = true;
    startX = e.clientX; startY = e.clientY;
    el.classList.add('keep-holding');
    const p = prog();
    if (p) {
      p.style.transition = 'none';
      p.style.width = '0%';
      void p.offsetWidth;                       // força reflow
      p.style.transition = `width ${threshold}ms linear`;
      p.style.width = '100%';
    }
    timer = setTimeout(() => {
      cleanup();
      el._lpTriggered = true;
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) {} }
      onTrigger();
    }, threshold);
  }
  function onMove(e) {
    if (!active) return;
    if (Math.abs(e.clientX - startX) > MOVE_CANCEL || Math.abs(e.clientY - startY) > MOVE_CANCEL) cleanup();
  }
  function cleanup() {
    active = false;
    if (timer) { clearTimeout(timer); timer = null; }
    el.classList.remove('keep-holding');
    const p = prog();
    if (p) { p.style.transition = 'none'; p.style.width = '0%'; }
  }

  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cleanup);
  el.addEventListener('pointercancel', cleanup);
  el.addEventListener('pointerleave', cleanup);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('contextmenu', e => e.preventDefault());
  // suprime o clique sintético que segue um long-press concluído
  el.addEventListener('click', e => {
    if (el._lpTriggered) { e.preventDefault(); e.stopImmediatePropagation(); el._lpTriggered = false; }
  }, true);
}

// ===================== MODAL GENÉRICO (confirmação / action sheet) =====================
function openModal({ title, message = '', input = null, actions = [] }) {
  $('keep-modal-title').textContent = title || '';
  const msgEl = $('keep-modal-msg');
  msgEl.textContent = message || '';
  msgEl.style.display = message ? 'block' : 'none';

  const single = $('keep-modal-input');
  const multi = $('keep-modal-textarea');
  const field = input && input.multiline ? multi : single;
  const other = input && input.multiline ? single : multi;

  if (input) {
    other.style.display = 'none';
    other.value = '';
    other.onkeydown = null;
    field.style.display = 'block';
    if ('placeholder' in field) field.placeholder = input.placeholder || '';
    field.value = input.value || '';
    field.onkeydown = e => {
      // no campo de uma linha, Enter confirma; no multilinha, Enter quebra linha
      // (confirma só pelo botão) — Ctrl/Cmd+Enter também confirma.
      const submitByKey = input.multiline
        ? (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
        : (e.key === 'Enter');
      if (submitByKey) {
        e.preventDefault();
        const primary = actions.find(a => a.primary) || actions[actions.length - 1];
        if (primary && primary.onClick) primary.onClick(field.value);
      }
    };
  } else {
    single.style.display = 'none'; single.value = ''; single.onkeydown = null;
    multi.style.display = 'none'; multi.value = ''; multi.onkeydown = null;
  }

  const actionsEl = $('keep-modal-actions');
  actionsEl.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.className = 'keep-modal-btn'
      + (a.danger ? ' keep-modal-btn-danger' : '')
      + (a.primary ? ' keep-modal-btn-primary' : '');
    b.onclick = () => { if (a.onClick) a.onClick(field ? field.value : ''); else closeModal(); };
    actionsEl.appendChild(b);
  }

  $('keep-modal').style.display = 'flex';
  if (input) setTimeout(() => { try { field.focus(); field.select(); } catch (e) {} }, 50);
}

function closeModal() {
  $('keep-modal').style.display = 'none';
  $('keep-modal-actions').innerHTML = '';
  for (const id of ['keep-modal-input', 'keep-modal-textarea']) {
    const el = $(id);
    el.style.display = 'none';
    el.value = '';
    el.onkeydown = null;
  }
}

function modalError(msg) {
  const msgEl = $('keep-modal-msg');
  msgEl.style.display = 'block';
  msgEl.textContent = msg;
}

function confirmDialog({ title, message, confirmText = 'Apagar', onConfirm }) {
  openModal({
    title, message,
    actions: [
      { label: 'Cancelar', onClick: () => closeModal() },
      { label: confirmText, danger: true, onClick: () => { closeModal(); onConfirm(); } }
    ]
  });
}

function infoDialog(title, message) {
  openModal({ title, message, actions: [{ label: 'Entendi', onClick: () => closeModal() }] });
}

// ===================== INIT =====================
function boot() {
  wireSecretGesture();

  $('keep-close').onclick = closeKeep;
  $('keep-login-btn').onclick = doLogin;
  $('keep-unlock-btn').onclick = doUnlock;
  $('keep-add-btn').onclick = addNote;

  // Enter para enviar nos campos de senha
  $('keep-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('keep-passphrase').addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); });

  // clicar fora (no backdrop) fecha o modal
  const modal = $('keep-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

// módulos ES são deferidos: o DOM já está pronto quando este código executa.
boot();
