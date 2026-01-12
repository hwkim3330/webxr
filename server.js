// WebRTC 1:N Broadcasting Server
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('.'));

// 클라이언트 관리
let sender = null;
const receivers = new Map(); // Map<receiverId, {ws, receiverId}>
let receiverIdCounter = 0;

wss.on('connection', (ws, req) => {
  const role = new URL(req.url, 'http://localhost').searchParams.get('role');

  if (role === 'sender') {
    // 송신자 연결
    if (sender) {
      sender.close();
      console.log('[SENDER] 기존 송신자 종료');
    }
    sender = ws;
    console.log('[SENDER] 연결됨');

    // 현재 연결된 수신자들에게 offer 요청
    receivers.forEach(({receiverId}) => {
      sender.send(JSON.stringify({
        type: 'request-offer',
        receiverId: receiverId
      }));
    });

    ws.on('message', (message) => {
      const data = JSON.parse(message);

      if (data.type === 'camera-ready') {
        // 카메라 준비됨 - 모든 수신자에게 offer 요청
        console.log('[SENDER] Camera ready - requesting offers for all receivers');
        receivers.forEach(({receiverId}) => {
          sender.send(JSON.stringify({
            type: 'request-offer',
            receiverId: receiverId
          }));
        });
      }
      else if (data.type === 'offer') {
        // 특정 수신자에게 offer 전달
        const receiver = receivers.get(data.receiverId);
        if (receiver && receiver.ws.readyState === WebSocket.OPEN) {
          receiver.ws.send(JSON.stringify({
            type: 'offer',
            offer: data.offer
          }));
          console.log(`[SENDER → RECEIVER ${data.receiverId}] offer`);
        }
      } else if (data.type === 'ice-candidate') {
        // 특정 수신자에게 ICE candidate 전달
        const receiver = receivers.get(data.receiverId);
        if (receiver && receiver.ws.readyState === WebSocket.OPEN) {
          receiver.ws.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: data.candidate
          }));
        }
      }
    });

    ws.on('close', () => {
      console.log('[SENDER] 연결 종료');
      sender = null;
      // 모든 수신자에게 송신자 종료 알림
      receivers.forEach(({ws}) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'sender-disconnected' }));
        }
      });
    });

  } else if (role === 'receiver') {
    // 수신자 연결
    const receiverId = receiverIdCounter++;
    receivers.set(receiverId, { ws, receiverId });
    console.log(`[RECEIVER ${receiverId}] 연결됨 (총 ${receivers.size}명)`);

    // 수신자에게 ID 전송
    ws.send(JSON.stringify({
      type: 'receiver-id',
      receiverId: receiverId
    }));

    // 송신자가 있으면 offer 요청
    if (sender && sender.readyState === WebSocket.OPEN) {
      sender.send(JSON.stringify({
        type: 'request-offer',
        receiverId: receiverId
      }));
    } else {
      ws.send(JSON.stringify({ type: 'waiting-for-sender' }));
    }

    ws.on('message', (message) => {
      const data = JSON.parse(message);

      if (data.type === 'answer') {
        // 송신자에게 answer 전달
        if (sender && sender.readyState === WebSocket.OPEN) {
          sender.send(JSON.stringify({
            type: 'answer',
            receiverId: receiverId,
            answer: data.answer
          }));
          console.log(`[RECEIVER ${receiverId} → SENDER] answer`);
        }
      } else if (data.type === 'ice-candidate') {
        // 송신자에게 ICE candidate 전달
        if (sender && sender.readyState === WebSocket.OPEN) {
          sender.send(JSON.stringify({
            type: 'ice-candidate',
            receiverId: receiverId,
            candidate: data.candidate
          }));
        }
      }
    });

    ws.on('close', () => {
      console.log(`[RECEIVER ${receiverId}] 연결 종료`);
      receivers.delete(receiverId);

      // 송신자에게 수신자 종료 알림
      if (sender && sender.readyState === WebSocket.OPEN) {
        sender.send(JSON.stringify({
          type: 'receiver-disconnected',
          receiverId: receiverId
        }));
      }
    });
  }

  ws.on('error', (error) => {
    console.error('[WS ERROR]', error.message);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
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
  console.log('WebXR 1:N Broadcasting Server');
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
