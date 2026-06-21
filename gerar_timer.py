import base64, json
from gtts import gTTS
from io import BytesIO

def tts_base64(text):
    buf = BytesIO()
    gTTS(text=text, lang='en').write_to_fp(buf)
    return base64.b64encode(buf.getvalue()).decode()

print("Gerando sons...")
sound_run  = tts_base64("Run!")
sound_walk = tts_base64("Walk!")
sound_done = tts_base64("Workout complete!")
print("Sons gerados.")

semanas = [
    {"n":1,  "fase":"Phase 1 - Adaptation", "total":"6 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","06:00","run"),("06:00","08:00","walk"),
        ("08:00","09:00","run"),("09:00","11:00","walk"),("11:00","12:00","run"),
        ("12:00","14:00","walk"),("14:00","15:00","run"),("15:00","17:00","walk"),
        ("17:00","18:00","run"),("18:00","20:00","walk"),("20:00","21:00","run"),
        ("21:00","23:00","walk"),("23:00","28:00","walk"),
    ]},
    {"n":2,  "fase":"Phase 1 - Adaptation", "total":"9 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","06:30","run"),("06:30","08:30","walk"),
        ("08:30","10:00","run"),("10:00","12:00","walk"),("12:00","13:30","run"),
        ("13:30","15:30","walk"),("15:30","17:00","run"),("17:00","19:00","walk"),
        ("19:00","20:30","run"),("20:30","22:30","walk"),("22:30","24:00","run"),
        ("24:00","26:00","walk"),("26:00","31:00","walk"),
    ]},
    {"n":3,  "fase":"Phase 1 - Adaptation", "total":"10 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","07:00","run"),("07:00","09:00","walk"),
        ("09:00","11:00","run"),("11:00","13:00","walk"),("13:00","15:00","run"),
        ("15:00","17:00","walk"),("17:00","19:00","run"),("19:00","21:00","walk"),
        ("21:00","23:00","run"),("23:00","25:00","walk"),("25:00","30:00","walk"),
    ]},
    {"n":4,  "fase":"Phase 2 - Base", "total":"12.5 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","07:30","run"),("07:30","09:00","walk"),
        ("09:00","11:30","run"),("11:30","13:00","walk"),("13:00","15:30","run"),
        ("15:30","17:00","walk"),("17:00","19:30","run"),("19:30","21:00","walk"),
        ("21:00","23:30","run"),("23:30","25:00","walk"),("25:00","30:00","walk"),
    ]},
    {"n":5,  "fase":"Phase 2 - Base", "total":"12 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","08:00","run"),("08:00","10:00","walk"),
        ("10:00","13:00","run"),("13:00","15:00","walk"),("15:00","18:00","run"),
        ("18:00","20:00","walk"),("20:00","23:00","run"),("23:00","25:00","walk"),
        ("25:00","30:00","walk"),
    ]},
    {"n":6,  "fase":"Phase 2 - Base", "total":"16 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","09:00","run"),("09:00","11:00","walk"),
        ("11:00","15:00","run"),("15:00","17:00","walk"),("17:00","21:00","run"),
        ("21:00","23:00","walk"),("23:00","27:00","run"),("27:00","29:00","walk"),
        ("29:00","34:00","walk"),
    ]},
    {"n":7,  "fase":"Phase 2 - Base", "total":"15 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","10:00","run"),("10:00","12:30","walk"),
        ("12:30","17:30","run"),("17:30","20:00","walk"),("20:00","25:00","run"),
        ("25:00","27:30","walk"),("27:30","32:30","walk"),
    ]},
    {"n":8,  "fase":"Phase 3 - Long intervals", "total":"18 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","11:00","run"),("11:00","13:00","walk"),
        ("13:00","19:00","run"),("19:00","21:00","walk"),("21:00","27:00","run"),
        ("27:00","29:00","walk"),("29:00","34:00","walk"),
    ]},
    {"n":9,  "fase":"Phase 3 - Long intervals", "total":"16 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","13:00","run"),("13:00","16:00","walk"),
        ("16:00","24:00","run"),("24:00","27:00","walk"),("27:00","32:00","walk"),
    ]},
    {"n":10, "fase":"Phase 3 - Long intervals", "total":"20 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","15:00","run"),("15:00","18:00","walk"),
        ("18:00","28:00","run"),("28:00","31:00","walk"),("31:00","36:00","walk"),
    ]},
    {"n":11, "fase":"Phase 3 - Long intervals", "total":"22 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","17:00","run"),("17:00","20:00","walk"),
        ("20:00","30:00","run"),("30:00","35:00","walk"),
    ]},
    {"n":12, "fase":"Phase 4 - Continuous running", "total":"23 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","20:00","run"),("20:00","23:00","walk"),
        ("23:00","31:00","run"),("31:00","36:00","walk"),
    ]},
    {"n":13, "fase":"Phase 4 - Continuous running", "total":"24 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","23:00","run"),("23:00","26:00","walk"),
        ("26:00","32:00","run"),("32:00","37:00","walk"),
    ]},
    {"n":14, "fase":"Phase 4 - Continuous running", "total":"27 min running", "blocos":[
        ("00:00","05:00","walk"),("05:00","27:00","run"),("27:00","30:00","walk"),
        ("30:00","35:00","run"),("35:00","40:00","walk"),
    ]},
    {"n":15, "fase":"Phase 4 - Continuous running", "total":"25 min continuous", "blocos":[
        ("00:00","05:00","walk"),("05:00","30:00","run"),("30:00","35:00","walk"),
    ]},
    {"n":16, "fase":"Phase 4 - Continuous running", "total":"30 min - 5K!", "blocos":[
        ("00:00","05:00","walk"),("05:00","35:00","run"),("35:00","40:00","walk"),
    ]},
]

