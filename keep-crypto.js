// keep-crypto.js — criptografia ponta-a-ponta (E2E) para as notas.
//
// Modelo: uma senha (passphrase) que SÓ você conhece é transformada numa chave
// AES-GCM 256 via PBKDF2 com muitas iterações. O texto das notas é cifrado no
// seu aparelho ANTES de subir para o Firestore; o servidor guarda apenas o
// ciphertext + IV. Nem o Google, nem um vazamento do banco, nem alguém com o
// código-fonte público conseguem ler o conteúdo sem a senha.
//
// Nada aqui é segredo (o algoritmo é público). O que protege é a senha, que
// nunca é gravada em claro nem enviada para lugar nenhum.
//
// ES module: exporta funções puras, sem dependências externas (WebCrypto nativo).

// Iterações do PBKDF2. Quanto maior, mais caro fica um ataque de força bruta
// offline (caso o ciphertext um dia vaze). >= 300.000 conforme o plano.
export const PBKDF2_ITERATIONS = 310000;

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---- helpers base64 <-> bytes (para guardar salt/iv/ciphertext como texto) ----
export function bytesToB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Gera um salt aleatório (16 bytes). O salt NÃO é segredo: ele é armazenado
// junto (no Firestore) para que todos os seus aparelhos derivem a MESMA chave a
// partir da mesma senha. Serve para impedir tabelas pré-computadas (rainbow).
export function newSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Deriva uma CryptoKey AES-GCM 256 a partir da senha + salt via PBKDF2/SHA-256.
// extractable=true permite exportar a chave para cache local (conveniência,
// aceita no MVP), evitando redigitar/rederivar a cada abertura.
export async function deriveKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Exporta a chave derivada como base64 (para cache em localStorage).
export async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bytesToB64(raw);
}

// Reimporta a chave a partir do base64 salvo.
export async function importKey(b64) {
  const raw = b64ToBytes(b64);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

// Cifra um objeto JSON qualquer. Gera um IV aleatório NOVO a cada escrita
// (obrigatório para a segurança do AES-GCM). Retorna { ciphertext, iv } em b64.
export async function encrypt(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { ciphertext: bytesToB64(ct), iv: bytesToB64(iv) };
}

// Decifra um payload { ciphertext, iv }. Lança erro se a chave/senha estiver
// errada ou o dado tiver sido adulterado (AES-GCM é autenticado).
export async function decrypt(payload, key) {
  const iv = b64ToBytes(payload.iv);
  const ct = b64ToBytes(payload.ciphertext);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(pt));
}
