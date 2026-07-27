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

// Move um grupo uma posição para cima ('up') ou para baixo ('down'), trocando
// de lugar com o vizinho. Retorna nova lista (não muta a original). Se o grupo
// já estiver no extremo correspondente, retorna a lista inalterada (noop).
// Lança se o id não existir ou a direção for inválida.
export function moveGroup(list, id, direction) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (direction !== 'up' && direction !== 'down') {
    throw new Error('Direção inválida.');
  }
  const idx = arr.findIndex(g => g.id === id);
  if (idx === -1) throw new Error('Grupo não encontrado.');
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= arr.length) return arr; // já no extremo: noop
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  return arr;
}

// ===================== ORDENAÇÃO MANUAL DE NOTAS =====================
// As notas têm um campo numérico `order` (dentro do payload cifrado), escopado
// POR GRUPO: order menor = aparece mais no topo. Como o campo é cifrado, o
// Firestore não consegue ordenar por ele — a ordenação é feita em memória aqui.

// Extrai o `order` numérico de uma nota, ou null se ausente/ inválido.
function orderOf(note) {
  const o = note && note.payload && note.payload.order;
  return typeof o === 'number' && isFinite(o) ? o : null;
}

// Converte createdAt (Timestamp do Firestore, {seconds} ou null) em ms para
// desempate estável. Retorna 0 quando ausente.
function tsMillis(note) {
  const c = note && note.createdAt;
  if (!c) return 0;
  if (typeof c.toMillis === 'function') { try { return c.toMillis(); } catch (e) {} }
  if (typeof c.seconds === 'number') return c.seconds * 1000;
  if (c instanceof Date) return c.getTime();
  return 0;
}

// Ordena notas para exibição (não muta a original):
//  - notas com `order` vêm ordenadas de forma crescente (order 0 no topo);
//  - empate de order (ou ausência) desempata por createdAt DESCENDENTE
//    (mais nova primeiro), preservando o comportamento visual anterior à
//    migração (a lista era orderBy('createdAt','desc')).
export function sortNotesByOrder(notes) {
  const arr = Array.isArray(notes) ? notes.slice() : [];
  arr.sort((a, b) => {
    const ao = orderOf(a), bo = orderOf(b);
    if (ao != null && bo != null) {
      if (ao !== bo) return ao - bo;
      return tsMillis(b) - tsMillis(a);
    }
    if (ao != null) return -1;              // com order antes das sem order
    if (bo != null) return 1;
    return tsMillis(b) - tsMillis(a);       // ambas sem order: mais nova primeiro
  });
  return arr;
}

// Próximo `order` para uma nota nova no grupo: max(order do grupo) + 1, de modo
// que a nova nota entre no FINAL da lista. Retorna 0 se o grupo estiver vazio.
export function nextOrderForGroup(notes, groupId, groups, defaultId) {
  const inGroup = notesForGroup(notes, groupId, groups, defaultId);
  let max = -1;
  for (const n of inGroup) {
    const o = orderOf(n);
    if (o != null && o > max) max = o;
  }
  return max + 1;
}

// Dado um array de notas JÁ na ordem desejada, retorna um mapa
// { [noteId]: orderSequencial } com 0,1,2,… Usado na migração lazy e ao mover.
export function assignSequentialOrders(orderedNotes) {
  const map = {};
  (orderedNotes || []).forEach((n, i) => { map[n.id] = i; });
  return map;
}

// Move uma nota uma posição para cima/baixo DENTRO do seu grupo efetivo.
// Retorna um array de mutações [{ id, order }] apenas para as notas cujo `order`
// mudou (renormaliza a sequência do grupo para 0..n, corrigindo lacunas).
// Retorna [] se a nota já estiver no extremo (noop). Lança em id/direção inválidos.
export function moveNote(notes, noteId, direction, groups, defaultId) {
  if (direction !== 'up' && direction !== 'down') throw new Error('Direção inválida.');
  const note = (notes || []).find(n => n.id === noteId);
  if (!note) throw new Error('Nota não encontrada.');
  const gid = resolveEffectiveGroupId(note.payload, groups, defaultId);
  const inGroup = sortNotesByOrder(notesForGroup(notes, gid, groups, defaultId));
  const idx = inGroup.findIndex(n => n.id === noteId);
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= inGroup.length) return []; // extremo: noop

  const arr = inGroup.slice();
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  const orders = assignSequentialOrders(arr);
  const changes = [];
  for (const n of arr) {
    if (orderOf(n) !== orders[n.id]) changes.push({ id: n.id, order: orders[n.id] });
  }
  return changes;
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
