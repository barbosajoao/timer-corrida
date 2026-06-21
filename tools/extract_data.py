"""Extrai os dados das 16 semanas do C25K para data/c25k_16week.json.

Auxiliar de migração: roda uma vez para gerar os JSONs a partir da mesma
fonte de dados/lógica que o antigo gerar_timer.py usava. Os blocos sao gravados
JA PROCESSADOS (merge do cool-down em 3 min), garantindo paridade exata com o
que esta publicado hoje. Os labels NAO sao gravados: o site os deriva dos tempos.
"""
import json
import os

# ---- dados-fonte (identicos ao antigo gerar_timer.py) ----
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

COOLDOWN_SECS = 180  # cool-down walk reduzido de 5 min para 3 min


def t2s(t):
    m, s = t.split(":")
    return int(m) * 60 + int(s)


def s2disp(secs):
    return f"{secs//60:02d}:{secs%60:02d}"


def process_blocks(blocos):
    """Converte para segundos e funde a ultima caminhada de recuperacao num
    unico cool-down walk de 3 min (mesma logica do antigo gerar_timer.py)."""
    b = [[t2s(s), t2s(e), t] for (s, e, t) in blocos]
    cooldown = b[-1]
    prev = b[-2]
    if prev[2] == "walk":
        new_start = prev[0]
        b = b[:-2]
    else:
        new_start = cooldown[0]
        b = b[:-1]
    b.append([new_start, new_start + COOLDOWN_SECS, "walk"])
    return b


def build_c25k():
    weeks = []
    for s in semanas:
        raw = process_blocks(s["blocos"])
        # novo formato: [tipo, duracao_em_segundos]
        blocos = [[tipo, end - start] for (start, end, tipo) in raw]
        weeks.append({
            "n": s["n"],
            "fase": s["fase"],
            "total": s["total"],
            "blocos": blocos,
        })
    return {
        "id": "c25k_16week",
        "name": "Couch to 5K",
        "weeks": weeks,
    }


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(data_dir, exist_ok=True)

    # c25k
    c25k = build_c25k()
    with open(os.path.join(data_dir, "c25k_16week.json"), "w", encoding="utf-8") as f:
        json.dump(c25k, f, ensure_ascii=False, indent=2)

    # 10k placeholder (sem semanas; marcado indisponivel no catalogo)
    tenk = {
        "id": "10k_16week",
        "name": "10K",
        "weeks": [],
    }
    with open(os.path.join(data_dir, "10k_16week.json"), "w", encoding="utf-8") as f:
        json.dump(tenk, f, ensure_ascii=False, indent=2)

    # catalogo de programas
    programs = {
        "programs": [
            {
                "id": "c25k_16week",
                "name": "Couch to 5K",
                "subtitle": "16 semanas \u00b7 do sof\u00e1 aos 5K",
                "available": True,
                "file": "./data/c25k_16week.json",
            },
            {
                "id": "10k_16week",
                "name": "10K",
                "subtitle": "16 semanas",
                "available": False,
                "file": None,
            },
        ]
    }
    with open(os.path.join(data_dir, "programs.json"), "w", encoding="utf-8") as f:
        json.dump(programs, f, ensure_ascii=False, indent=2)

    print("JSONs gerados em data/: c25k_16week.json, 10k_16week.json, programs.json")


if __name__ == "__main__":
    main()