def t2s(t):
    """'MM:SS' -> seconds"""
    m, s = t.split(":")
    return int(m)*60 + int(s)

def s2disp(secs):
    """seconds -> 'MM:SS'"""
    return f"{secs//60:02d}:{secs%60:02d}"

def fmt_dur(secs):
    m = secs // 60
    s = secs % 60
    if s == 0:
        return f"{m} min"
    elif m == 0:
        return f"{s}s"
    else:
        return f"{m} min {s}s"

COOLDOWN_SECS = 180  # cool-down walk reduced from 5 min to 3 min

def process_blocks(blocos):
    """Convert to seconds and merge any trailing recovery walk into a single
    3-min cool-down walk. For continuous-run weeks (no recovery walk before the
    cool-down) it just shortens the cool-down to 3 min."""
    b = [[t2s(s), t2s(e), t] for (s, e, t) in blocos]
    cooldown = b[-1]            # original 5-min cool-down walk
    prev = b[-2]
    if prev[2] == "walk":
        new_start = prev[0]     # absorb the recovery walk into the cool-down
        b = b[:-2]
    else:
        new_start = cooldown[0] # continuous run week: only shorten the cool-down
        b = b[:-1]
    b.append([new_start, new_start + COOLDOWN_SECS, "walk"])
    return b

# Build JS-friendly data
weeks_data = []
for s in semanas:
    raw = process_blocks(s["blocos"])
    n = len(raw)
    blocos = []
    for i, (start, end, tipo) in enumerate(raw):
        dur = end - start
        if i == 0:
            lbl = f"Warm-up walk ({fmt_dur(dur)})"
        elif i == n - 1:
            lbl = f"Cool-down walk ({fmt_dur(dur)})"
        elif tipo == "run":
            lbl = f"Run ({fmt_dur(dur)})"
        else:
            lbl = f"Walk ({fmt_dur(dur)})"
        blocos.append({
            "start": start,
            "end": end,
            "type": tipo,
            "label": lbl,
            "display": f"{s2disp(start)}-{s2disp(end)}"
        })
    weeks_data.append({"n": s["n"], "fase": s["fase"], "total": s["total"], "blocos": blocos})

