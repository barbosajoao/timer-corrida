# 📅 Repport com Data Retroativa

Novo recurso: agora você pode adicionar repports com data de dias anteriores!

## 🎯 Como usar

### Via Browser (timer-corrida web app)

1. **Abra a aba Repport**
2. **Aparecerá um novo campo de data** acima do textarea:
   ```
   Data (hoje se deixar em branco): [___________]
   ```
3. **Selecione uma data** (ou deixe em branco para usar hoje)
4. **Digite o conteúdo**
5. **(Opcional) Selecione uma tag** (psi ou argue)
6. **Clique em "Adicionar"**

### Exemplos

#### Registrar algo que aconteceu ontem
1. Campo de data: clique e selecione ontem
2. Escreva: "Tive uma discussão acalorada"
3. Tag: selecione "argue"
4. Adicionar ✓

#### Registrar algo que faltou registrar há 3 dias
1. Campo de data: selecione a data de 3 dias atrás
2. Escreva: "Sessão de psicoterapia"
3. Tag: selecione "psi"
4. Adicionar ✓

#### Registrar hoje sem data específica
1. **Deixe o campo de data vazio**
2. Escreva o conteúdo
3. Adicionar ✓ (usará hoje às 00:00)

---

## 📊 Como os dados são salvos

### No Firestore (cifrado)
```json
{
  "ciphertext": "...",
  "iv": "...",
  "createdAt": "timestamp_do_servidor"
}
```

### No payload (decriptado no reader)
```json
{
  "text": "Conteúdo do repport",
  "tag": "psi",
  "clientTimestamp": 1699545600000  ← Data retroativa em ms
}
```

---

## 🔍 Lendo dados com data retroativa

### Via reader-browser.html
- As datas aparecem formatadas no campo **Data** de cada repport
- Ao filtrar por data, mostra apenas repports daquela data

### Via reader.js (Node)
- Usa o `clientTimestamp` do payload decriptado
- Exemplo: `node reader.js --date 2026-11-09`

---

## ⚙️ Detalhes técnicos

### Timestamp processado

Quando você seleciona uma data:
```javascript
// Se selecionar: 2026-11-09
// O timestamp será: início do dia local
// 2026-11-09 00:00:00 no seu timezone

// Se deixar vazio:
// Será: 2026-11-09 00:00:00 (hoje ao meio-noite)
```

### Por que midnight (00:00)?
- Consistência: todos os repports do mesmo dia têm o mesmo timestamp base
- Facilita agrupamento por data
- Compatível com filtros `--date YYYY-MM-DD`

### Timestamps no leitor
```
clientTimestamp:   1699545600000  (data retroativa que você escolheu)
serverTimestamp:   1699555200000  (hora real que foi salvo no servidor)
```

---

## 🔒 Segurança

- ✅ A data é **cifrada E2E** junto com o texto
- ✅ Só você (com a passphrase) consegue ler qual data foi usada
- ✅ O servidor (Firebase) **não consegue** ver a data retroativa
- ✅ O `serverTimestamp` é sempre agora (prova de quando foi realmente salvo)

---

## 💡 Casos de uso

1. **Recuperar registros antigos**: registrar algo que você deveria ter registrado antes
2. **Preenchimento em lote**: catchup de vários dias de uma vez
3. **Backdating deliberado**: criar registros "como se" fossem de outro dia
4. **Análise temporal**: manter consistência de datas nos seus dados

---

## 🐛 Troubleshooting

### "Não consigo selecionar data no mobile"
- Input de data é nativo do HTML5, deve funcionar em qualquer navegador moderno
- Toque no campo e selecione a data no calendário

### "A data não aparece no leitor"
- Desloque até o campo "Data" (ele mostra ao lado de outras informações)
- No `reader-browser.html`, a data aparece embaixo da hora

### "Formatação de data está errada"
- Timestamps são em milissegundos (ms desde 1970)
- Formatação depende do seu timezone local
- No reader-browser.html usa `toLocaleString('pt-BR')`
