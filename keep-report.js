// keep-report.js — diário write-only (Report).
//
// Funcionalidade dedicada para entrada de dados pessoais do dia a dia que só
// serão lidos posteriormente via API no computador. A interface permite APENAS
// adicionar entradas — não há listagem, edição ou remoção pela UI.
//
// Segurança: os dados são cifrados E2E (mesma chave das notas) e armazenados
// em uma sub-collection SEPARADA (reports/) para garantir isolamento adicional.
// As regras do Firestore (firestore.rules) devem bloquear a leitura pela web
// (só write), enquanto leitura manual via SDK autenticado no computador continua
// possível (você controla via código).

import * as kc from './keep-crypto.js';

// Adiciona uma entrada no Report. Retorna Promise que resolve quando persistido
// (ou entra em fila se offline). Não retorna o ID nem permite leitura posterior.
//
// text: conteúdo da entrada (string, será aparado)
// tag: tag selecionada ('psi' ou 'argue', opcional)
// dateYYYYMMDD: data da entrada em formato YYYY-MM-DD (opcional, usa hoje se não fornecida)
// cryptoKey: CryptoKey AES-GCM para cifrar E2E
// fb: objeto { db, fs, authInst } do Firebase
// ownerUid: UID do proprietário (para path da sub-collection)
export async function addReport(text, tag, dateYYYYMMDD, cryptoKey, fb, ownerUid) {
  const content = String(text == null ? '' : text).trim();
  if (!content) throw new Error('O conteúdo do report não pode ser vazio.');
  if (!cryptoKey) throw new Error('Chave de criptografia não disponível.');
  if (!fb || !fb.db || !fb.fs) throw new Error('Firebase não inicializado.');
  if (!ownerUid) throw new Error('UID do proprietário não disponível.');

  // Calcular timestamp da data
  let timestamp;
  if (dateYYYYMMDD) {
    // Parsear data em formato YYYY-MM-DD e usar início do dia (00:00:00 no timezone local)
    const parts = dateYYYYMMDD.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    timestamp = date.getTime();
  } else {
    // Usar hoje no início do dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    timestamp = today.getTime();
  }

  // Payload cifrado: { text, tag (opcional), clientTimestamp }
  const payload = { 
    text: content, 
    clientTimestamp: timestamp
  };
  
  // Adiciona tag se fornecida
  if (tag) {
    payload.tag = String(tag).trim();
  }
  
  const enc = await kc.encrypt(payload, cryptoKey);

  // Persiste na sub-collection isolada reports/
  const col = fb.fs.collection(fb.db, 'notes', ownerUid, 'reports');
  await fb.fs.addDoc(col, {
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    createdAt: fb.fs.serverTimestamp()
  });
}

// ===================== NÃO HÁ FUNÇÕES DE LEITURA AQUI =====================
// A interface web NÃO lista nem mostra os reports. A leitura é feita apenas
// via script Node.js ou SDK Firebase no computador, autenticado com sua conta.
// Ver tools/read-reports.js (a ser criado) para exemplo de script de leitura.
