# Timer de Corrida (PWA)

Aplicativo web (PWA) com timer interativo para programas de treino de corrida
em esteira. Toca sons "Run!" / "Walk!" nos tempos certos, mostra a lista de
blocos da sessão, salva o progresso por programa e mantém a tela ligada
(WakeLock). Instalável na tela inicial do Android.

Publicado em: https://barbosajoao.github.io/timer-corrida/

## Estrutura

```
index.html              site (HTML/CSS/JS) — edite diretamente, sem build
manifest.json           manifesto PWA
sw.js                   service worker (cache offline)
icon-192.png/512.png    ícones do app
sounds/                 run.mp3, walk.mp3, done.mp3
data/
  programs.json         catálogo de programas exibido na tela inicial
  c25k_16week.json      programa Couch to 5K (16 semanas)
  10k_16week.json       placeholder 10K (indisponível)
tools/                  scripts auxiliares (rodam só quando necessário)
  gen_sounds.py         (re)gera os mp3 com gTTS
  extract_data.py       gera os JSONs de dados a partir da fonte
```

Não há passo de build: o `index.html` é um site estático que carrega os
programas em tempo de execução via `fetch` dos arquivos em `data/`.

## Como adicionar um novo treino

1. Crie `data/<id>.json` com o formato:
   ```json
   {
     "id": "<id>",
     "name": "Nome do treino",
     "weeks": [
       { "n": 1, "fase": "Fase 1", "total": "X min running",
         "blocos": [ ["00:00","05:00","walk"], ["05:00","06:00","run"], "..." ] }
     ]
   }
   ```
   - `blocos` são pares `["início","fim","tipo"]` em `MM:SS`. O tipo é `run` ou `walk`.
   - Os blocos devem ser contínuos (o fim de um é o início do próximo), sem
     buracos nem sobreposição. O site valida isso ao carregar e avisa se houver erro.
   - Os rótulos ("Run (2 min)", "Cool-down walk (3 min)") são **derivados**
     automaticamente dos tempos — não precisam ser escritos.

2. Registre o programa em `data/programs.json`:
   ```json
   { "id": "<id>", "name": "Nome", "subtitle": "descrição",
     "available": true, "file": "./data/<id>.json" }
   ```

3. Adicione `./data/<id>.json` à lista `ASSETS` do `sw.js` e incremente
   `CACHE_NAME` (ex.: `corrida-v2` → `corrida-v3`) para forçar atualização offline.

## Persistência

O progresso é salvo no `localStorage` por programa:
- `runtimer_program`: id do programa selecionado (abre direto nele).
- `runtimer_v2`: `{ "<id>": { week, done, history } }`.

Há migração automática do formato antigo (global) para o programa `c25k_16week`.

## Sons

Para regenerar os sons (requer `pip install gtts`):

```
python tools/gen_sounds.py
```
