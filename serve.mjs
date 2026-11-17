// Servidor estático sem dependências para o Summit (módulos ES precisam de HTTP).
// Uso: node serve.mjs [porta]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 8080;
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.glb': 'model/gltf-binary',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8'
};

createServer(async (req, res) => {
    try {
        const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const rel = normalize(url === '/' ? '/index.html' : url).replace(/^[/\\]+/, '');
        if (rel.startsWith('..')) throw new Error('fora da pasta');
        const data = await readFile(join(ROOT, rel));
        res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Nao encontrado');
    }
}).listen(PORT, () => {
    console.log(`Summit rodando em http://localhost:${PORT}`);
    console.log('Feche esta janela para parar.');
});
