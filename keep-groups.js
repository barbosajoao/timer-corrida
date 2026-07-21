// keep-groups.js — lógica pura de grupos das Notas (Keep).
//
// SEM dependência de Firebase ou DOM: só transforma estruturas de dados. Isso
// torna a lógica testável isoladamente (ver keep-groups.test.html).
//
// Modelo: a lista de grupos é um array ordenado de { id, name }. Um dos grupos
// é o "padrão" (defaultId) — é onde caem as notas antigas (payload sem groupId)
// e qualquer nota cujo groupId não exista mais.

// Gera um id estável para um grupo.
export function newGroupId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch (e) { /* segue pro fallback */ }
  }
  return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Cria um objeto de grupo a partir de um nome (aparado). Lança se vazio.
export function makeGroup(name) {
  const n = String(name == null ? '' : name).trim();
  if (!n) throw new Error('Nome do grupo não pode ser vazio.');
  return { id: newGroupId(), name: n };
}

// Retorna true se já existe um grupo com o mesmo nome (case-insensitive),
// ignorando opcionalmente um id (útil ao renomear o próprio grupo).
export function nameExists(list, name, exceptId = null) {
  const n = String(name == null ? '' : name).trim().toLowerCase();
  return (list || []).some(g => g.id !== exceptId && g.name.trim().toLowerCase() === n);
}

// Adiciona um grupo novo. Retorna { list, group }. Lança em nome vazio ou
// duplicado. Não muta a lista original.
export function addGroup(list, name) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const n = String(name == null ? '' : name).trim();
  if (!n) throw new Error('Nome do grupo não pode ser vazio.');
  if (nameExists(arr, n)) throw new Error('Já existe um grupo com esse nome.');
  const group = makeGroup(n);
  arr.push(group);
  return { list: arr, group };
}

// Renomeia um grupo. Retorna nova lista. Lança em vazio/duplicado/inexistente.
// Não muta a lista original.
export function renameGroup(list, id, name) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const n = String(name == null ? '' : name).trim();
  if (!n) throw new Error('Nome do grupo não pode ser vazio.');
  const idx = arr.findIndex(g => g.id === id);
  if (idx === -1) throw new Error('Grupo não encontrado.');
  if (nameExists(arr, n, id)) throw new Error('Já existe um grupo com esse nome.');
  arr[idx] = { ...arr[idx], name: n };
  return arr;
}

// Remove um grupo, com guardas:
//  - não pode remover se o grupo tiver notas (noteCountsById[id] > 0);
//  - não pode remover o último grupo (deve sobrar >= 1).
// noteCountsById é um objeto { [groupId]: quantidade } com a contagem EFETIVA
// (já resolvida) de notas por grupo.
// Retorna { list, defaultId } com o defaultId possivelmente reatribuído.
// Não muta a lista original. Lança Error com mensagem amigável se bloqueado.
export function removeGroup(list, id, { noteCountsById = {}, defaultId = null } = {}) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const idx = arr.findIndex(g => g.id === id);
  if (idx === -1) throw new Error('Grupo não encontrado.');
  if (arr.length <= 1) throw new Error('Não é possível apagar o último grupo.');
  if ((noteCountsById[id] || 0) > 0) throw new Error('Esvazie o grupo antes de apagá-lo.');

  arr.splice(idx, 1);
  let newDefaultId = defaultId;
  if (defaultId === id) {
    // o grupo removido era o padrão: elege o primeiro remanescente.
    newDefaultId = arr[0].id;
  }
  return { list: arr, defaultId: newDefaultId };
}

// Resolve o grupo EFETIVO de uma nota decifrada:
//  - usa notePayload.groupId se ele apontar para um grupo existente;
//  - senão (ausente ou apontando para grupo removido) cai no defaultId.
export function resolveEffectiveGroupId(notePayload, groups, defaultId) {
  const gid = notePayload && notePayload.groupId;
  if (gid && (groups || []).some(g => g.id === gid)) return gid;
  return defaultId;
}

// Filtra as notas decifradas que pertencem (efetivamente) a groupId.
// Cada item de decryptedNotes deve ter { id, payload, ... }.
export function notesForGroup(decryptedNotes, groupId, groups, defaultId) {
  return (decryptedNotes || []).filter(
    n => resolveEffectiveGroupId(n.payload, groups, defaultId) === groupId
  );
}

// Conta as notas efetivas por grupo. Retorna { [groupId]: quantidade }.
export function countNotesByGroup(decryptedNotes, groups, defaultId) {
  const counts = {};
  for (const n of decryptedNotes || []) {
    const gid = resolveEffectiveGroupId(n.payload, groups, defaultId);
    counts[gid] = (counts[gid] || 0) + 1;
  }
  return counts;
}

// Trunca um texto para exibir num rótulo de confirmação (ex.: "Comprar leite…").
export function truncateSnippet(text, n = 40) {
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + '…';
}
