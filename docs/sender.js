class VideoSender {
    constructor() {
        this.peer = null;
        this.connections = [];
        this.localStream = null;
        this.isStreaming = false;

        // DOM
        this.localVideo = document.getElementById('localVideo');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.roomIdInput = document.getElementById('roomId');
        this.statusDiv = document.getElementById('status');
        this.codecInfo = document.getElementById('codecInfo');
        this.peerInfo = document.getElementById('peerInfo');
        this.myPeerIdEl = document.getElementById('myPeerId');
        this.resolutionSelect = document.getElementById('resolution');
        this.bitrateSelect = document.getElementById('bitrate');

        this.codecSupport = { H265: false, VP9: false, H264: false, VP8: false };

        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());

        this.checkCodecs();
        this.generateRoomId();
    }

    generateRoomId() {
        const id = Math.random().toString(36).substring(2, 8);
        this.roomIdInput.value = id;
    }

    getSelectedCodec() {
        return document.querySelector('input[name="codec"]:checked')?.value || 'VP9';
    }

    getResolution() {
        const [w, h] = this.resolutionSelect.value.split('x').map(Number);
        return { width: w, height: h };
    }

    getBitrate() {
        return parseInt(this.bitrateSelect.value);
    }

    checkCodecs() {
        if (!RTCRtpSender.getCapabilities) {
            this.codecInfo.textContent = '코덱 API 미지원';
            return;
        }

        const caps = RTCRtpSender.getCapabilities('video');
        const codecs = caps.codecs.map(c => c.mimeType.toLowerCase());

        this.codecSupport.H265 = codecs.some(c => c.includes('h265') || c.includes('hevc'));
        this.codecSupport.VP9 = codecs.some(c => c.includes('vp9'));
        this.codecSupport.H264 = codecs.some(c => c.includes('h264'));
        this.codecSupport.VP8 = codecs.some(c => c.includes('vp8'));

        ['H265', 'VP9', 'H264', 'VP8'].forEach(codec => {
            const statusEl = document.getElementById(`${codec.toLowerCase()}Status`);
            const radioEl = document.getElementById(`codec${codec}`);
            if (statusEl) {
                statusEl.textContent = this.codecSupport[codec] ? '✓' : '✗';
                statusEl.className = this.codecSupport[codec] ? 'supported' : 'unsupported';
            }
            if (radioEl) radioEl.disabled = !this.codecSupport[codec];
        });

        if (!this.codecSupport.VP9 && this.codecSupport.H264) {
            document.getElementById('codecH264').checked = true;
        }

        const supported = Object.entries(this.codecSupport).filter(([,v]) => v).map(([k]) => k).join(', ');
        this.codecInfo.textContent = `지원: ${supported || '없음'}`;
    }

    updateStatus(msg, type = 'info') {
        this.statusDiv.textContent = msg;
        this.statusDiv.className = `status ${type}`;
    }

    async start() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            this.updateStatus('룸 ID를 입력하세요', 'error');
            return;
        }

        try {
            const res = this.getResolution();
            this.updateStatus(`카메라 연결 중... (${res.width}x${res.height})`, 'info');

            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: res.width }, height: { ideal: res.height }, frameRate: { ideal: 30 } },
                audio: true
            });

            this.localVideo.srcObject = this.localStream;
            this.updateStatus('PeerJS 연결 중...', 'info');

            // PeerJS - sender-{roomId}로 ID 설정
            const peerId = `sender-${roomId}`;
            this.peer = new Peer(peerId, {
                debug: 2
            });

            this.peer.on('open', (id) => {
                console.log('Peer 연결됨:', id);
                this.peerInfo.style.display = 'block';
                this.myPeerIdEl.textContent = roomId;
                this.updateStatus('수신자 대기 중...', 'success');
                this.isStreaming = true;
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
            });

            // 수신자가 data connection으로 연결 요청할 때
            this.peer.on('connection', (conn) => {
                console.log('수신자 데이터 연결:', conn.peer);

                conn.on('open', () => {
                    console.log('데이터 연결 열림');
                });

                conn.on('data', (data) => {
                    console.log('데이터 수신:', data);
                    if (data.type === 'request-stream') {
                        // 수신자에게 call (스트림 전송)
                        console.log('스트림 전송 시작:', conn.peer);
                        const call = this.peer.call(conn.peer, this.localStream);

                        if (call) {
                            this.connections.push(call);
                            this.updateStatus('수신자 연결됨! 스트리밍 중...', 'success');

                            call.on('close', () => {
                                this.connections = this.connections.filter(c => c !== call);
                                if (this.connections.length === 0) {
                                    this.updateStatus('수신자 대기 중...', 'success');
                                }
                            });

                            this.monitorStats(call);
                        }
                    }
                });
            });

            // 수신자가 직접 call할 때 (fallback)
            this.peer.on('call', (call) => {
                console.log('수신자 call:', call.peer);
                this.updateStatus('수신자 연결됨! 스트리밍 중...', 'success');

                call.answer(this.localStream);
                this.connections.push(call);

                call.on('close', () => {
                    this.connections = this.connections.filter(c => c !== call);
                    if (this.connections.length === 0) {
                        this.updateStatus('수신자 대기 중...', 'success');
                    }
                });

                this.monitorStats(call);
            });

            this.peer.on('error', (err) => {
                console.error('Peer 오류:', err);
                if (err.type === 'unavailable-id') {
                    this.updateStatus('이 룸 ID는 이미 사용 중입니다', 'error');
                } else {
                    this.updateStatus(`오류: ${err.message}`, 'error');
                }
            });

        } catch (err) {
            this.updateStatus(`오류: ${err.message}`, 'error');
            console.error(err);
        }
    }

    monitorStats(call) {
        const check = async () => {
            if (!call.peerConnection) return;

            try {
                const stats = await call.peerConnection.getStats();
                stats.forEach(report => {
                    if (report.type === 'outbound-rtp' && report.kind === 'video') {
                        const codecId = report.codecId;
                        const bytes = report.bytesSent || 0;
                        const fps = report.framesPerSecond || 0;

                        stats.forEach(cr => {
                            if (cr.id === codecId && cr.mimeType) {
                                const codec = cr.mimeType.split('/')[1];
                                const track = this.localStream?.getVideoTracks()[0];
                                const settings = track?.getSettings() || {};
                                const res = settings.width ? `${settings.width}x${settings.height}` : '';

                                this.codecInfo.innerHTML = `<span style="color:#4CAF50">●</span> <strong>${codec.toUpperCase()}</strong> | ${res} | ${Math.round(bytes/1024)}KB | ${Math.round(fps)}fps`;
                            }
                        });
                    }
                });
            } catch (e) {}
        };

        setInterval(check, 2000);
    }

    stop() {
        this.connections.forEach(c => c.close());
        this.connections = [];

        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        this.localVideo.srcObject = null;
        this.peerInfo.style.display = 'none';
        this.isStreaming = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.updateStatus('중지됨', 'info');
        this.checkCodecs();
    }
}

new VideoSender();
