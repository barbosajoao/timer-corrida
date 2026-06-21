# Timer de Corrida (PWA)

Aplicativo web (PWA) com timer interativo para programas de treino de corrida
em esteira. Toca sons "Run!" / "Walk!" nos tempos certos, mostra a lista de
blocos da sessão, salva o progresso por programa e mantém a tela ligada
(WakeLock). Instalável na tela inicial do Android.

Publicado em: https://barbosajoao.github.io/timer-corrida/

## Estrutura

```
index.html              estrutura da página (HTML)
styles.css              estilos (CSS)
app.js                  lógica do app (JavaScript)
manifest.json           manifesto PWA
sw.js                   service worker (cache offline, atualiza sozinho)
icon-192.png/512.png    ícones do app
sounds/                 run.mp3, walk.mp3, done.mp3
data/
  programs.json         catálogo de programas exibido na tela inicial
  c25k_16week.json      programa Couch to 5K (16 semanas)
  10k_16week.json       placeholder 10K (indisponível)
  _example.json         modelo para criar um treino novo (copie e edite)
tools/
  gen_sounds.py         (re)gera os mp3 com gTTS
  verify.py             valida os dados em data/*.json
```

Não há passo de build: o site é estático e carrega os programas em tempo de
execução via `fetch` dos arquivos em `data/`. Os três arquivos `index.html`,
`styles.css` e `app.js` são separados só para facilitar a edição — o navegador
os junta automaticamente.

**Os arquivos em `data/` são a fonte única da verdade dos treinos.** Edite-os
diretamente. (Antes havia um script `extract_data.py` que gerava esses JSONs;
ele foi removido para evitar sobrescrever edições manuais sem querer. O
histórico continua no git, se precisar consultar.)

## Schema de um treino

Cada arquivo de programa (`data/<id>.json`) tem esta estrutura:

| Campo            | Tipo   | Descrição                                                        |
|------------------|--------|------------------------------------------------------------------|
| `id`             | texto  | Identificador único, sem espaços (ex.: `"10k_16week"`).          |
| `name`           | texto  | Nome exibido na tela inicial.                                    |
| `weeks`          | lista  | Lista de semanas. Vazia = placeholder "em breve".                |
| `weeks[].n`      | número | Número da semana.                                                |
| `weeks[].fase`   | texto  | Rótulo de fase (texto livre; agrupa semanas).                    |
| `weeks[].total`  | texto  | Resumo mostrado na tela de seleção (ex.: `"6 min running"`).     |
| `weeks[].blocos` | lista  | Blocos no formato `[tipo, duraçãoEmSegundos]`.                    |

Regras dos blocos:
- `tipo` só pode ser `"run"` ou `"walk"`.
- A duração é em **segundos** e deve ser maior que zero.
- Como cada bloco é uma duração, os tempos absolutos são calculados pelo site
  acumulando as durações — é impossível criar buracos ou sobreposição.
- Os rótulos ("Run (2 min)", "Cool-down walk (3 min)") são **derivados**
  automaticamente dos tempos — não precisam ser escritos. O primeiro bloco vira
  "Warm-up walk" e o último, "Cool-down walk".

Veja `data/_example.json` para um modelo pronto para copiar.

## Como adicionar um novo treino

1. Copie `data/_example.json` para `data/<id>.json` e preencha com seus dados
   (veja o schema acima).

2. Registre o programa em `data/programs.json`:
   ```json
   { "id": "<id>", "name": "Nome", "subtitle": "descrição",
     "available": true, "file": "./data/<id>.json" }
   ```

3. Adicione `./data/<id>.json` à lista `ASSETS` do `sw.js` (para ficar
   disponível offline desde a primeira vez). **Não** é preciso mexer em
   versão de cache — o service worker se atualiza sozinho.

4. Valide antes de publicar:
   ```
   python tools/verify.py
   ```

## Persistência

O progresso é salvo no `localStorage` por programa:
- `runtimer_program`: id do programa selecionado (abre direto nele).
- `runtimer_v2`: `{ "<id>": { week, done, history } }`.

Há migração automática do formato antigo (global) para o programa `c25k_16week`.

## Atualização offline (service worker)

O `sw.js` usa a estratégia *stale-while-revalidate*: o app abre instantaneamente
a partir do cache (e funciona offline) e, em paralelo, baixa a versão nova para
a próxima abertura. Ou seja, **as mudanças chegam sozinhas** ao recarregar — não
é mais necessário incrementar nenhum número de versão a cada deploy.

## Sons

Para regenerar os sons (requer `pip install gtts`):

```
python tools/gen_sounds.py
```
