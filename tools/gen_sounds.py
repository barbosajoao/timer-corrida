"""Gera os arquivos de som (mp3) usados pelo timer.

Roda uma vez para (re)criar os arquivos em ../sounds/. Requer gTTS:
    pip install gtts

Para mudar a voz/idioma ou os textos, edite SOUNDS abaixo e rode de novo.
"""
import os
from gtts import gTTS

SOUNDS = {
    "run":  "Run!",
    "walk": "Walk!",
    "done": "Workout complete!",
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "sounds")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, text in SOUNDS.items():
        path = os.path.join(OUT_DIR, f"{name}.mp3")
        print(f"Gerando {path} ...")
        gTTS(text=text, lang="en").save(path)
    print("Sons gerados.")


if __name__ == "__main__":
    main()
