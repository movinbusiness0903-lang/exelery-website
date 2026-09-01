/**
 * Kleiner statischer Server fuer die lokale Ansicht der Website.
 *
 * Warum ueberhaupt einer: die Seite laesst sich zwar per Doppelklick oeffnen,
 * aber ueber `file://` laufen weder die Bildsequenz noch die Messungen im
 * Entwicklerwerkzeug zuverlaessig. Fuer „sieht das auf dem Handy richtig aus"
 * braucht es echtes HTTP.
 *
 * Aufruf:  node serve.mjs        (dann http://localhost:5181 oeffnen)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5181);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    // normalize + Praefixpruefung: kein Ausbruch aus dem Ordner ueber "..".
    let pfad = normalize(join(root, url));
    if (!pfad.startsWith(root)) {
      res.writeHead(403).end('Verboten');
      return;
    }
    let s = await stat(pfad).catch(() => null);
    if (s?.isDirectory()) {
      pfad = join(pfad, 'index.html');
      s = await stat(pfad).catch(() => null);
    }
    if (!s) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
      return;
    }
    const body = await readFile(pfad);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(pfad).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Fehler: ' + e.message);
  }
}).listen(PORT, () => {
  console.log(`Website laeuft auf http://localhost:${PORT}`);
});
