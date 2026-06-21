"""Valida os arquivos de dados dos treinos (data/*.json).

Rede de seguranca: rode antes de commitar mudancas nos dados para garantir que
nenhum treino ficou malformado. Espelha exatamente a validacao que o site faz
em validateProgram() no app.js.

Uso:
    python tools/verify.py

Sai com codigo 0 se tudo estiver ok, ou 1 se encontrar algum problema.
"""
import json
import os
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def validate_program(prog, fname):
    """Retorna lista de erros (vazia = ok)."""
    errors = []
    for field in ("id", "name", "weeks"):
        if field not in prog:
            errors.append(f"{fname}: campo obrigatorio ausente: '{field}'")
    weeks = prog.get("weeks", [])
    # placeholder (sem semanas) e valido: o catalogo marca available=false
    if not weeks:
        return errors
    for w in weeks:
        n = w.get("n", "?")
        blocos = w.get("blocos", [])
        if not blocos:
            errors.append(f"{fname}: semana {n} sem blocos")
            continue
        for i, raw in enumerate(blocos, 1):
            if not isinstance(raw, list) or len(raw) != 2:
                errors.append(f"{fname}: semana {n} bloco {i}: formato deve ser [tipo, segundos]")
                continue
            tipo, dur = raw[0], raw[1]
            if tipo not in ("run", "walk"):
                errors.append(f"{fname}: semana {n} bloco {i}: tipo invalido '{tipo}' (use 'run' ou 'walk')")
            if not isinstance(dur, (int, float)) or dur <= 0:
                errors.append(f"{fname}: semana {n} bloco {i}: duracao invalida '{dur}' (use segundos > 0)")
    return errors


def validate_catalog(catalog, program_ids):
    """Verifica programs.json: estrutura e referencias aos arquivos."""
    errors = []
    progs = catalog.get("programs")
    if not isinstance(progs, list):
        return [f"programs.json: 'programs' deve ser uma lista"]
    for p in progs:
        pid = p.get("id", "?")
        for field in ("id", "name", "available"):
            if field not in p:
                errors.append(f"programs.json: programa '{pid}' sem campo '{field}'")
        if p.get("available"):
            f = p.get("file")
            if not f:
                errors.append(f"programs.json: programa '{pid}' disponivel mas sem 'file'")
            else:
                path = os.path.join(DATA_DIR, "..", f.lstrip("./"))
                if not os.path.exists(path):
                    errors.append(f"programs.json: arquivo referenciado nao existe: {f}")
    return errors


def main():
    all_errors = []
    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]

    program_ids = []
    for fname in sorted(files):
        path = os.path.join(DATA_DIR, fname)
        try:
            data = json.load(open(path, encoding="utf-8"))
        except json.JSONDecodeError as e:
            all_errors.append(f"{fname}: JSON invalido: {e}")
            continue

        if fname == "programs.json":
            continue  # validado depois (precisa dos ids)
        all_errors.extend(validate_program(data, fname))
        if "id" in data:
            program_ids.append(data["id"])

    catalog_path = os.path.join(DATA_DIR, "programs.json")
    if os.path.exists(catalog_path):
        catalog = json.load(open(catalog_path, encoding="utf-8"))
        all_errors.extend(validate_catalog(catalog, program_ids))
    else:
        all_errors.append("programs.json nao encontrado")

    if all_errors:
        print("PROBLEMAS ENCONTRADOS:")
        for e in all_errors:
            print("  - " + e)
        sys.exit(1)
    print(f"OK - {len(files)} arquivo(s) validado(s), nenhum problema.")


if __name__ == "__main__":
    main()