weeks_json = json.dumps(weeks_data)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Running Timer</title>
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#e83535">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: #111; color: #fff; font-family: sans-serif; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }}
  #screen-select, #screen-workout, #screen-done {{ display: none; flex-direction: column; height: 100dvh; padding: 24px 20px; }}
  .active {{ display: flex !important; }}

  /* SELECT */
  #screen-select {{ justify-content: center; align-items: center; gap: 20px; }}
  .week-card {{ background: #222; border-radius: 16px; padding: 28px; text-align: center; width: 100%; max-width: 360px; }}
  .week-card h1 {{ font-size: 2.6rem; font-weight: 800; }}
  .week-card p {{ color: #aaa; margin-top: 6px; font-size: 1rem; }}
  .week-card .total {{ color: #4fc; font-size: 1.1rem; margin-top: 4px; font-weight: 600; }}
  .nav-row {{ display: flex; gap: 16px; width: 100%; max-width: 360px; }}
  .nav-row button {{ flex: 1; padding: 16px; font-size: 1.4rem; background: #333; border: none; border-radius: 12px; color: #fff; cursor: pointer; }}
  #btn-start {{ width: 100%; max-width: 360px; padding: 20px; font-size: 1.4rem; font-weight: 700; background: #e83535; border: none; border-radius: 16px; color: #fff; cursor: pointer; letter-spacing: 1px; }}
  .saved-note {{ color: #777; font-size: 0.85rem; }}

  /* WORKOUT */
  #screen-workout {{ justify-content: space-between; }}
  .wk-header {{ display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: #aaa; }}
  .current-block {{ flex: 0 0 auto; text-align: center; padding: 20px 0 10px; }}
  .current-type {{ font-size: 3.8rem; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }}
  .current-type.run  {{ color: #e83535; }}
  .current-type.walk {{ color: #5ab4d6; }}
  .current-time {{ font-size: 5rem; font-weight: 900; letter-spacing: -2px; font-variant-numeric: tabular-nums; }}
  .next-block {{ text-align: center; color: #aaa; font-size: 0.95rem; }}
  .next-block span {{ color: #fff; font-weight: 600; }}
  .progress-bar-wrap {{ background: #333; border-radius: 8px; height: 10px; overflow: hidden; }}
  .progress-bar {{ height: 100%; background: #e83535; transition: width 1s linear; }}
  .progress-label {{ text-align: center; color: #777; font-size: 0.8rem; margin-top: 6px; }}

  /* blocks list */
  .blocks-list {{ flex: 1 1 0; overflow-y: auto; margin: 8px 0; display: flex; flex-direction: column; gap: 4px; }}
  .block-row {{ display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; font-size: 0.9rem; opacity: 0.45; transition: opacity .3s; }}
  .block-row.current {{ opacity: 1; border: 2px solid #fff; }}
  .block-row.done {{ opacity: 0.25; }}
  .block-row.run  {{ background: #3a1010; }}
  .block-row.walk {{ background: #0d2535; }}
  .block-dot {{ width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }}
  .block-row.run  .block-dot {{ background: #e83535; }}
  .block-row.walk .block-dot {{ background: #5ab4d6; }}
  .block-time {{ color: #aaa; font-size: 0.8rem; margin-left: auto; white-space: nowrap; }}

  #btn-pause {{ width: 100%; padding: 18px; font-size: 1.2rem; font-weight: 700; background: #333; border: none; border-radius: 14px; color: #fff; cursor: pointer; flex-shrink: 0; }}
  #btn-finish {{ width: 100%; padding: 14px; font-size: 1rem; font-weight: 600; background: transparent; border: 1px solid #555; border-radius: 14px; color: #aaa; cursor: pointer; flex-shrink: 0; margin-top: 8px; }}

  /* PAUSE OVERLAY */
  #pause-overlay {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,.85); flex-direction: column; justify-content: center; align-items: center; gap: 16px; padding: 32px; z-index: 10; }}
  #pause-overlay.active {{ display: flex; }}
  #pause-overlay h2 {{ font-size: 2rem; }}
  #pause-overlay button {{ width: 100%; max-width: 320px; padding: 18px; font-size: 1.1rem; font-weight: 700; border: none; border-radius: 14px; cursor: pointer; }}
  #btn-resume {{ background: #e83535; color: #fff; }}
  #btn-restart {{ background: #333; color: #fff; }}
  #btn-quit {{ background: #222; color: #aaa; }}

  /* FINISH CONFIRM OVERLAY */
  #finish-overlay {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,.85); flex-direction: column; justify-content: center; align-items: center; gap: 16px; padding: 32px; z-index: 10; }}
  #finish-overlay.active {{ display: flex; }}
  #finish-overlay h2 {{ font-size: 2rem; text-align: center; }}
  #finish-overlay button {{ width: 100%; max-width: 320px; padding: 18px; font-size: 1.1rem; font-weight: 700; border: none; border-radius: 14px; cursor: pointer; }}
  #btn-finish-confirm {{ background: #e83535; color: #fff; }}
  #btn-finish-cancel {{ background: #333; color: #fff; }}

  /* DONE */
  #screen-done {{ justify-content: center; align-items: center; gap: 20px; text-align: center; }}
  #screen-done h1 {{ font-size: 2.4rem; font-weight: 900; }}
  #screen-done p {{ color: #aaa; font-size: 1rem; }}
  #btn-next {{ width: 100%; max-width: 340px; padding: 20px; font-size: 1.2rem; font-weight: 700; background: #4fc; color: #000; border: none; border-radius: 16px; cursor: pointer; }}
  #btn-repeat {{ width: 100%; max-width: 340px; padding: 16px; font-size: 1rem; background: #333; color: #fff; border: none; border-radius: 14px; cursor: pointer; }}

  /* HISTORY */
  #screen-history {{ display: none; flex-direction: column; height: 100dvh; padding: 24px 20px; gap: 16px; }}
  #screen-history h2 {{ font-size: 1.8rem; font-weight: 900; }}
  #history-list {{ flex: 1 1 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }}
  .hist-row {{ background: #1e1e1e; border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }}
  .hist-row .hist-week {{ font-weight: 700; font-size: 1rem; }}
  .hist-row .hist-meta {{ color: #aaa; font-size: 0.85rem; text-align: right; }}
  .hist-action-advance {{ color: #4fc; font-size: 0.8rem; font-weight: 600; }}
  .hist-action-repeat   {{ color: #f90; font-size: 0.8rem; font-weight: 600; }}
  #btn-history {{ background: transparent; border: none; color: #555; font-size: 0.85rem; cursor: pointer; text-decoration: underline; }}
  #btn-back-history {{ padding: 14px; font-size: 1rem; background: #333; border: none; border-radius: 14px; color: #fff; cursor: pointer; }}
</style>
</head>
<body>

<!-- SCREEN: SELECT -->
<div id="screen-select">
  <div class="week-card">
    <h1 id="sel-week">Week 1</h1>
    <p id="sel-fase">Phase 1 - Adaptation</p>
    <p class="total" id="sel-total">6 min running</p>
  </div>
  <div class="nav-row">
    <button id="btn-prev">&#9664; Prev</button>
    <button id="btn-next-week">Next &#9654;</button>
  </div>
  <button id="btn-start">START &#9654;</button>
  <p class="saved-note" id="saved-note"></p>
  <button id="btn-history">Session history</button>
</div>

<!-- SCREEN: HISTORY -->
<div id="screen-history">
  <h2>Session History</h2>
  <div id="history-list"></div>
  <button id="btn-back-history">&#9664; Back</button>
</div>

<!-- SCREEN: WORKOUT -->
<div id="screen-workout">
  <div class="wk-header">
    <span id="wk-title">Week 1</span>
    <span id="wk-block-count">Block 1/14</span>
  </div>
  <div class="current-block">
    <div class="current-type run" id="cur-type">WALK</div>
    <div class="current-time" id="cur-time">5:00</div>
    <div class="next-block" id="next-info">Next: <span>Run</span> in 5:00</div>
  </div>
  <div class="progress-bar-wrap"><div class="progress-bar" id="prog-bar" style="width:0%"></div></div>
  <p class="progress-label" id="prog-label">0 / 30 min</p>
  <div class="blocks-list" id="blocks-list"></div>
  <button id="btn-pause">&#10074;&#10074; Pause</button>
  <button id="btn-finish">&#9724; Finish workout</button>
</div>

<!-- PAUSE OVERLAY -->
<div id="pause-overlay">
  <h2>Paused</h2>
  <button id="btn-resume">&#9654; Resume</button>
  <button id="btn-restart">&#8635; Restart</button>
  <button id="btn-quit">&#10005; Quit</button>
</div>

<!-- FINISH CONFIRM OVERLAY -->
<div id="finish-overlay">
  <h2>Finish workout?</h2>
  <button id="btn-finish-confirm">&#9724; Finish</button>
  <button id="btn-finish-cancel">&#8617; Cancel</button>
</div>

<!-- SCREEN: DONE -->
<div id="screen-done">
  <div style="font-size:4rem">&#127881;</div>
  <h1 id="done-title">Week 1 done!</h1>
  <p id="done-sub">6 min of running</p>
  <button id="btn-next">Go to Week 2 &#9654;</button>
  <button id="btn-repeat">Repeat Week 1</button>
</div>

<audio id="snd-run"  src="data:audio/mp3;base64,{sound_run}"  preload="auto"></audio>
<audio id="snd-walk" src="data:audio/mp3;base64,{sound_walk}" preload="auto"></audio>
<audio id="snd-done" src="data:audio/mp3;base64,{sound_done}" preload="auto"></audio>

<script>
const WEEKS = {weeks_json};
const LS_WEEK = 'runtimer_week';
const LS_DONE = 'runtimer_done';
const LS_HIST = 'runtimer_history';

let currentWeek = 0;
let blockIdx = 0;
let elapsed = 0;
let startTime = 0;
let ticker = null;
let wakeLock = null;

const $ = id => document.getElementById(id);

// ---------- NAV ----------
function savedWeek() {{ return parseInt(localStorage.getItem(LS_WEEK) || '0'); }}
function doneWeeks()  {{ return JSON.parse(localStorage.getItem(LS_DONE) || '[]'); }}
function markDone(n)  {{
  const d = doneWeeks();
  if (!d.includes(n)) d.push(n);
  localStorage.setItem(LS_DONE, JSON.stringify(d));
}}

function addHistory(weekN, action, durationSecs) {{
  const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
  const date = new Date().toLocaleDateString('pt-BR');
  const dur = Math.floor(durationSecs / 60) + ' min';
  hist.unshift({{ date, week: weekN, action, dur }});
  localStorage.setItem(LS_HIST, JSON.stringify(hist));
}}

function showHistory() {{
  $('screen-select').classList.remove('active');
  $('screen-history').classList.add('active');
  const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
  const list = $('history-list');
  if (hist.length === 0) {{
    list.innerHTML = '<p style="color:#555;text-align:center;margin-top:40px">No sessions yet.</p>';
    return;
  }}
  list.innerHTML = hist.map(h => `
    <div class="hist-row">
      <div>
        <div class="hist-week">Week ${{h.week}}</div>
        <div class="hist-action-${{h.action}}">${{h.action === 'advance' ? 'Advanced to next week' : 'Repeat week'}}</div>
      </div>
      <div class="hist-meta">${{h.date}}<br>${{h.dur}}</div>
    </div>`).join('');
}}

function showSelect() {{
  $('screen-select').classList.add('active');
  $('screen-workout').classList.remove('active');
  $('screen-done').classList.remove('active');
  $('screen-history').classList.remove('active');
  renderSelect();
}}

function renderSelect() {{
  const w = WEEKS[currentWeek];
  $('sel-week').textContent = 'Week ' + w.n;
  $('sel-fase').textContent = w.fase;
  $('sel-total').textContent = w.total;
  const done = doneWeeks();
  $('saved-note').textContent = done.includes(w.n) ? 'Week ' + w.n + ' completed before' : '';
}}

$('btn-prev').onclick = () => {{ if (currentWeek > 0) {{ currentWeek--; renderSelect(); }} }};
$('btn-next-week').onclick = () => {{ if (currentWeek < WEEKS.length-1) {{ currentWeek++; renderSelect(); }} }};
$('btn-start').onclick = startWorkout;

// ---------- WORKOUT ----------
function fmt(s) {{
  const m = Math.floor(s/60), ss = s%60;
  return m + ':' + String(ss).padStart(2,'0');
}}

function buildBlocksList() {{
  const w = WEEKS[currentWeek];
  const ul = $('blocks-list');
  ul.innerHTML = '';
  w.blocos.forEach((b, i) => {{
    const row = document.createElement('div');
    row.className = 'block-row ' + b.type;
    row.id = 'blk-' + i;
    row.innerHTML = `<div class="block-dot"></div><span>${{b.label}}</span><span class="block-time">${{b.display}}</span>`;
    ul.appendChild(row);
  }});
}}

function scrollToBlock(i) {{
  const el = $('blk-' + i);
  if (el) el.scrollIntoView({{behavior:'smooth', block:'center'}});
}}

function updateBlocksList() {{
  const w = WEEKS[currentWeek];
  w.blocos.forEach((_, i) => {{
    const row = $('blk-' + i);
    if (!row) return;
    row.classList.remove('current','done');
    if (i === blockIdx) row.classList.add('current');
    else if (i < blockIdx) row.classList.add('done');
  }});
}}

function startWorkout() {{
  blockIdx = 0;
  elapsed = 0;
  startTime = Date.now();
  buildBlocksList();
  $('screen-select').classList.remove('active');
  $('screen-workout').classList.add('active');
  acquireWakeLock();
  playSound(WEEKS[currentWeek].blocos[0].type);
  tick();
  ticker = setInterval(tick, 1000);
}}

function tick() {{
  const w = WEEKS[currentWeek];
  elapsed = Math.floor((Date.now() - startTime) / 1000);

  // advance blockIdx to wherever we actually are (handles background skips)
  while (blockIdx < w.blocos.length - 1 && elapsed >= w.blocos[blockIdx].end) {{
    blockIdx++;
    playSound(w.blocos[blockIdx].type);
  }}

  if (elapsed >= w.blocos[w.blocos.length - 1].end) {{
    finishWorkout();
    return;
  }}

  const b = w.blocos[blockIdx];
  const blockRemain = b.end - elapsed;

  // header
  $('wk-title').textContent = 'Week ' + w.n;
  $('wk-block-count').textContent = 'Block ' + (blockIdx+1) + '/' + w.blocos.length;

  // current
  $('cur-type').textContent = b.type === 'run' ? 'RUN' : 'WALK';
  $('cur-type').className = 'current-type ' + b.type;
  $('cur-time').textContent = fmt(blockRemain);

  // next
  const next = w.blocos[blockIdx+1];
  if (next) {{
    $('next-info').innerHTML = 'Next: <span>' + (next.type==='run'?'Run':'Walk') + '</span> in ' + fmt(blockRemain);
  }} else {{
    $('next-info').textContent = 'Last block!';
  }}

  // progress
  const totalSecs = w.blocos[w.blocos.length-1].end;
  const pct = Math.min(100, Math.round(elapsed / totalSecs * 100));
  $('prog-bar').style.width = pct + '%';
  $('prog-label').textContent = fmt(elapsed) + ' / ' + fmt(totalSecs);

  updateBlocksList();
}}

function finishWorkout() {{
  clearInterval(ticker);
  releaseWakeLock();
  playSound('done');
  markDone(WEEKS[currentWeek].n);
  const next = WEEKS[currentWeek+1];
  $('done-title').textContent = 'Week ' + WEEKS[currentWeek].n + ' done!';
  $('done-sub').textContent = WEEKS[currentWeek].total;
  $('btn-next').style.display = next ? '' : 'none';
  if (next) {{ $('btn-next').textContent = 'Go to Week ' + next.n + ' \u25ba'; }}
  $('btn-repeat').textContent = 'Repeat Week ' + WEEKS[currentWeek].n;
  $('screen-workout').classList.remove('active');
  $('screen-done').classList.add('active');
  localStorage.setItem(LS_WEEK, Math.min(currentWeek+1, WEEKS.length-1));
}}

// ---------- PAUSE ----------
$('btn-pause').onclick = () => $('pause-overlay').classList.add('active');
$('btn-finish').onclick = () => $('finish-overlay').classList.add('active');
$('btn-finish-confirm').onclick = () => {{
  $('finish-overlay').classList.remove('active');
  clearInterval(ticker);
  releaseWakeLock();
  finishWorkout();
}};
$('btn-finish-cancel').onclick = () => $('finish-overlay').classList.remove('active');
$('btn-resume').onclick = () => $('pause-overlay').classList.remove('active');
$('btn-restart').onclick = () => {{
  $('pause-overlay').classList.remove('active');
  clearInterval(ticker);
  startTime = Date.now();
  startWorkout();
}};
$('btn-quit').onclick = () => {{
  clearInterval(ticker);
  releaseWakeLock();
  $('pause-overlay').classList.remove('active');
  showSelect();
}};

// ---------- DONE ----------
$('btn-next').onclick = () => {{
  addHistory(WEEKS[currentWeek].n, 'advance', elapsed);
  currentWeek = Math.min(currentWeek+1, WEEKS.length-1);
  $('screen-done').classList.remove('active');
  showSelect();
}};
$('btn-repeat').onclick = () => {{
  addHistory(WEEKS[currentWeek].n, 'repeat', elapsed);
  $('screen-done').classList.remove('active');
  showSelect();
}};

// ---------- HISTORY ----------
$('btn-history').onclick = showHistory;
$('btn-back-history').onclick = () => {{ $('screen-history').classList.remove('active'); showSelect(); }};

// ---------- SOUND ----------
function playSound(type) {{
  const id = type === 'run' ? 'snd-run' : type === 'done' ? 'snd-done' : 'snd-walk';
  const el = $(id);
  el.currentTime = 0;
  el.play().catch(()=>{{}});
}}

// ---------- WAKELOCK ----------
async function acquireWakeLock() {{
  try {{ wakeLock = await navigator.wakeLock.request('screen'); }} catch(e) {{}}
}}
function releaseWakeLock() {{
  if (wakeLock) {{ wakeLock.release(); wakeLock = null; }}
}}

// ---------- INIT ----------
currentWeek = savedWeek();
showSelect();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
</script>
</body>
</html>"""

out = r"C:\Users\joaob\timer-corrida\index.html"
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Gerado: {out}")
