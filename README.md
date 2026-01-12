# 📡 WebXR Stream

Ultra low-latency WebRTC video streaming platform for real-time broadcasting over local networks.

## ✨ Features

- ⚡ **Sub-second Latency** - Direct P2P WebRTC connection (< 100ms)
- 👥 **1:N Broadcasting** - One sender, multiple receivers simultaneously
- 🎥 **High Quality** - Support for up to 4K@60fps streaming
- 📊 **Real-time Stats** - Live codec, FPS, bitrate, and latency monitoring
- 🌐 **Local Network** - Optimized for internal network (사내망) deployment
- ⚙️ **Customizable** - Adjustable resolution, FPS, and bitrate settings
- 🔒 **Secure** - Encrypted WebRTC connections

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Start Server

```bash
node server.js
```

The server will display available URLs:

```
=================================
WebXR 1:N Broadcasting Server
=================================

송신자: http://localhost:3000/sender.html
수신자: http://localhost:3000/receiver.html

내부망 접속 주소:
  송신자: http://172.31.51.96:3000/sender.html
  수신자: http://172.31.51.96:3000/receiver.html
```

### Usage

#### Broadcaster (Sender)
1. Open `http://localhost:3000/sender.html`
2. Adjust settings (Resolution, FPS, Bitrate)
3. Click **"🎥 Start Broadcasting"**
4. Allow camera permissions
5. Stream starts automatically to all connected viewers

#### Viewer (Receiver)
1. Open `http://localhost:3000/receiver.html`
2. Video will auto-play when broadcaster starts
3. View real-time stats: codec, resolution, FPS, bitrate, latency

## 🏗️ Architecture

### System Overview

```
┌─────────────┐                 ┌─────────────┐                 ┌─────────────┐
│   Sender    │◄───WebSocket───►│   Server    │◄───WebSocket───►│  Receiver   │
│  (Browser)  │                 │  (Node.js)  │                 │  (Browser)  │
└─────────────┘                 └─────────────┘                 └─────────────┘
       │                               │                               │
       │          WebRTC P2P           │                               │
       └───────────────────────────────────────────────────────────────┘
```

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
// Receiver connects → Server assigns ID → Requests offer from sender
receiver connects → assign receiverId → send 'request-offer' to sender

// Sender camera ready → Server requests offers for all receivers
sender 'camera-ready' → send 'request-offer' for each receiverId

// Signaling flow
sender creates offer → server routes to receiver[receiverId]
receiver creates answer → server routes to sender
ICE candidates exchanged through server
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
- **Resolution**: 480p, 720p (default), 1080p, 4K
- **Frame Rate**: 15, 24, 30 (default), 60 fps
- **Bitrate**: 1-5 Mbps

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
- Codec (H264, VP8, VP9)
- Resolution (e.g., 1280x720)
- FPS (frames per second)
- Bitrate (kbps)
- Latency (round-trip time in ms)

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
├── server.js           # WebSocket signaling server
├── sender.html         # Broadcaster interface
├── receiver.html       # Viewer interface
├── index.html          # Landing page
├── package.json        # Dependencies
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

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

| Use Case | Resolution | FPS | Bitrate | Viewers |
|----------|-----------|-----|---------|---------|
| **Low Bandwidth** | 480p | 15 | 1 Mbps | 1-3 |
| **Balanced** (Default) | 720p | 30 | 2.5 Mbps | 1-5 |
| **High Quality** | 1080p | 30 | 3-4 Mbps | 1-3 |
| **Smooth Motion** | 720p | 60 | 4-5 Mbps | 1-2 |

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

## 🔮 Future Enhancements

- [ ] 360° video support (Three.js / A-Frame)
- [ ] Screen sharing option
- [ ] Recording functionality
- [ ] Chat overlay
- [ ] SFU architecture for scalability (>10 viewers)
- [ ] Adaptive bitrate streaming
- [ ] Mobile app (React Native)

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
