export const staticSource = String.raw`import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
export async function serveStatic(req, res, pathname, rootDirectory) {
  const options = { staticRoot: rootDirectory };
      if (options.staticRoot && req.method === 'GET' && !pathname.startsWith('/__flowforge/')) {
        try {
          const root = resolve(options.staticRoot);
          const file = resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
          if (!file.startsWith(root + sep)) throw new Error();
          const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
          res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
          res.end(await readFile(file)); return true;
        } catch { res.statusCode = 404; res.end('Recurso não encontrado.'); return true; }
      }
  return false;
}
`;
