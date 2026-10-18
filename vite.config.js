import {createWriteStream} from 'node:fs';
import {mkdir, rename, rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';

// Local QA only. The request contains recording bytes, never a destination path.
const capturePath = fileURLToPath(new URL('./.sites-runtime/v22.2/evidence/solid-summit-actual-game.webm', import.meta.url));
function localGameCapture() {
  let saving = false;
  return {
    name: 'local-actual-game-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const frame=/^\/__dev\/capture\/summit-frame-(\d{2})\.png$/.exec(request.url||'');
        if (request.url !== '/__dev/capture/career-valley'&&!frame) return next();
        const destination=frame?fileURLToPath(new URL(`./.sites-runtime/v22.2/evidence/summit-frame-${frame[1]}.png`,import.meta.url)):capturePath;
        const reply = (status, body) => {
          response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
          response.end(JSON.stringify(body));
        };
        const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
        const origin = request.headers.origin;
        const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(request.headers.host || '');
        if (!localAddresses.includes(request.socket.remoteAddress) ||
            !localHost ||
            request.headers['x-career-capture'] !== 'actual-game' ||
            (origin && origin !== `http://${request.headers.host}`)) {
          return reply(403, {error: 'Local recording requests only'});
        }
        if (request.method !== 'POST') return reply(405, {error: 'POST required'});
        if (!(frame?/^image\/png$/:/^video\/webm(?:;|$)/i).test(request.headers['content-type'] || '')) {
          return reply(415, {error: 'A rendered image or WebM recording is required'});
        }
        const maxBytes = 256 * 1024 * 1024;
        if (Number(request.headers['content-length']) > maxBytes) return reply(413, {error: 'Recording exceeds 256 MiB'});
        if (saving) return reply(409, {error: 'A recording is already being saved'});
        saving = true;
        const temporaryPath = `${destination}.${process.pid}.partial`;
        let bytes = 0;
        try {
          await mkdir(dirname(capturePath), {recursive: true});
          await pipeline(request, new Transform({
            transform(chunk, encoding, callback) {
              bytes += chunk.length;
              callback(bytes > maxBytes ? new Error('Recording exceeds 256 MiB') : null, chunk);
            }
          }), createWriteStream(temporaryPath, {flags: 'wx'}));
          if (!bytes) throw new Error('Recording is empty');
          await rename(temporaryPath, destination);
          reply(200, {saved: true, bytes, path: frame?`.sites-runtime/v22.2/evidence/summit-frame-${frame[1]}.png`:'.sites-runtime/v22.2/evidence/solid-summit-actual-game.webm'});
        } catch (error) {
          await rm(temporaryPath, {force: true}).catch(() => {});
          if (!response.destroyed) reply(500, {error: error.message});
        } finally {
          saving = false;
        }
      });
    }
  };
}

// Rapier's compatibility build initializes its WASM explicitly; no WASM or
// top-level-await transform is needed for the new boat runtime.
export default {
 plugins:[localGameCapture()],
 root:'sources', publicDir:'../static', base:'./',
 build:{outDir:'../dist',emptyOutDir:true,chunkSizeWarningLimit:4000},
 server:{host:'127.0.0.1',port:5173,open:false}
};
