const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// 룸 관리
const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('새 클라이언트 연결');

    let currentRoom = null;
    let clientType = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[${clientType || 'unknown'}] 메시지:`, data.type);

            switch (data.type) {
                case 'join':
                    currentRoom = data.room || 'default';
                    clientType = data.clientType;

                    if (!rooms.has(currentRoom)) {
                        rooms.set(currentRoom, { sender: null, receivers: [] });
                    }

                    const room = rooms.get(currentRoom);

                    if (clientType === 'sender') {
                        room.sender = ws;
                        console.log(`✓ 송신자가 룸 [${currentRoom}]에 참가`);

                        // 대기 중인 수신자들에게 알림 + offer 요청
                        if (room.receivers.length > 0) {
                            console.log(`→ 대기 중인 수신자 ${room.receivers.length}명에게 알림`);
                            room.receivers.forEach(receiver => {
                                if (receiver.readyState === WebSocket.OPEN) {
                                    receiver.send(JSON.stringify({ type: 'sender-ready' }));
                                }
                            });
                            // 송신자에게 offer 생성 요청
                            ws.send(JSON.stringify({ type: 'create-offer' }));
                        }
                    } else {
                        room.receivers.push(ws);
                        console.log(`✓ 수신자가 룸 [${currentRoom}]에 참가 (총 ${room.receivers.length}명)`);

                        // 송신자가 이미 있으면 offer 요청
                        if (room.sender && room.sender.readyState === WebSocket.OPEN) {
                            console.log(`→ 송신자에게 offer 생성 요청`);
                            ws.send(JSON.stringify({ type: 'sender-ready' }));
                            room.sender.send(JSON.stringify({ type: 'create-offer' }));
                        }
                    }
                    break;

                case 'offer':
                    console.log(`→ offer 전달 (${currentRoom})`);
                    if (currentRoom && rooms.has(currentRoom)) {
                        const room = rooms.get(currentRoom);
                        room.receivers.forEach(receiver => {
                            if (receiver.readyState === WebSocket.OPEN) {
                                receiver.send(JSON.stringify({
                                    type: 'offer',
                                    offer: data.offer
                                }));
                            }
                        });
                    }
                    break;

                case 'answer':
                    console.log(`→ answer 전달 (${currentRoom})`);
                    if (currentRoom && rooms.has(currentRoom)) {
                        const room = rooms.get(currentRoom);
                        if (room.sender && room.sender.readyState === WebSocket.OPEN) {
                            room.sender.send(JSON.stringify({
                                type: 'answer',
                                answer: data.answer
                            }));
                        }
                    }
                    break;

                case 'ice-candidate':
                    if (currentRoom && rooms.has(currentRoom)) {
                        const room = rooms.get(currentRoom);

                        if (clientType === 'sender') {
                            room.receivers.forEach(receiver => {
                                if (receiver.readyState === WebSocket.OPEN) {
                                    receiver.send(JSON.stringify({
                                        type: 'ice-candidate',
                                        candidate: data.candidate
                                    }));
                                }
                            });
                        } else {
                            if (room.sender && room.sender.readyState === WebSocket.OPEN) {
                                room.sender.send(JSON.stringify({
                                    type: 'ice-candidate',
                                    candidate: data.candidate
                                }));
                            }
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('메시지 처리 오류:', error);
        }
    });

    ws.on('close', () => {
        console.log(`✗ 클라이언트 연결 해제 (${clientType})`);

        if (currentRoom && rooms.has(currentRoom)) {
            const room = rooms.get(currentRoom);

            if (clientType === 'sender') {
                room.sender = null;
                room.receivers.forEach(receiver => {
                    if (receiver.readyState === WebSocket.OPEN) {
                        receiver.send(JSON.stringify({ type: 'sender-left' }));
                    }
                });
            } else {
                room.receivers = room.receivers.filter(r => r !== ws);
            }

            if (!room.sender && room.receivers.length === 0) {
                rooms.delete(currentRoom);
                console.log(`룸 [${currentRoom}] 삭제됨`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`서버 실행 중: http://localhost:${PORT}`);
    console.log(`송신자: http://localhost:${PORT}/sender.html`);
    console.log(`수신자: http://localhost:${PORT}/receiver.html`);
    console.log(`========================================\n`);
});
