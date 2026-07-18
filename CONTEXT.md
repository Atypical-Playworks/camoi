# CONTEXT.md — iPhone Webcam Bridge

## Dominio del proyecto

Este es un sistema de transmisión de video local que conecta un iPhone como fuente de cámara web a una PC con Windows, usando WebRTC como protocolo de transporte y OBS Studio como intermediario para exponer la imagen como webcam virtual.

El problema que resuelve: las apps como Camo/DroidCam requieren driver de webcam virtual firmado por Microsoft en Windows, que es complejo de desarrollar. Esta solución delega esa parte a OBS Studio, que ya trae esa funcionalidad.

## Arquitectura

```
┌─────────────┐      WebRTC (P2P, video+audio)      ┌──────────────┐
│   iPhone     │ ◀──────────────────────────────────▶│  PC (local)  │
│  Safari      │      (vía servidor de señalización)  │  Chrome/Edge │
│  phone.html  │                                      │  viewer.html │
└─────────────┘                                        └──────┬───────┘
                                                                │ Browser
       ▲                                                       │ Source
       │ HTTPS/WSS                                             ▼
┌──────┴────────────────────────────────────────────────────────────┐
│                    server.js (Node.js)                             │
│  - Express: archivos estáticos (phone.html, viewer.html, etc)    │
│  - WebSocketServer (ws): señalización WebRTC + control remoto    │
│  - HTTPS con cert autofirmado (necesario para iOS Safari)         │
│  - HTTP aparte (:8080) para viewer/OBS + cert + control           │
└──────────────────────────────────────────────────────────────────┘
                                                                │
       ┌────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐                              ┌──────────────┐
│ control.html │  ◀── WebSocket control ──▶   │  phone.html  │
│  (PC)        │                              │  (iPhone)    │
│  - Cameras   │  ──── cameras list ────────▶ │              │
│  - Quality   │  ──── control commands ────▶ │              │
│  - Rotation  │                              │  - WebRTC    │
│  - Mirror    │                              │  - MediaPipe │
│  - Portrait  │                              │    (blur)    │
└──────────────┘                              └──────────────┘
       │
       ▼
  OBS Studio
  (Browser Source → Virtual Camera)
       │
       ▼
  Zoom / Teams / Discord
```

## Componentes

### server.js

Servidor principal. Dos puertos:
- `:8443` — HTTPS con Express + WebSocketServer. Sirve archivos estáticos y maneja señalización.
- `:8080` — HTTP plano. Sirve viewer, control, certificado.

WebSocket usa query param `?role=phone`, `?role=viewer`, o `?role=control` para asignar roles.

**Roles:**
- `phone` — iPhone, emisor WebRTC
- `viewer` — PC/OBS, receptor WebRTC
- `control` — PC, panel de control remoto

**Enrutamiento de mensajes:**
- `control` messages (de control) → reenvía al phone
- `cameras` messages (del phone) → reenvía al control
- `status` broadcasts → envía estado de phone/viewer al control
- `request-cameras` → phone re-envía lista de cámaras al control
- Señalización WebRTC (`offer`, `answer`, `candidate`) → phone ↔ viewer

### phone.html (cliente iPhone)

Lado **offerer** del WebRTC. Funciones:
- `getUserMedia` con cámara seleccionable
- Recibe comandos `control` desde control.html vía WebSocket
- Cambia cámara, calidad, rotación, espejo en tiempo reals
- Canvas-based rotation/mirror (captureStream)
- **MediaPipe Selfie Segmentation** para modo retrato (blur de fondo)
- Crea la oferta WebRTC y la envía al servidor de señalización
- Conexión WebSocket al servidor con `?role=phone`
- Simplificado: solo botón "Iniciar cámara", todo el control es remoto

### viewer.html (cliente PC/OBS)

Lado **answerer** del WebRTC. Funciones:
- Recibe la oferta del iPhone y crea la respuesta
- Muestra el stream remoto en `<video>` a pantalla completa
- **Sin UI visible** — diseñado para ser "Browser Source" de OBS
- Fondo negro, sin controles
- Conexión WebSocket al servidor con `?role=viewer`

### control.html (panel de control remoto)

Panel de control para la PC. Funciones:
- Selector de cámara (lista las 4 traseras + frontal del iPhone 15 Pro Max)
- Selector de calidad (720p/1080p/4K @ 30/60fps)
- Selector de rotación (0°/90°/180°/270°)
- Toggle espejo (ON/OFF)
- Toggle modo retrato (ON/OFF)
- Indicadores de estado: phone conectado, viewer conectado
- Conexión WebSocket al servidor con `?role=control`

### generate-cert.js

Genera certificados autofirmados con OpenSSL:
- Detecta IPs LAN no-internas via `os.networkInterfaces()`
- Genera `openssl.cnf` temporal con Subject Alternative Names (SAN)
- Ejecuta `openssl req -x509 ...` vía `execSync`
- **Debe re-ejecutarse si cambia la IP de la PC**

