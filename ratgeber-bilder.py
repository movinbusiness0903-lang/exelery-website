# Bilder der Ratgeberseiten aus dem Higgsfield-Archiv im Vault (nur lesen).
# Kevin 25.11.2026: „nicht überall das selbe Bild … jede Seite ein anderes,
# passend zum Inhalt; Übersicht eine Farbkulisse“.
#
#   uebersicht.webp      grüne Wellen (06_Farbverlaeufe_Texturen …4b8bb259, 896 px → ×2); der
#                        Mintverlauf …af65af13 leuchtete nur unten und verschwand im Auslauf
#   karte-kalorien.webp  Gemüse auf Schiefer (02_Essen …6bcc61ae, 1856 px)
#   karte-eiweiss.webp   Eier in der Schale (02_Essen …ff4e38b7, 1296 px)
#   kalorien.webp        Gemüsekorb (02_Essen …91d54f69, 1296 px → ×2)
#   eiweiss.webp         Schale Quark (02_Essen …621f485e, 1296 px → ×2)
#   bedarf.webp          Schale Nüsse (02_Essen …e1b26dcf, 1296 px → ×2)
#   karte-bedarf.webp    Meal-Prep-Boxen (02_Essen …9c067e3e, 1296 px). Die Kichererbsen
#                        (…b67ceddd) gingen auf der Karte unter; die Küchenwaage
#                        (04_Dinge …35ca9962) trägt erfundene Schrift → nie.
#
# ×2 wie planung/social/kulissen-hochrechnen.py: Real-ESRGAN liefert nur die
# Feinstruktur, Farbe und Helligkeit bleiben vom Original (Abweichung < 1).
# Aufruf: python -P ratgeber-bilder.py
import os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageFilter

ARCHIV = r'C:\Users\Kevin\zweites Gehirn\07 Anhänge\EXELERY\Bilder\Higgsfield-Archiv\Teil 2 – 2026-10-01 bis 2026-11-06\02_Kulissen'
ESRGAN = r'C:\Users\Kevin\tools\realesrgan\realesrgan-ncnn-vulkan.exe'
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media', 'ratgeber')
os.makedirs(ZIEL, exist_ok=True)
tmp = tempfile.mkdtemp(prefix='ratgeber-')

PLAN = [
    ('uebersicht.webp', r'06_Farbverlaeufe_Texturen\2026-11-02_091408_4b8bb259.png', True, 1920),
    ('karte-kalorien.webp', r'02_Essen\2026-11-05_190140_6bcc61ae.png', False, 1400),
    ('karte-eiweiss.webp', r'02_Essen\2026-10-13_160906_ff4e38b7.png', False, 1296),
    ('kalorien.webp', r'02_Essen\2026-10-13_161502_91d54f69.png', True, 1920),
    ('eiweiss.webp', r'02_Essen\2026-10-13_160908_621f485e.png', True, 1920),
    ('bedarf.webp', r'02_Essen\2026-10-13_161836_e1b26dcf.png', True, 1920),
    ('karte-bedarf.webp', r'02_Essen\2026-10-13_160612_9c067e3e.png', False, 1296),
]


def hoch(quelle):
    im = Image.open(quelle).convert('RGB')
    w, h = im.size
    roh, x4 = os.path.join(tmp, 'roh.png'), os.path.join(tmp, 'x4.png')
    im.save(roh)
    subprocess.run([ESRGAN, '-i', roh, '-o', x4, '-n', 'realesrgan-x4plus'], check=True, capture_output=True)
    W, H = 2 * w, 2 * h
    U = np.asarray(im.resize((W, H), Image.LANCZOS), dtype=np.float32)
    e = Image.open(x4).convert('RGB').resize((W, H), Image.LANCZOS)
    E, B = np.asarray(e, dtype=np.float32), np.asarray(e.filter(ImageFilter.GaussianBlur(2.0)), dtype=np.float32)
    R = np.clip(U + 0.8 * (E - B), 0, 255)
    return Image.fromarray(R.round().astype(np.uint8))


for name, rel, mit_hoch, breite in PLAN:
    q = os.path.join(ARCHIV, rel)
    im = hoch(q) if mit_hoch else Image.open(q).convert('RGB')
    if im.size[0] > breite:
        im = im.resize((breite, round(im.size[1] * breite / im.size[0])), Image.LANCZOS)
    p = os.path.join(ZIEL, name)
    if name == 'uebersicht.webp':
        # Reiner Verlauf: ohne feines Rauschen zerfällt er nach der Kompression in
        # Ringe (dieselbe Falle wie bei den Posts, serie-pruefen „Verlauf ohne Ringe“).
        a = np.asarray(im, dtype=np.float32)
        a = a + np.random.default_rng(7).normal(0, 1.4, a.shape[:2])[..., None]
        im = Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8))
        im.save(p, quality=90, method=6)
    else:
        im.save(p, quality=82, method=6)
    print(f'{name}: {im.size[0]}x{im.size[1]}, {os.path.getsize(p) // 1024} KB')
