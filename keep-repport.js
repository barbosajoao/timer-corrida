// keep-repport.js — diário write-only (Repport).
//
// Funcionalidade dedicada para entrada de dados pessoais do dia a dia que só
// serão lidos posteriormente via API no computador. A interface permite APENAS
// adicionar entradas — não há listagem, edição ou remoção pela UI.
//
// Segurança: os dados são cifrados E2E (mesma chave das notas) e armazenados
// em uma sub-collection SEPARADA (repports/) para garantir isolamento adicional.
// As regras do Firestore (firestore.rules) devem bloquear a leitura pela web
// (só write), enquanto leitura manual via SDK autenticado no computador continua
// possível (você controla via código).

import * as kc from './keep-crypto.js';

// Adiciona uma entrada no Repport. Retorna Promise que resolve quando persistido
// (ou entra em fila se offline). Não retorna o ID nem permite leitura posterior.
//
// text: conteúdo da entrada (string, será aparado)
// tag: tag selecionada ('psi' ou 'argue', opcional)
// cryptoKey: CryptoKey AES-GCM para cifrar E2E
// fb: objeto { db, fs, authInst } do Firebase
// ownerUid: UID do proprietário (para path da sub-collection)
export async function addRepport(text, tag, cryptoKey, fb, ownerUid) {
  const content = String(text == null ? '' : text).trim();
  if (!content) throw new Error('O conteúdo do repport não pode ser vazio.');
  if (!cryptoKey) throw new Error('Chave de criptografia não disponível.');
  if (!fb || !fb.db || !fb.fs) throw new Error('Firebase não inicializado.');
  if (!ownerUid) throw new Error('UID do proprietário não disponível.');

  // Payload cifrado: { text, tag (opcional), timestamp }
  const payload = { 
    text: content, 
    clientTimestamp: Date.now()
  };
  
  // Adiciona tag se fornecida
  if (tag) {
    payload.tag = String(tag).trim();
  }
  
  const enc = await kc.encrypt(payload, cryptoKey);

  // Persiste na sub-collection isolada repports/
  const col = fb.fs.collection(fb.db, 'notes', ownerUid, 'repports');
  await fb.fs.addDoc(col, {
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    createdAt: fb.fs.serverTimestamp()
  });
}

// ===================== NÃO HÁ FUNÇÕES DE LEITURA AQUI =====================
// A interface web NÃO lista nem mostra os repports. A leitura é feita apenas
// via script Node.js ou SDK Firebase no computador, autenticado com sua conta.
// Ver tools/read-repports.js (a ser criado) para exemplo de script de leitura.
