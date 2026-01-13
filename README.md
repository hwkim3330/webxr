# 📡 WebXR Stream

Ultra low-latency WebRTC video streaming platform for real-time broadcasting over local networks.

## ✨ Features

- ⚡ **Sub-second Latency** - Direct P2P WebRTC connection (< 100ms)
- 👥 **1:N Broadcasting** - One sender, multiple receivers simultaneously
- 🎥 **High Quality** - Support for up to 8K@60fps streaming
- 📊 **Real-time Stats** - Live codec, FPS, bitrate, and latency monitoring
- 🌐 **Local Network** - Optimized for internal network (사내망) deployment
- ⚙️ **Customizable** - Adjustable resolution, FPS, and bitrate settings
- 🔒 **Secure** - Encrypted WebRTC connections

## 🚀 Quick Start

### Method 1: Easy Start (Recommended)

#### Windows
Double-click `start-server.bat`

#### Mac/Linux
```bash
./start-server.sh
```

The server will:
- Auto-install dependencies if needed
- Display available URLs
- Start the WebSocket server on port 3000

### Method 2: Manual Start

#### Installation
```bash
npm install
```

#### Start Server
```bash
# Simple start
npm start

# Development mode (auto-restart on changes)
npm run dev

# Production mode with PM2 (stable, auto-restart)
npm run pm2:start
npm run pm2:logs    # View logs
npm run pm2:stop    # Stop server
```

The server will display available URLs:

```
=================================
WebXR 1:N Broadcasting Server
=================================

송신자: http://localhost:3000/sender.html
수신자: http://localhost:3000/receiver.html

내부망 접속 주소:
  송신자: http://192.168.x.x:3000/sender.html
  수신자: http://192.168.x.x:3000/receiver.html
```

### Method 3: Desktop App (Electron)

**For easier deployment**, use the Electron sender app:

```bash
cd sender-app
npm install
npm start           # Run in development
npm run build:win   # Build Windows installer
npm run build:mac   # Build macOS app
npm run build:linux # Build Linux AppImage
```

**Benefits of Desktop App:**
- No browser camera permission issues
- Easier distribution
- Auto-updates support
- System tray integration
- Standalone executable

### Usage

#### Web-based Broadcaster (Sender)
1. Open `http://localhost:3000/sender.html`
2. Adjust settings (Resolution, FPS, Bitrate)
3. Click **"🎥 Start Broadcasting"**
4. Allow camera permissions
5. Stream starts automatically to all connected viewers

