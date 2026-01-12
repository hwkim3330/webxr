# WebXR Stream

Ultra low-latency WebRTC video streaming solution for real-time camera transmission over local networks.

## Features

- ⚡ **Sub-second Latency** - Direct P2P WebRTC connection
- 🎥 **High Quality** - Support for up to 4K@60fps streaming
- 🌐 **Local Network** - Optimized for internal network (사내망) deployment
- 📱 **Cross-Platform** - Works on desktop and mobile browsers
- 🔒 **Secure** - Encrypted WebRTC connections
- ⚙️ **Customizable** - Adjustable resolution, FPS, and bitrate

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Start Server

```bash
node server.js
```

The server will start on port 3000 and display available URLs:

```
=================================
WebXR Low-Latency Stream Server
=================================

송신자: http://localhost:3000/sender.html
수신자: http://localhost:3000/receiver.html

내부망 접속 주소:
  송신자: http://192.168.x.x:3000/sender.html
  수신자: http://192.168.x.x:3000/receiver.html
```

### 3. Usage

#### Sender (Camera Device)
1. Open `sender.html` on the device with camera
2. Click **"Start Camera"** and allow camera permissions
3. Select resolution and FPS settings
4. Click **"Go Live"** to start streaming

#### Receiver (Viewing Device)
1. Open `receiver.html` on the viewing device
2. Stream will connect automatically
3. Enjoy ultra-low latency video!

## Network Setup

### For Local Network (사내망)

When using on internal network with IP addresses (not localhost):

#### Option 1: Chrome Unsafe Flag (Development Only)

Create a batch file `start-chrome-unsafe.bat`:

```batch
@echo off
"C:\Program Files\Google\Chrome\Application\chrome.exe" --unsafely-treat-insecure-origin-as-secure="http://YOUR_IP:3000" --user-data-dir=%TEMP%\chrome-unsafe-test
```

Replace `YOUR_IP` with your server's IP address.

⚠️ **Warning**: This method is for development/testing only. For production, use HTTPS.

#### Option 2: HTTPS Setup (Recommended for Production)

1. Generate SSL certificate
2. Update server.js to use HTTPS
3. Access via `https://YOUR_IP:3000`

## Architecture

```
┌─────────────┐                  ┌─────────────┐
│   Sender    │                  │  Receiver   │
│  (Camera)   │                  │  (Viewer)   │
└──────┬──────┘                  └──────┬──────┘
       │                                │
       │  WebSocket (Signaling)         │
       ├────────────┬───────────────────┤
       │            │                   │
       │      ┌─────▼─────┐            │
       │      │  Server   │            │
       │      │ (Node.js) │            │
       │      └───────────┘            │
       │                                │
       │  WebRTC (Direct P2P Video)    │
       └────────────────────────────────┘
```

## Configuration

### Video Settings (sender.html)

- **Resolution**: 360p, 720p, 1080p, 1440p, 4K
- **Frame Rate**: 15fps, 30fps, 60fps
- **Bitrate**: Automatically optimized

### Advanced Settings (server.js)

```javascript
const PORT = process.env.PORT || 3000;  // Server port
```

## Troubleshooting

### Camera Permissions Not Working

**Problem**: Browser blocks camera access on non-HTTPS connections with IP addresses.

**Solutions**:
1. Use localhost (sender and receiver on same machine)
2. Use Chrome unsafe flag (development only)
3. Set up HTTPS with valid SSL certificate

### Connection Fails

1. Check firewall settings - port 3000 must be open
2. Ensure both devices are on same network
3. Check browser console (F12) for errors
4. Verify server is running and accessible

### High Latency

1. Check network connection quality
2. Reduce resolution or FPS in sender settings
3. Ensure devices are on same local network (avoid WiFi if possible)
4. Check CPU usage - encoding/decoding may be bottleneck

## Browser Support

| Browser | Sender | Receiver |
|---------|--------|----------|
| Chrome  | ✅     | ✅       |
| Edge    | ✅     | ✅       |
| Firefox | ✅     | ✅       |
| Safari  | ⚠️     | ⚠️       |

⚠️ Safari may have limited WebRTC support

## API Reference

### WebSocket Messages

#### Signaling Messages

```javascript
// Sender → Server → Receiver
{ type: 'offer', offer: RTCSessionDescription }
{ type: 'ice-candidate', candidate: RTCIceCandidate }

// Receiver → Server → Sender
{ type: 'answer', answer: RTCSessionDescription }
{ type: 'ice-candidate', candidate: RTCIceCandidate }

// Server → Clients
{ type: 'sender-ready' }
{ type: 'receiver-ready' }
{ type: 'sender-disconnected' }
```

## Performance Optimization

### For Best Performance

1. **Use Wired Connection** - Ethernet instead of WiFi
2. **Same Subnet** - Ensure devices are on same network segment
3. **Adjust Resolution** - Lower resolution = lower latency
4. **Modern Hardware** - Hardware encoding/decoding support

### Expected Latency

| Network | Latency |
|---------|---------|
| Same Device (localhost) | 50-100ms |
| Wired LAN (Gigabit) | 100-200ms |
| WiFi 5GHz | 150-300ms |
| WiFi 2.4GHz | 200-500ms |

## Development

### Project Structure

```
webxr-stream/
├── server.js           # WebSocket signaling server
├── sender.html         # Sender/broadcaster page
├── receiver.html       # Receiver/viewer page
├── index.html          # Landing page
├── package.json        # Dependencies
└── README.md          # This file
```

### Technology Stack

- **Backend**: Node.js + Express + WebSocket (ws)
- **Frontend**: Vanilla JavaScript + WebRTC API
- **Protocol**: WebRTC (SRTP/DTLS) + WebSocket (signaling)

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## Author

**hwkim3330**

- GitHub: [@hwkim3330](https://github.com/hwkim3330)
- Repository: [webxr-stream](https://github.com/hwkim3330/webxr)

## Acknowledgments

Built with WebRTC and WebSocket technologies for ultra-low latency real-time video streaming.
