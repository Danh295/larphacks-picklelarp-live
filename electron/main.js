import { app, BrowserWindow, Menu, dialog, ipcMain, session, systemPreferences } from 'electron';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm',
  '.task': 'application/octet-stream', '.png': 'image/png', '.svg': 'image/svg+xml'
};

// Serve the app root over http://127.0.0.1:<ephemeral> so it is a secure context
// (ES modules, getUserMedia, wasm streaming all need it; file:// does not work).
function startServer() {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    // Serve only what the app needs (not .git, node_modules, research, ...).
    const ok = /^\/(index\.html|src\/|vendor\/|build\/)/.test(rel) && file.startsWith(ROOT + path.sep);
    if (!ok) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-cache'
      });
      const rs = fs.createReadStream(file);
      rs.on('error', () => res.destroy());
      rs.pipe(res);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

let win = null;
const toggleFullscreen = () => { if (win) win.setFullScreen(!win.isFullScreen()); };

async function createWindow() {
  const port = await startServer();
  const origin = `http://127.0.0.1:${port}`;

  const allow = (url, p) => p === 'media' && (url || '').startsWith(origin + '/');
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(allow(wc.getURL(), permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allow(wc ? wc.getURL() : '', permission));

  if (process.platform === 'darwin') {
    try {
      if (!(await systemPreferences.askForMediaAccess('camera'))) {
        dialog.showErrorBox('Camera access is off', 'Enable the camera for this app in System Settings > Privacy & Security > Camera, then relaunch.');
      }
    } catch (e) { console.warn('camera access', e); }
  }

  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: '#05070f', autoHideMenuBar: true, title: 'PickleLARP Live',
    webPreferences: { preload: path.join(ROOT, 'electron', 'preload.cjs'), contextIsolation: true, sandbox: true }
  });
  win.on('closed', () => { win = null; });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin + '/')) e.preventDefault(); });
  // Esc leaves fullscreen; plain F is handled in the renderer so typing in the name box is safe.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) { win.setFullScreen(false); e.preventDefault(); }
  });
  await win.loadURL(`${origin}/index.html`);
}

ipcMain.on('toggle-fullscreen', toggleFullscreen);
app.whenReady().then(createWindow).catch(e => { dialog.showErrorBox('PickleLARP Live failed to start', String(e)); app.quit(); });
app.on('window-all-closed', () => app.quit());