#### Desktop App Broadcaster
1. Download and install WebXR Stream Sender from [Releases](https://github.com/hwkim3330/webxr/releases)
2. Launch the app
3. Configure server address (default: ws://localhost:3000)
4. Start broadcasting

#### Viewer (Receiver)
1. Open `http://localhost:3000/receiver.html`
2. Video will auto-play when broadcaster starts
3. View real-time stats: codec, resolution, FPS, bitrate, latency

## 🏗️ Architecture

### System Overview

```
                            WebSocket Signaling
                    ┌──────────────────────────────┐
                    │                              │
                    ▼                              ▼
┌─────────────────────────┐              ┌──────────────────────┐
│      Sender             │              │   Receiver 0         │
│   (sender.html)         │              │ (receiver.html)      │
│                         │              │                      │
│  ┌──────────────────┐   │              │  ┌───────────────┐  │
│  │ Local Camera     │   │              │  │ Video Player  │  │
│  │ getUserMedia()   │   │              │  │ <video>       │  │
│  └──────────────────┘   │              │  └───────────────┘  │
│           │             │              │         ▲            │
│           ▼             │              │         │            │
│  ┌──────────────────┐   │              │  ┌───────────────┐  │
│  │ PeerConnection   │───┼──WebRTC P2P──┼─►│ PeerConn #0   │  │
│  │   Map[0]         │   │   (direct)   │  │               │  │
│  └──────────────────┘   │              │  └───────────────┘  │
│           │             │              └──────────────────────┘
│           ▼             │
│  ┌──────────────────┐   │              ┌──────────────────────┐
│  │ PeerConnection   │───┼──WebRTC P2P──┼─►│  Receiver 1       │
│  │   Map[1]         │   │   (direct)   │  │  PeerConn #1      │
│  └──────────────────┘   │              └──────────────────────┘
│           │             │
│           ▼             │              ┌──────────────────────┐
│  ┌──────────────────┐   │              │  Receiver N...       │
│  │ PeerConnection   │───┼──WebRTC P2P──┼─►│  PeerConn #N      │
│  │   Map[N]         │   │   (direct)   │  └──────────────────┘
│  └──────────────────┘   │
└─────────────────────────┘
            │
            ▼
   ┌────────────────┐
   │  WebSocket     │
   │  Signaling     │◄──────────────────── All receivers
   │  Server        │
   │  (server.js)   │
   │                │
   │ Map<receiverId,│
   │     ws>        │
   └────────────────┘
```

**Key Architecture Points:**
- **Sender maintains Map<receiverId, RTCPeerConnection>** - One dedicated P2P connection per receiver
- **Server assigns unique receiverId** to each receiver (0, 1, 2, 3...)
- **Signaling via WebSocket**, media streams via **WebRTC P2P** (not through server)
- **Camera-ready notification** triggers offer creation for all waiting receivers

### Components

#### 1. **Server (server.js)**
- **Role**: WebSocket signaling server
- **Technology**: Node.js, Express, WebSocket (ws)
- **Responsibilities**:
  - Manage sender and receiver connections
  - Route signaling messages (offer, answer, ICE candidates)
  - Track connected receivers with unique IDs
  - Handle camera-ready notifications
  - Coordinate 1:N broadcasting

**Key Logic:**
```javascript
// Data Structures
let sender = null;                        // WebSocket connection to sender
const receivers = new Map();              // Map<receiverId, {ws, receiverId}>
let receiverIdCounter = 0;               // Auto-increment ID

// Flow 1: Receiver connects
1. receiver connects → assign unique receiverId (0, 1, 2...)
2. store in receivers Map
3. send 'receiver-id' to receiver
4. if sender exists and camera ready → send 'request-offer' to sender for this receiverId

// Flow 2: Sender camera ready
1. sender sends 'camera-ready' message
2. server iterates through all receivers
3. send 'request-offer' to sender for EACH receiverId

// Flow 3: Signaling routing
offer:   sender → server → receivers.get(receiverId).ws
answer:  receiver → server → sender
ice:     bidirectional routing via receiverId
```

**Complete Message Flow:**
```
[Receiver connects]
Receiver → Server: WebSocket connect
Server → Receiver: {type: 'receiver-id', receiverId: 0}
Server → Sender: {type: 'request-offer', receiverId: 0}

[Sender creates offer]
Sender → Server: {type: 'offer', receiverId: 0, offer: {...}}
Server → Receiver 0: {type: 'offer', offer: {...}}

[Receiver creates answer]
Receiver 0 → Server: {type: 'answer', receiverId: 0, answer: {...}}
Server → Sender: {type: 'answer', receiverId: 0, answer: {...}}

[ICE candidate exchange]
Sender → Server: {type: 'ice-candidate', receiverId: 0, candidate: {...}}
Server → Receiver 0: {type: 'ice-candidate', candidate: {...}}
(bidirectional)
```

#### 2. **Sender (sender.html)**
- **Role**: Camera broadcaster
- **Technology**: WebRTC RTCPeerConnection API
- **Responsibilities**:
  - Capture camera/microphone using `getUserMedia()`
  - Maintain multiple `RTCPeerConnection` instances (one per receiver)
  - Create SDP offers for each receiver
  - Send video/audio tracks to all connected receivers
  - Monitor and display streaming statistics

**Key Data Structures:**
```javascript
const peerConnections = new Map(); // Map<receiverId, RTCPeerConnection>
```

**Broadcasting Flow:**
1. User clicks "Start Broadcasting"
2. Request camera access via `getUserMedia()`
3. Send `camera-ready` to server
4. Server responds with `request-offer` for each receiver
5. Create separate `RTCPeerConnection` for each `receiverId`
6. Add camera tracks to each peer connection
7. Create and send SDP offer for each receiver
8. Receive answer from each receiver
9. Exchange ICE candidates
10. P2P connection established → streaming starts

**Settings (Configured on Sender):**
- **Resolution**: 480p, 720p (default), 1080p, 1440p (QHD), 4K UHD, 8K UHD
- **Frame Rate**: 15, 24, 30 (default), 60 fps
- **Bitrate**: 1-50 Mbps (1 Mbps for 480p, up to 50 Mbps for 8K@60fps)

**Important Note:** These settings are applied at the sender's `getUserMedia()` and peer connection configuration. Receivers automatically receive the stream with these settings.

#### 3. **Receiver (receiver.html)**
- **Role**: Video viewer
- **Technology**: WebRTC RTCPeerConnection API
- **Responsibilities**:
  - Connect to server and receive unique ID
  - Wait for offer from sender
  - Create SDP answer
  - Receive video/audio streams via `ontrack` event
  - Display video and real-time statistics

**Receiving Flow:**
1. User opens receiver page
2. Connect to WebSocket server
3. Receive unique `receiverId`
4. Wait for sender to start broadcasting
5. Receive SDP offer from sender
6. Create `RTCPeerConnection`
7. Set remote description (offer)
8. Create and send SDP answer
9. Exchange ICE candidates
10. `ontrack` event fires → display video

**Statistics Displayed:**
- **Codec**: H.264 (AVC), VP8, VP9, AV1 (browser-supported codecs only, NO H.265/HEVC)
- **Resolution**: e.g., 1280x720, 3840x2160
- **FPS**: frames per second
- **Bitrate**: kbps (calculated from bytesReceived delta)
- **Latency**: round-trip time in ms (from RTCStatsReport)

## 🔧 Technical Details

### WebRTC Configuration

#### STUN/TURN Servers
```javascript
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
]
```

- **STUN**: Discovers public IP for NAT traversal
- **TURN**: Relay server for when P2P fails (fallback)

#### SDP Settings
```javascript
sdpSemantics: 'unified-plan'
bundlePolicy: 'max-bundle'
rtcpMuxPolicy: 'require'
iceCandidatePoolSize: 10
```

### Signaling Protocol

All messages are JSON over WebSocket:

#### Server → Sender
```json
{ "type": "request-offer", "receiverId": 0 }
```

#### Sender → Server → Receiver
```json
{
  "type": "offer",
  "receiverId": 0,
  "offer": { "type": "offer", "sdp": "..." }
}
```

#### Receiver → Server → Sender
```json
{
  "type": "answer",
  "receiverId": 0,
  "answer": { "type": "answer", "sdp": "..." }
}
```

#### ICE Candidate Exchange
```json
{
  "type": "ice-candidate",
  "receiverId": 0,
  "candidate": { ... }
}
```

### 1:N Broadcasting Implementation

**Key Design Decision:**
- **One PeerConnection per Receiver** (not SFU/MCU)
- Each receiver gets a dedicated P2P connection from sender
- Sender manages multiple simultaneous connections

**Trade-offs:**
- ✅ Lowest latency (direct P2P)
- ✅ No media server required
- ✅ Simple architecture
- ⚠️ Sender upload bandwidth scales with receiver count
- ⚠️ Recommended for < 10 simultaneous viewers

**Why this architecture?**
For local network (사내망) deployment with limited viewers, P2P provides the best latency. For larger scale, consider SFU (Selective Forwarding Unit) like Mediasoup or Janus.

## 📁 Project Structure

```
webxr-stream/
├── server.js              # WebSocket signaling server
├── sender.html            # Web-based broadcaster interface
├── receiver.html          # Viewer interface
├── index.html             # Landing page
├── package.json           # Server dependencies
├── ecosystem.config.js    # PM2 configuration for production
├── start-server.bat       # Windows server launcher
├── start-server.sh        # Mac/Linux server launcher
├── .gitignore            # Git ignore rules
├── README.md             # This file (documentation)
│
├── sender-app/           # 📱 Electron Desktop App (Sender)
│   ├── main.js           # Electron main process
│   ├── preload.js        # Preload script (context bridge)
│   ├── renderer.html     # App UI (based on sender.html)
│   ├── package.json      # Electron app dependencies
│   └── assets/           # App icons and resources
│       ├── icon.ico      # Windows icon
│       ├── icon.icns     # macOS icon
│       └── icon.png      # Linux icon
│
└── logs/                 # Server logs (auto-created by PM2)
    ├── out.log           # stdout logs
    ├── err.log           # stderr logs
    └── combined.log      # combined logs
```

**Key Files:**

- **server.js**: Core WebSocket signaling server
- **sender.html**: Web browser-based broadcaster (requires HTTPS for camera on IP addresses)
- **receiver.html**: Lightweight viewer page
- **sender-app/**: Electron desktop app for easier sender deployment (no HTTPS issues)
- **start-server.bat/.sh**: One-click server startup scripts
- **ecosystem.config.js**: Production deployment config for PM2 process manager

## 🌐 Network Setup

### Local Network (사내망) Usage

#### Option 1: Same WiFi Network
- Connect all devices to same WiFi
- Use IP address shown by server (e.g., `192.168.x.x:3000`)

#### Option 2: Switch/Router
- Connect devices via Ethernet to same switch
- Use local IP (e.g., `172.31.51.96:3000`)

### Camera Permissions on IP Addresses

Chrome blocks camera access on non-HTTPS IP addresses. Solutions:

#### Development: Chrome Unsafe Flag
```batch
# Windows (start-chrome-unsafe.bat)
chrome.exe --unsafely-treat-insecure-origin-as-secure="http://172.31.51.96:3000" --user-data-dir=%TEMP%\chrome-unsafe

# Mac/Linux
google-chrome --unsafely-treat-insecure-origin-as-secure="http://192.168.x.x:3000" --user-data-dir=/tmp/chrome-unsafe
```

#### Production: HTTPS with Self-Signed Certificate
```bash
# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout key.pem -out cert.pem

# Update server.js to use HTTPS
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

const server = https.createServer(options, app);
```

## 🐛 Troubleshooting

### Video not showing on receiver

**Symptoms:**
- Receiver shows "Connected" but black screen
- Console shows `[CONNECTION] connected` but no video

**Solutions:**
1. Check sender clicked "Start Broadcasting"
2. Check camera permissions granted
3. Check sender's local video preview is showing
4. Hard refresh both pages (Ctrl+Shift+R)
5. Check firewall not blocking UDP ports

### High latency or packet loss

**Check:**
- Network quality (WiFi signal strength)
- Bitrate settings (lower if network is slow)
- Number of simultaneous viewers
- Sender's upload bandwidth

### Connection stuck at "checking"

**Cause:** ICE connection failing

**Solutions:**
1. TURN server may be overloaded - try again
2. Firewall blocking UDP - check network settings
3. NAT traversal failing - use same local network

## 📊 Performance Tips

### Optimal Settings by Use Case

| Use Case | Resolution | FPS | Bitrate | Viewers | Sender Upload |
|----------|-----------|-----|---------|---------|---------------|
| **Low Bandwidth** | 480p | 15 | 1 Mbps | 1-3 | 3 Mbps |
| **Balanced** (Default) | 720p | 30 | 2.5 Mbps | 1-5 | 12.5 Mbps |
| **High Quality** | 1080p | 30 | 5 Mbps | 1-3 | 15 Mbps |
| **Smooth Motion** | 720p | 60 | 4 Mbps | 1-2 | 8 Mbps |
| **4K Streaming** | 4K UHD | 30 | 15 Mbps | 1-2 | 30 Mbps |
| **4K High FPS** | 4K UHD | 60 | 20 Mbps | 1 | 20 Mbps |
| **8K Streaming** | 8K UHD | 30 | 35 Mbps | 1 | 35 Mbps |
| **8K High FPS** | 8K UHD | 60 | 50 Mbps | 1 | 50 Mbps |

### Bandwidth Calculation

**Sender Upload Required:**
```
Upload = Bitrate × Number of Receivers
Example: 2.5 Mbps × 5 viewers = 12.5 Mbps upload needed
```

**Receiver Download Required:**
```
Download = Bitrate
Example: 2.5 Mbps stream = 2.5 Mbps download needed
```

## 🌐 360° Video Support & LTE Broadcasting

### Current Architecture Feasibility

**Can the current structure support 360° video over LTE?**

**YES**, with important considerations:

#### 1. 360° Video Support - **Already Compatible**

The current WebRTC P2P architecture **fully supports 360° video** with minimal changes:

**Why it works:**
- 360° video is just a standard 2D video stream with equirectangular projection
- The sender captures 360° camera (equirectangular format) via `getUserMedia()`
- WebRTC streams it exactly like any other video (H.264/VP8/VP9 codec)
- **Only the receiver needs modification** - replace `<video>` with 360° player

**Required Changes:**

```javascript
// SENDER SIDE - NO CHANGES NEEDED
// 360° camera outputs standard video stream, WebRTC handles it normally

// RECEIVER SIDE - Add 360° player
// Option 1: Three.js
import * as THREE from 'three';

const video = document.querySelector('video');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Create sphere with video texture
const geometry = new THREE.SphereGeometry(500, 60, 40);
geometry.scale(-1, 1, 1); // Invert sphere to view from inside
const texture = new THREE.VideoTexture(video);
const material = new THREE.MeshBasicMaterial({ map: texture });
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// Add VR controls (OrbitControls or DeviceOrientationControls)

// Option 2: A-Frame (simpler)
<a-scene>
  <a-videosphere src="#video-stream" rotation="0 -90 0"></a-videosphere>
  <a-camera></a-camera>
</a-scene>
```

**Summary:**
- ✅ Current architecture supports 360° video transmission
- ✅ No server or sender changes required
- ✅ Only receiver needs 360° player (Three.js/A-Frame)

#### 2. LTE Broadcasting - **Feasible with Bandwidth Considerations**

**Can a sender broadcast 360° video over LTE?**

**YES**, but LTE upload bandwidth is the critical constraint.

**LTE Upload Speeds:**
| LTE Type | Typical Upload | Max Upload | Realistic for Streaming |
|----------|---------------|------------|------------------------|
| **LTE Cat 4** | 10-30 Mbps | 50 Mbps | 720p @ 2.5 Mbps × 2-4 viewers |
| **LTE Cat 6** | 20-40 Mbps | 50 Mbps | 1080p @ 5 Mbps × 2-4 viewers |
| **LTE-A (Advanced)** | 30-60 Mbps | 150 Mbps | 4K @ 15 Mbps × 2-3 viewers |
| **5G Sub-6** | 50-150 Mbps | 300 Mbps | 4K @ 15 Mbps × 5-10 viewers |
| **5G mmWave** | 200-500 Mbps | 1+ Gbps | 8K @ 50 Mbps × 5+ viewers |

**Bandwidth Formula:**
```
Required Upload = Bitrate × Number of Simultaneous Receivers

Example 1: 360° video at 1080p 30fps, 5 Mbps bitrate
- 1 viewer:  5 Mbps  ✅ Works on LTE Cat 4+
- 3 viewers: 15 Mbps ✅ Works on LTE Cat 4+
- 5 viewers: 25 Mbps ✅ Works on LTE Cat 6+
- 10 viewers: 50 Mbps ❌ Requires LTE-A or 5G

Example 2: 360° video at 4K 30fps, 15 Mbps bitrate
- 1 viewer:  15 Mbps ✅ Works on LTE Cat 6+
- 2 viewers: 30 Mbps ✅ Works on LTE-A or 5G
- 3 viewers: 45 Mbps ⚠️ Requires stable LTE-A or 5G
```

**Recommended Settings for LTE Sender:**

| Scenario | Resolution | FPS | Bitrate | Max Viewers | Min LTE Required |
|----------|-----------|-----|---------|-------------|------------------|
| **Conservative** | 720p | 30 | 2 Mbps | 5 | LTE Cat 4 (10 Mbps) |
| **Balanced** | 1080p | 30 | 4 Mbps | 3 | LTE Cat 6 (20 Mbps) |
| **High Quality** | 1080p | 30 | 5 Mbps | 4 | LTE-A (30 Mbps) |
| **4K Limited** | 4K | 30 | 12 Mbps | 2 | LTE-A (30 Mbps) |
| **4K Extended** | 4K | 30 | 15 Mbps | 3 | 5G (50+ Mbps) |

#### 3. Architectural Limitations for LTE

**Current P2P Architecture Issues:**

⚠️ **Problem 1: Upload Bandwidth Multiplication**
```
With current P2P:
Sender upload = Bitrate × Receiver count

Example: 5 Mbps stream × 10 viewers = 50 Mbps upload needed
```

This is **NOT scalable** for many viewers over LTE.

⚠️ **Problem 2: Unstable LTE Connection**
- LTE upload speed fluctuates (moving vehicle, cell tower handoffs)
- P2P connections may drop and require renegotiation
- No automatic bitrate adaptation per receiver

**Solution: SFU (Selective Forwarding Unit) Architecture**

For LTE broadcasting to **10+ viewers**, migrate to SFU:

```
Current (P2P):                    Recommended (SFU):

Sender ──┬─► Receiver 1          Sender ───► SFU Server ──┬─► Receiver 1
         ├─► Receiver 2                                    ├─► Receiver 2
         ├─► Receiver 3                                    ├─► Receiver 3
         └─► Receiver N                                    └─► Receiver N

Upload = N × Bitrate              Upload = 1 × Bitrate
```

**SFU Benefits:**
- ✅ Sender only uploads **once** to SFU (constant bandwidth regardless of viewers)
- ✅ SFU handles distribution to N receivers
- ✅ Adaptive bitrate per receiver (simulcast)
- ✅ Better handling of unstable LTE connections
- ⚠️ Requires media server (Mediasoup, Janus, LiveKit)
- ⚠️ Adds latency (~100-300ms more than P2P)

#### 4. Implementation Roadmap

**Phase 1: 360° Video Support (Current Architecture)** ✅ Feasible Now
- Modify [receiver.html](receiver.html) to use Three.js or A-Frame
- Add 360° video player with gyroscope/mouse controls
- Test with 360° camera (Ricoh Theta, Insta360, etc.)
- No server or sender changes needed

**Phase 2: LTE Broadcasting (P2P, 1-5 viewers)** ✅ Feasible Now
- Current architecture works for small viewer counts
- Test with LTE/5G mobile hotspot
- Add bandwidth monitoring and warnings
- Implement fallback quality settings

**Phase 3: Scalable LTE Broadcasting (SFU, 10+ viewers)** 🔄 Requires Refactor
- Migrate to SFU architecture (Mediasoup recommended)
- Sender uploads single stream to SFU
- SFU handles distribution and adaptive bitrate
- Implement simulcast (multiple quality tiers)

**Phase 4: Advanced Features** 🔮 Future
- Adaptive bitrate based on network conditions
- Automatic quality switching for LTE fluctuations
- Recording 360° streams server-side
- Multi-camera 360° streaming
- Spatial audio for 360° video

### Recommended Stack for 360° + LTE

```javascript
// Sender (no changes)
Current sender.html + 360° camera

// Receiver (add 360° player)
receiver.html + Three.js or A-Frame

// For > 5 viewers, use SFU:
Mediasoup (recommended) or Janus Gateway
+ Load balancing for 100+ viewers
```

### Code Example: Adding 360° to Current System

**Step 1: Modify receiver.html**
```html
<!-- Add Three.js -->
<script src="https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.150.0/examples/js/controls/OrbitControls.js"></script>

<!-- Replace video display with canvas -->
<canvas id="threejs-canvas"></canvas>

<script>
// Create scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('threejs-canvas') });

// Create sphere for 360° video
const geometry = new THREE.SphereGeometry(500, 60, 40);
geometry.scale(-1, 1, 1);

// When video track received
peerConnection.ontrack = (event) => {
  const video = document.createElement('video');
  video.srcObject = new MediaStream([event.track]);
  video.play();

  const texture = new THREE.VideoTexture(video);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
};

// Add controls (mouse drag to look around)
const controls = new THREE.OrbitControls(camera, renderer.domElement);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
</script>
```

**Step 2: Test with 360° camera**
- Use 360° camera that outputs equirectangular video
- Or use OBS with 360° video file as virtual camera
- No sender.html changes needed

### LTE Testing Checklist

- [ ] Test with LTE/5G mobile hotspot
- [ ] Measure actual upload speed: `speedtest.net`
- [ ] Monitor connection quality in sender stats
- [ ] Test with 1, 2, 3, 5 viewers simultaneously
- [ ] Test moving sender (vehicle, walking) for handoff behavior
- [ ] Implement bandwidth warnings when upload < required
- [ ] Test fallback to lower bitrate on poor connection

## 🔮 Future Enhancements

### Short-term (Compatible with Current Architecture)
- [x] 8K resolution support (✅ implemented)
- [ ] 360° video player (Three.js / A-Frame) - receiver-side only
- [ ] Screen sharing option
- [ ] Recording functionality
- [ ] Chat overlay
- [ ] Bandwidth monitoring and adaptive quality warnings

### Long-term (Requires Architecture Changes)
- [ ] SFU architecture for scalability (>10 viewers over LTE)
- [ ] Adaptive bitrate streaming (simulcast)
- [ ] Automatic quality switching based on network conditions
- [ ] Mobile app (React Native) with native 360° support
- [ ] Multi-camera synchronized 360° streaming
- [ ] Spatial audio for immersive 360° experience
- [ ] Server-side 360° stream recording

## 📝 FAQ

### Q: Who controls the video quality?
**A:** The **sender** controls all quality settings (resolution, FPS, bitrate). These are configured before starting the broadcast. Receivers automatically receive the stream at whatever quality the sender configured.

### Q: Can receivers adjust quality?
**A:** Not currently. All receivers receive the same stream quality set by the sender. For adaptive quality per viewer, you would need to implement simulcast (sending multiple quality versions) or an SFU architecture.

### Q: How many viewers can watch simultaneously?
**A:** Theoretically unlimited, but practically limited by sender's upload bandwidth. For local network use, 5-10 viewers work well. Beyond that, consider SFU architecture.

### Q: Does this work over the internet?
**A:** Yes, but requires:
1. Port forwarding on router (port 3000)
2. HTTPS with valid certificate (for camera permissions)
3. Sufficient upload bandwidth on sender
4. TURN server for NAT traversal

For internet use, consider hosted solutions (AWS, Azure) with proper media servers.

### Q: What's the latency?
**A:** Typically 50-200ms on local network. Factors:
- Network quality: 20-50ms
- Encoding: 10-30ms
- WebRTC negotiation: 20-100ms
- Decoding + display: 10-20ms

### Q: Which browsers are supported?
**A:** Modern browsers with WebRTC support:
- ✅ Chrome 74+
- ✅ Edge 79+
- ✅ Firefox 68+
- ✅ Safari 12.1+
- ✅ Mobile Chrome/Safari (iOS 14.3+, Android 5+)

## 📄 License

MIT License - Feel free to use for commercial and personal projects.

## 🙏 Credits

Built with:
- [WebRTC](https://webrtc.org/) - Real-time communication
- [ws](https://github.com/websockets/ws) - WebSocket library
- [Express](https://expressjs.com/) - Web framework
- [OpenRelay](https://www.metered.ca/tools/openrelay/) - Free TURN servers

---

**Developed for low-latency video streaming in local network environments.**

For questions or issues, please open an issue on [GitHub](https://github.com/hwkim3330/webxr).
