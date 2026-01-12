// 초경량 WebSocket 시그널링 서버 (내부망 최적화)
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 정적 파일 제공
app.use(express.static('.'));

// 연결된 클라이언트 관리
let sender = null;
const receivers = new Set();
let lastOffer = null; // 마지막 offer 캐시

wss.on('connection', (ws, req) => {
  const role = new URL(req.url, 'http://localhost').searchParams.get('role');

  console.log(`[${new Date().toISOString()}] ${role} connected`);

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

    // 송신자에게 현재 연결된 수신자 수 알림
    if (receivers.size > 0) {
      ws.send(JSON.stringify({ type: 'receiver-ready' }));
    }
  } else {
    receivers.add(ws);

    // 송신자가 이미 있으면 알림
    if (sender && sender.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'sender-ready' }));

      // 캐시된 offer가 있으면 즉시 전송
      if (lastOffer) {
        console.log('  → 캐시된 offer 전송');
        ws.send(lastOffer);
      }

      // 송신자에게도 새 수신자 알림
      sender.send(JSON.stringify({ type: 'receiver-ready' }));
    }
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[${role}] 메시지: ${data.type}`);

      // 송신자 → 수신자로 시그널 전달
      if (role === 'sender') {
        // offer 메시지면 캐시에 저장
        if (data.type === 'offer') {
          lastOffer = message;
        }

        console.log(`  → ${receivers.size}명의 수신자에게 전달`);
        receivers.forEach(receiver => {
          if (receiver.readyState === WebSocket.OPEN) {
            receiver.send(message);
          }
        });
      }
      // 수신자 → 송신자로 시그널 전달
      else {
        if (sender && sender.readyState === WebSocket.OPEN) {
          console.log(`  → 송신자에게 전달`);
          sender.send(message);
        } else {
          console.log(`  ❌ 송신자가 없거나 연결 끊김`);
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
    console.error(`WebSocket error:`, error);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  // 로컬 IP 주소 출력
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  console.log('\n=================================');
  console.log('WebXR Low-Latency Stream Server');
  console.log('=================================\n');
  console.log(`송신자: http://localhost:${PORT}/sender.html`);
  console.log(`수신자: http://localhost:${PORT}/receiver.html\n`);

  if (addresses.length > 0) {
    console.log('내부망 접속 주소:');
    addresses.forEach(addr => {
      console.log(`  송신자: http://${addr}:${PORT}/sender.html`);
      console.log(`  수신자: http://${addr}:${PORT}/receiver.html`);
    });
  }

  console.log('\n=================================\n');
});
