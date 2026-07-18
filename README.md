# Camoi

Turn your iPhone into a professional webcam for your PC. No apps, no internet, no subscriptions. Just your iPhone, your PC, and WiFi.

[MIT License](LICENSE) • [Report Bug](https://github.com/Atypical-Playworks/camoi/issues) • [Request Feature](https://github.com/Atypical-Playworks/camoi/issues)

## 💡 Why This Exists

Camo costs $80/year. DroidCam needs signed drivers. Both depend on third-party apps that can shut down or change pricing anytime.

So I built Camoi — a tool that:

- Uses your iPhone's camera as a webcam via WebRTC (peer-to-peer, no cloud)
- Controls everything remotely from your PC (camera, quality, rotation, mirror, background blur)
- Integrates with OBS Studio as a virtual camera — Zoom, Teams, Discord all recognize it
- Runs 100% on your local network. Nothing leaves your WiFi.

**Stop paying for what should be free.**

## 🎯 What You Can Do

### 1️⃣ Remote Camera Control

Control your iPhone camera from your PC without touching the phone. Switch between all 5 cameras (4 rear + front), change quality, rotate, mirror — all from a web panel.

Features:
- 📷 **5 cameras** — Main, Ultra Wide, Telephoto, Frontal (iPhone 15 Pro Max)
- 🎬 **Quality selector** — 720p, 1080p, 4K @ 30/60fps
- 🔄 **Rotation** — 0°, 90°, 180°, 270°
- 🪞 **Mirror mode** — ON/OFF

### 2️⃣ OBS Studio Integration

No signed drivers needed. OBS already has virtual camera support built-in — Camoi just feeds it the video.

```
iPhone → WebRTC → viewer.html → OBS Browser Source → Virtual Camera → Zoom/Teams/Discord
```

### 3️⃣ Zero Internet Dependency

Everything runs on your local network. No cloud, no accounts, no data collection. Your video stays between your iPhone and your PC.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18+) — [nodejs.org](https://nodejs.org)
- **OBS Studio** (free) — [obsproject.com](https://obsproject.com)
- **Tailscale** (free) — [tailscale.com](https://tailscale.com) — Required because Safari blocks direct local network connections
- iPhone and PC on the **same WiFi network**

### Installation

```bash
# Clone the repo
git clone https://github.com/Atypical-Playworks/camoi.git
cd camoi

# Install dependencies
npm install

# Generate security certificates (for HTTPS on iPhone)
npm run gen-cert

# Install certificate in Windows (fixes OBS black screen)
npm run setup-cert
```

### Setup

```bash
# Start the server
npm start
```

Then follow the 3 steps shown in the terminal:

1. **Install certificate on iPhone** (one-time)
   - Open Safari on iPhone → go to `http://YOUR-TAILSCALE-IP:8080/cert`
   - Install the profile and trust it in Settings

2. **Open phone.html on iPhone**
   - Safari → `https://YOUR-TAILSCALE-IP:8443/phone.html`
   - Tap "Start Camera"

3. **Open control.html on PC**
   - Chrome/Edge → `http://localhost:8080/control.html`
   - Control camera, quality, rotation, mirror, background blur

### Using Tailscale (Required)

Tailscale is required because Safari blocks direct local network connections for security reasons. Tailscale creates a secure tunnel that bypasses this restriction.

1. Install Tailscale on both iPhone and PC
2. Log in to the same account on both devices
3. The server automatically detects your Tailscale IP (`100.x.x.x`)
4. Use the Tailscale IP shown in the terminal:
   ```
   https://100.x.x.x:8443/phone.html
   ```
5. Make sure Tailscale is running on both devices when using Camoi

### OBS Studio Setup

```bash
# Launch OBS with required flags (Windows)
launch-obs.bat
```

Or manually:
```
obs64.exe --disable-web-security --allow-running-insecure-content --ignore-certificate-errors --use-fake-ui-for-media-stream
```

Then in OBS:
1. **Sources → + → Browser Source**
2. URL: `http://localhost:8080/viewer.html`
3. Width: `1920`, Height: `1080`
4. Uncheck "Shutdown source when not visible"
5. Click **Start Virtual Camera**
6. In Zoom/Teams/Discord → select **OBS Virtual Camera**

## 📸 Screenshots

> Screenshots coming soon. The control panel features:
> - Camera selector dropdown
> - Quality selector (720p/1080p/4K @ 30/60fps)
> - Rotation selector (0°/90°/180°/270°)
> - Mirror toggle (ON/OFF)
> - Mirror toggle (ON/OFF)
> - Connection status indicators

## 🛠️ Tech Stack

Built for speed and simplicity:

- **Node.js + Express** — Server, no build step
- **WebSocket (`ws`)** — Signaling, lighter than Socket.IO
- **WebRTC** — P2P video, low latency, adaptive bitrate
- **HTML/JS Vanilla** — No frameworks, no bundlers
- **OBS Studio** — Virtual camera (avoids signed driver requirement)
- **Self-signed TLS certificates** — Required by iOS Safari

## 📁 Project Structure

```
camoi/
├── server.js              # Express + WebSocket (signaling + control)
├── public/
│   ├── phone.html         # iPhone client (WebRTC offerer + segmentation blur)
│   ├── viewer.html        # PC/OBS client (WebRTC answerer, video-only)
│   └── control.html       # Remote control panel for PC
├── generate-cert.js       # Generate self-signed certificates
├── setup-cert.ps1         # Install cert as trusted root in Windows
├── launch-obs.bat         # Launch OBS with required flags
└── package.json           # Dependencies: express, ws
```

## 🔄 How It Works

```
┌─────────────┐      WebRTC (P2P)       ┌──────────────┐
│   iPhone     │ ◀─────────────────────▶│  PC (local)  │
│  phone.html  │      (signaling)       │  viewer.html │
└─────────────┘                         └──────┬───────┘
                                                │
                                           OBS Studio
                                       (Browser Source →
                                        Virtual Camera)
                                                │
                                       Zoom / Teams / Discord
```

### Control Flow
```
PC (control.html) → server.js → iPhone (phone.html) → updated stream
       │                              │
       │◄─────── camera list ─────────│
       │◄─────── status updates ──────│
```

### Control Messages
```json
{ "type": "control", "action": "switch-camera", "deviceId": "..." }
{ "type": "control", "action": "change-quality", "quality": "1920x1080@60" }
{ "type": "control", "action": "rotate", "rotation": 90 }
{ "type": "control", "action": "mirror", "enabled": true }
{ "type": "control", "action": "blur", "amount": 10 }
```

## 🎭 Background Blur

Camoi uses MediaPipe Selfie Segmentation to separate the main subject from the background. It prioritizes smooth real-time performance over strict person-only classification.

- Blur levels: 5px, 10px, and 20px
- Segmentation input is reduced to 256x144 and processed every 100ms to balance quality and performance
- The mask updates at approximately 30 FPS on compatible devices
- The model loads from CDN the first time blur is enabled
- Processing stays on the iPhone; video is not uploaded to a cloud service

## ⚠️ Known Limitations

- **One iPhone at a time** — Server supports one phone and one viewer simultaneously
- **No auto-reconnection** — If connection drops, reload phone.html
- **Battery** — WebRTC + 1080p camera can heat up iPhone in long sessions
- **Background blur** — Uses additional CPU/GPU and may reduce FPS on older iPhones
- **Certificate** — If you change WiFi network, re-run `npm run gen-cert`

## 🐛 Troubleshooting

### OBS shows black screen
- Launch OBS with the flags from `launch-obs.bat`
- Disable hardware acceleration: Settings → Advanced → uncheck "Enable browser source hardware acceleration"
- Restart PC after installing certificate

### iPhone won't connect
- Verify Tailscale is running on both iPhone and PC
- Verify you're using the Tailscale IP (starts with `100.x.x.x`)
- Verify certificate is installed and trusted on iPhone
- Try opening `https://YOUR-PC-IP:8443/phone.html` directly in Safari

### Camera disconnects
Safari on iOS pauses `getUserMedia` when screen locks or app goes to background. Solution: tap "Start Camera" again on phone.html.

### No audio in OBS
OBS may not capture audio from Browser Source automatically. Set up a separate audio source in OBS if you need audio.

## 🤝 Contributing

Found a bug? Have an idea? Contributions welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-idea`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-idea`)
5. Open a Pull Request

## 📄 License

MIT License — Free and open source. See [LICENSE](LICENSE) for details.

## 🙏 Credits

Built for those who need it. By someone who did.

I was tired of paying for Camo and dealing with DroidCam's signed drivers. WebRTC exists. OBS has virtual camera support. The pieces were all there — they just needed to be connected. So I built Camoi.

If you're a streamer, content creator, or just someone who wants a better webcam setup without spending money — this is for you.

A project by [Atypical-Playworks](https://github.com/Atypical-Playworks)
Developed by [Milumon](https://github.com/Milumon)
