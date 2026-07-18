const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8443;
const HTTP_PORT = process.env.HTTP_PORT || 8080;

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('\n❌ Faltan cert.pem / key.pem.');
  console.error('   Ejecuta primero:  npm run gen-cert\n');
  process.exit(1);
}

function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Servidor HTTP: sirve viewer.html (sin cert, para OBS) y el certificado para el iPhone.
const httpApp = express();
httpApp.use(express.static(path.join(__dirname, 'public')));
httpApp.get('/cert', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/x-x509-ca-cert',
    'Content-Disposition': 'attachment; filename="iphone-webcam-bridge.pem"',
  });
  res.end(fs.readFileSync(certPath));
});
const certServer = http.createServer(httpApp);

const httpsServer = https.createServer(
  { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
  app
);

// --- Señalización WebRTC + Control remoto ---
let phoneSocket = null;
let viewerSocket = null;
let controlSocket = null;

function broadcastStatus() {
  const status = JSON.stringify({
    type: 'status',
    phone: !!phoneSocket && phoneSocket.readyState === phoneSocket.OPEN,
    viewer: !!viewerSocket && viewerSocket.readyState === viewerSocket.OPEN,
  });
  if (controlSocket && controlSocket.readyState === controlSocket.OPEN) {
    controlSocket.send(status);
    if (phoneSocket && phoneSocket.readyState === phoneSocket.OPEN) {
      phoneSocket.send(JSON.stringify({ type: 'request-cameras' }));
      phoneSocket.send(JSON.stringify({ type: 'request-state' }));
    }
  }
}

function handleSignaling(ws, req, protocol) {
  const url = new URL(req.url, `${protocol}://localhost`);
  const role = url.searchParams.get('role');

  if (role === 'phone') {
    phoneSocket = ws;
    console.log('📱 iPhone conectado');
    broadcastStatus();
  } else if (role === 'viewer') {
    viewerSocket = ws;
    console.log('🖥️  Visor (PC) conectado');
    broadcastStatus();
  } else if (role === 'control') {
    controlSocket = ws;
    console.log('🎛️  Control remoto conectado');
    broadcastStatus();
  } else {
    ws.close();
    return;
  }

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (role === 'control' && msg.type === 'control') {
      if (phoneSocket && phoneSocket.readyState === phoneSocket.OPEN) {
        phoneSocket.send(JSON.stringify(msg));
      }
      return;
    }

    if (role === 'phone' && msg.type === 'cameras') {
      if (controlSocket && controlSocket.readyState === controlSocket.OPEN) {
        controlSocket.send(JSON.stringify(msg));
      }
      return;
    }

    if (role === 'phone' && msg.type === 'state') {
      if (controlSocket && controlSocket.readyState === controlSocket.OPEN) {
        controlSocket.send(JSON.stringify(msg));
      }
      return;
    }

    const target = role === 'phone' ? viewerSocket : phoneSocket;
    if (target && target.readyState === target.OPEN) {
      target.send(JSON.stringify(msg));
    }
  });

  ws.on('close', () => {
    if (role === 'phone') phoneSocket = null;
    if (role === 'viewer') viewerSocket = null;
    if (role === 'control') controlSocket = null;
    broadcastStatus();
    console.log(`${role === 'phone' ? '📱 iPhone' : role === 'viewer' ? '🖥️  Visor' : '🎛️  Control'} desconectado`);
  });
}

// WSS en el servidor HTTPS (para el iPhone)
const wss = new WebSocketServer({ server: httpsServer });
wss.on('connection', (ws, req) => handleSignaling(ws, req, 'https'));

// WS plano en el servidor HTTP (para el viewer en OBS, sin cert)
const wssHttp = new WebSocketServer({ server: certServer });
wssHttp.on('connection', (ws, req) => handleSignaling(ws, req, 'http'));

httpsServer.listen(PORT, () => {
  const ips = getLocalIPs();
  console.log('\n=== iPhone Webcam Bridge ===\n');
  console.log('1) En tu PC, abre esto UNA VEZ para instalar el certificado en el iPhone.');
  console.log(`   Certificado (desde el iPhone): http://${ips[0] || 'TU-IP'}:${HTTP_PORT}/cert\n`);
  console.log('2) En el iPhone (Safari), abre:');
  ips.forEach((ip) => console.log(`   https://${ip}:${PORT}/phone.html`));
  console.log('\n3) En tu PC (Chrome/Edge), abre el panel de control:');
  console.log(`   http://localhost:${HTTP_PORT}/control.html`);
  console.log('\n4) En tu PC (OBS), abre el viewer:');
  ips.forEach((ip) => console.log(`   http://${ip}:${HTTP_PORT}/viewer.html`));
  console.log(`   (o simplemente: http://localhost:${HTTP_PORT}/viewer.html)\n`);
});

certServer.listen(HTTP_PORT, () => {
  console.log(`Servidor HTTP activo en el puerto ${HTTP_PORT} (viewer + descarga de cert)`);
});
