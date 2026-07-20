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
   disponível offline desde a primeira vez) e **incremente o `CACHE_NAME`**
   (ver seção "Atualização offline").

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
a próxima abertura.

**Sempre incremente o `CACHE_NAME` (`corrida-vN`) em `sw.js` a cada modificação.**
Sem o bump, o navegador continua servindo o código antigo do cache — mudanças (e
correções de bugs) só chegariam depois de recarregar duas vezes, o que já causou
bugs recorrentes de código desatualizado em produção. Trocar a versão força o
service worker a reinstalar e rebaixar tudo da rede, aplicando a mudança na hora.

## Sons

Para regenerar os sons (requer `pip install gtts`):

```
python tools/gen_sounds.py
```

## Notas ocultas (Keep) — funcionalidade e segurança

O app inclui uma funcionalidade **oculta** de notas sincronizadas entre
dispositivos (estilo Google Keep). Ela fica invisível no uso normal e só é
revelada por um **gesto secreto**: tocar **5 vezes** no texto "Versão: …" do
rodapé (na tela inicial ou na de seleção).

### Arquivos
```
keep-crypto.js         criptografia E2E (PBKDF2 + AES-GCM) — WebCrypto nativo
keep-crypto.test.html  harness de teste da criptografia (abra por HTTP/localhost)
keep-config.js         config PÚBLICA do Firebase + OWNER_UID (você preenche)
keep.js                UI + Firebase Auth + Firestore (sync das notas)
firestore.rules        regras que travam os dados no seu UID
```

### Modelo de segurança (importante)
Como o código é **público** no GitHub, esconder a funcionalidade **não** protege
os dados. A proteção real vem de três camadas independentes:

1. **Autenticação (Firebase Auth):** só a sua conta consegue falar com o banco.
2. **Regras do Firestore (`firestore.rules`):** liberam ler/escrever/**apagar**
   apenas para o **seu UID**. Qualquer outra conta (mesmo criada a partir do
   código público) ou requisição anônima recebe *permission denied*.
3. **Criptografia ponta-a-ponta (`keep-crypto.js`):** o texto é cifrado no seu
   aparelho **antes** de subir; o Firestore guarda só o texto cifrado. Nem o
   Google, nem um vazamento do banco expõem o conteúdo sem a sua senha.

**Nada sensível fica no repositório.** A `apiKey` do Firebase é pública por
design (não é senha). Sua **senha de conta** e sua **senha de criptografia**
existem só na sua cabeça (e, salvas, dentro do seu aparelho). O gesto secreto é
só conveniência/obscuridade — quem tiver seu aparelho destravado **e** souber do
gesto verá as notas (o bloqueio de tela do celular é a defesa nesse caso).

### Passo a passo no console do Firebase (você precisa fazer isto uma vez)
1. Crie um projeto em https://console.firebase.google.com.
2. **Adicione um App Web** (`</>`) e copie o objeto de config para
   `firebaseConfig` em `keep-config.js`.
3. **Authentication → Sign-in method:** ative **E-mail/senha**.
   Em **Users**, crie a **sua única conta** com uma **senha forte**. Copie o
   **User UID** e cole em `OWNER_UID` (em `keep-config.js`).
4. **Firestore Database:** crie o banco em **modo produção**. Em **Regras**,
   cole o conteúdo de `firestore.rules`, troque `OWNER_UID_AQUI` pelo seu UID
   (nos dois lugares) e **Publique**.
5. *(Opcional, recomendado)* **App Check** com **reCAPTCHA v3**: registre o app,
   cole a *site key* em `RECAPTCHA_SITE_KEY` (`keep-config.js`) e adicione seu
   domínio do GitHub Pages nos domínios autorizados. Deixe vazio para desativar.
6. Em **Authentication → Settings → Authorized domains**, confirme que o domínio
   do GitHub Pages (`barbosajoao.github.io`) está na lista.

### Como usar
1. Faça o gesto secreto (5 toques na versão) → abre a tela **Notas**.
2. **Entrar** com e-mail/senha da conta (fica logado no aparelho).
3. Digite a **senha de criptografia** (na primeira vez ela é registrada; nos
   outros aparelhos, digite a MESMA senha para ler as notas).
4. **Adicionar** e **apagar** notas — a sincronização é em tempo real entre
   celular e PC.
5. **Travar** limpa a chave cacheada (pede a senha de novo); **Sair** desloga.

### Verificação da criptografia
Abra `keep-crypto.test.html` por HTTP (ex.: `python -m http.server` e acesse
`http://localhost:8000/keep-crypto.test.html`). Os testes checam round-trip
cifra/decifra, IV único por escrita, senha errada falhando e cache de chave.
(WebCrypto exige contexto seguro: `localhost` ou HTTPS.)

### Observações
- **Offline:** o app de corrida continua 100% offline. A tela de Notas precisa
  de rede para carregar o SDK do Firebase (CDN) e para logar; uma vez aberta, o
  Firestore mantém as notas em cache local e enfileira escritas feitas offline,
  sincronizando ao reconectar.
- **Bump do `CACHE_NAME`:** vale para os arquivos do Keep também — ao alterá-los,
  incremente `corrida-vN` em `sw.js` (o SDK do Firebase vem de CDN cross-origin e
  não é cacheado pelo service worker por design).
