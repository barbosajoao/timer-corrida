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
import { firebaseConfig, OWNER_UID, RECAPTCHA_SITE_KEY, isConfigured } from './keep-config.js';

// Versão do SDK do Firebase (CDN). Pode ser atualizada conforme necessário.
const FB = 'https://www.gstatic.com/firebasejs/10.12.2';

const $ = id => document.getElementById(id);
const LS_KEY = 'keep_key';            // chave AES cacheada (b64) — conveniência
const VERIFIER_TOKEN = 'keep-verifier-v1';

let fb = null;         // { app, db, authInst, auth (módulo), fs (módulo) }
let cryptoKey = null;  // CryptoKey em memória
let currentUser = null;
let unsubNotes = null;

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

// ===================== NOTAS (sync em tempo real) =====================
function subscribeNotes() {
  if (unsubNotes) return;
  const f = fb;
  const col = f.fs.collection(f.db, 'notes', OWNER_UID, 'items');
  const q = f.fs.query(col, f.fs.orderBy('createdAt', 'desc'));
  unsubNotes = f.fs.onSnapshot(q,
    snap => renderNotes(snap.docs.map(d => ({ id: d.id, data: d.data() }))),
    err => { $('keep-status').textContent = 'Erro de sincronização: ' + (err.code || err); }
  );
}

async function renderNotes(items) {
  const list = $('keep-list');
  list.innerHTML = '';
  $('keep-status').textContent = '';

  if (!items.length) {
    list.innerHTML = '<div class="keep-empty">Nenhuma nota ainda.</div>';
    return;
  }

  for (const it of items) {
    let text = '', ok = true;
    try {
      const obj = await kc.decrypt({ ciphertext: it.data.ciphertext, iv: it.data.iv }, cryptoKey);
      text = obj.text;
    } catch (e) { ok = false; }

    const row = document.createElement('div');
    row.className = 'keep-note';

    const body = document.createElement('div');
    body.className = 'keep-note-text' + (ok ? '' : ' keep-note-undecipherable');
    body.textContent = ok ? text : '[não foi possível decifrar esta nota]';

    const dateEl = document.createElement('div');
    dateEl.className = 'keep-note-date';
    const ts = it.data.createdAt && it.data.createdAt.toDate ? it.data.createdAt.toDate() : null;
    dateEl.textContent = ts ? ts.toLocaleString('pt-BR') : '(sincronizando…)';
    body.appendChild(dateEl);

    const del = document.createElement('button');
    del.className = 'keep-del';
    del.innerHTML = '&#10005;';
    del.setAttribute('aria-label', 'Apagar nota');
    del.onclick = () => deleteNote(it.id);

    row.appendChild(body);
    row.appendChild(del);
    list.appendChild(row);
  }
}

function addNote() {
  const ta = $('keep-new');
  const text = ta.value.trim();
  if (!text || !cryptoKey) return;
  const f = fb;
  // não bloqueia a UI: offline, a escrita entra em fila e o onSnapshot já
  // mostra a nota a partir do cache local (latency compensation).
  kc.encrypt({ text }, cryptoKey).then(payload => {
    const col = f.fs.collection(f.db, 'notes', OWNER_UID, 'items');
    return f.fs.addDoc(col, {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      createdAt: f.fs.serverTimestamp()
    });
  }).catch(err => { $('keep-status').textContent = 'Erro ao salvar: ' + (err.code || err); });
  ta.value = '';
}

function deleteNote(id) {
  const f = fb;
  f.fs.deleteDoc(f.fs.doc(f.db, 'notes', OWNER_UID, 'items', id))
    .catch(err => { $('keep-status').textContent = 'Erro ao apagar: ' + (err.code || err); });
}

// ===================== TRAVAR / SAIR =====================
function lock() {
  cryptoKey = null;
  localStorage.removeItem(LS_KEY);
  if (unsubNotes) { unsubNotes(); unsubNotes = null; }
  route();
}

async function logout() {
  if (unsubNotes) { unsubNotes(); unsubNotes = null; }
  cryptoKey = null;
  localStorage.removeItem(LS_KEY);
  try {
    const f = await ensureFirebase();
    await f.auth.signOut(f.authInst);
  } catch (e) { /* offline: segue */ }
  currentUser = null;
  route();
}

// ===================== INIT =====================
function boot() {
  wireSecretGesture();

  $('keep-close').onclick = closeKeep;
  $('keep-login-btn').onclick = doLogin;
  $('keep-unlock-btn').onclick = doUnlock;
  $('keep-add-btn').onclick = addNote;
  $('keep-lock-btn').onclick = lock;
  $('keep-logout-btn').onclick = logout;
  $('keep-logout-btn2').onclick = logout;

  // Enter para enviar nos campos de senha
  $('keep-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('keep-passphrase').addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); });
}

// módulos ES são deferidos: o DOM já está pronto quando este código executa.
boot();