### setup-cert.ps1

Instala `cert.pem` como certificado raíz confiable en Windows usando `certutil`. Esto resuelve el problema de pantalla negra en OBS Browser Source, que rechaza certificados autofirmados por defecto.

### launch-obs.bat

Lanza OBS Studio con flags especiales necesarios para que WebRTC funcione en Browser Source:
- `--disable-web-security`
- `--allow-running-insecure-content`
- `--ignore-certificate-errors`
- `--use-fake-ui-for-media-stream`

## Flujo de señalización WebRTC

1. Viewer se conecta al WebSocket y espera
2. Phone se conecta al WebSocket, obtiene cámara, crea `RTCPeerConnection`
3. Phone agrega tracks de video/audio a la conexión
4. Phone crea offer (`createOffer`) y la envía al servidor
5. Servidor reenvía la offer al viewer
6. Viewer crea `RTCPeerConnection`, setea la offer remota, crea answer
7. Viewer envía la answer al servidor
8. Servidor reenvía la answer al phone
9. Ambos intercambian candidatos ICE vía el servidor
10. Se establece la conexión P2P directa (WebRTC)
11. Video fluye del iPhone al viewer

## Flujo de control remoto

1. Control se conecta al WebSocket con `?role=control`
2. Server envía `status` (phone/viewer connected) y `request-cameras` al phone
3. Phone responde con lista de cámaras
4. Usuario cambia settings en control.html
5. Control envía `{ type: "control", action: "...", ... }` al server
6. Server reenvía al phone
7. Phone aplica el cambio y reconecta WebRTC si es necesario
8. Stream se actualiza en viewer/OBS en tiempo real

## Modo retrato (MediaPipe)

- Usa `@mediapipe/selfie_segmentation` desde CDN
- Modelo ~1MB, carga dinámica solo cuando se activa
- Procesa cada frame en canvas:
  1. Obtiene `segmentationMask` del modelo
  2. Dibuja máscara con `globalCompositeOperation: 'source-in'`
  3. Aplica blur de fondo con `ctx.filter = 'blur(20px)'`
- Rendimiento: ~30fps en iPhone 15 Pro, puede bajar en modelos anteriores
- Se aplica al stream enviado al viewer/OBS, no solo al preview local

## Certificados TLS

iOS Safari exige HTTPS para `getUserMedia` fuera de `localhost`. El proyecto genera certificados autofirmados que:
- Incluyen las IPs LAN como Subject Alternative Names (SAN)
- Se instalan manualmente en el iPhone (perfil de confianza)
- Se instalan en Windows via `certutil` para que OBS los acepte

**Gotcha conocido:** iOS es estricto con SAN. No basta el CN; el certificado debe tener el SAN correcto para la IP actual.

## Dependencias npm

- `express` — servidor HTTP/HTTPS, archivos estáticos
- `ws` — WebSocket server para señalización

No hay build step. No hay framework frontend. Todo es HTML/JS vanilla.

MediaPipe se carga dinámicamente desde CDN solo cuando el usuario activa el modo retrato.

## Limitaciones y TODOs

- **Un peer a la vez**: variables globales `phoneSocket`/`viewerSocket`/`controlSocket`, no hay salas
- **Sin reconexión automática**: si el iPhone se bloquea o pierde WiFi, hay que recargar
- **Audio no probado**: se pide `audio: true` en getUserMedia pero no se ha validado en OBS/Zoom
- **Batería/temperatura**: WebRTC + cámara 1080p + MediaPipe puede calentar el iPhone
- **Firewall**: Windows puede bloquear puertos 8443/8080; aceptar el prompt al arrancar `npm start`
- **MediaPipe CDN**: requiere internet la primera vez que se carga el modelo (se cachea después)

## Decisiones arquitectónicas

1. **WebRTC vs MJPEG**: WebRTC da baja latencia + audio sincronizado. MJPEG sería más simple pero sin audio y con más latencia.
2. **WebSocket vs Socket.IO**: Para solo 2-3 peers fijos, WebSocket puro es más liviano.
3. **OBS como webcam virtual**: Evita escribir driver DirectShow/Windows firmado. OBS ya lo hace gratis.
4. **Cert autofirmado vs Let's Encrypt**: No hay dominio público; es una red local. Let's Encrypt no aplica.
5. **phone.html como offerer**: El iPhone inicia la conexión porque tiene el stream listo primero.
6. **3 páginas separadas**: viewer.html sin UI para OBS, control.html para PC, phone.html simplificado.
7. **MediaPipe desde CDN**: Evita bundlear modelo de ML; se cachea en el navegador después de la primera carga.
8. **Canvas-based rotation/mirror**: Más compatible que `RTCRtpSender.replaceTrack` con constraints.
