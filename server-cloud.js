// 클라우드용 시그널링 서버 (Glitch, Heroku, Railway 등에서 사용)
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORS 활성화 (외부에서 접속 가능하도록)
app.use(cors());

// 정적 파일 제공 (선택사항 - 클라우드에 HTML도 같이 올릴 경우)
app.use(express.static('public'));

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>WebXR Stream Server</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>🚀 WebXR Low-Latency Stream Server</h1>
        <p>시그널링 서버가 정상 작동 중입니다.</p>
        <p>연결된 송신자: <strong id="senders">0</strong></p>
        <p>연결된 수신자: <strong id="receivers">0</strong></p>
        <hr>
        <h3>사용 방법</h3>
        <p>1. 송신자 HTML에서 WebSocket 주소를 이 서버로 변경</p>
        <p>2. 수신자 HTML에서도 동일하게 변경</p>
        <code>ws://${req.headers.host}?role=sender</code> 또는 <code>role=receiver</code>
        <script>
          setInterval(() => {
            fetch('/stats').then(r => r.json()).then(data => {
              document.getElementById('senders').textContent = data.senders;
              document.getElementById('receivers').textContent = data.receivers;
            });
          }, 2000);
        </script>
      </body>
    </html>
  `);
});

// 통계 API
app.get('/stats', (req, res) => {
  res.json({
    senders: sender ? 1 : 0,
    receivers: receivers.size,
    uptime: process.uptime()
  });
});

// 연결된 클라이언트 관리
let sender = null;
const receivers = new Set();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');

  console.log(`[${new Date().toISOString()}] ${role} connected from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);

  if (role === 'sender') {
    // 기존 송신자 끊기
    if (sender) {
      sender.close();
    }
    sender = ws;

    // 모든 수신자에게 송신자 준비 알림
    receivers.forEach(receiver => {
      if (receiver.readyState === WebSocket.OPEN) {
        receiver.send(JSON.stringify({ type: 'sender-ready' }));
      }
    });
  } else {
    receivers.add(ws);

    // 송신자가 이미 있으면 알림
    if (sender && sender.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'sender-ready' }));
    }
  }

  ws.on('message', (message) => {
    try {
      // Binary 데이터 처리 (필요시)
      if (message instanceof Buffer) {
        message = message.toString();
      }

      const data = JSON.parse(message);

      // 송신자 → 수신자로 시그널 전달
      if (role === 'sender') {
        receivers.forEach(receiver => {
          if (receiver.readyState === WebSocket.OPEN) {
            receiver.send(JSON.stringify(data));
          }
        });
      }
      // 수신자 → 송신자로 시그널 전달
      else {
        if (sender && sender.readyState === WebSocket.OPEN) {
          sender.send(JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Message parse error:', error);
    }
  });

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] ${role} disconnected`);

    if (role === 'sender') {
      sender = null;
      // 모든 수신자에게 송신자 종료 알림
      receivers.forEach(receiver => {
        if (receiver.readyState === WebSocket.OPEN) {
          receiver.send(JSON.stringify({ type: 'sender-disconnected' }));
        }
      });
    } else {
      receivers.delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error (${role}):`, error.message);
  });
});

// Keep-alive (무료 호스팅 sleep 방지)
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 30000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=================================');
  console.log('WebXR Cloud Signaling Server');
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log('=================================\n');
});
