class DualCameraSender {
    constructor() {
        this.peer = null;
        this.connections = [];
        this.stream1 = null;
        this.stream2 = null;
        this.combinedStream = null;
        this.isStreaming = false;
        this.animationId = null;
        this.mode = 'side-by-side';

        // DOM
        this.video1 = document.getElementById('video1');
        this.video2 = document.getElementById('video2');
        this.canvas = document.getElementById('combinedCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.camera1Select = document.getElementById('camera1');
        this.camera2Select = document.getElementById('camera2');
        this.refreshBtn = document.getElementById('refreshCameras');

        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.roomIdInput = document.getElementById('roomId');
        this.statusDiv = document.getElementById('status');
        this.codecInfo = document.getElementById('codecInfo');
        this.peerInfo = document.getElementById('peerInfo');
        this.myPeerIdEl = document.getElementById('myPeerId');

        this.modeBtns = document.querySelectorAll('.mode-btn');

        this.setupEvents();
        this.loadCameras();
        this.generateRoomId();
    }

    generateRoomId() {
        this.roomIdInput.value = 'dual-' + Math.random().toString(36).substring(2, 6);
    }

    setupEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.refreshBtn.addEventListener('click', () => this.loadCameras());

        this.camera1Select.addEventListener('change', () => this.updateCamera(1));
        this.camera2Select.addEventListener('change', () => this.updateCamera(2));

        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
                this.setupCanvas();
            });
        });
    }

    updateStatus(msg, type = 'info') {
        this.statusDiv.textContent = msg;
        this.statusDiv.className = `status ${type}`;
    }

    async loadCameras() {
        try {
            // 먼저 권한 요청
            await navigator.mediaDevices.getUserMedia({ video: true });

            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === 'videoinput');

            [this.camera1Select, this.camera2Select].forEach((select, idx) => {
                const currentValue = select.value;
                select.innerHTML = `<option value="">카메라 ${idx + 1} 선택...</option>`;
                cameras.forEach((cam, i) => {
                    const option = document.createElement('option');
                    option.value = cam.deviceId;
                    option.textContent = cam.label || `카메라 ${i + 1}`;
                    select.appendChild(option);
                });
                if (currentValue) select.value = currentValue;
            });

            this.updateStatus(`${cameras.length}개 카메라 발견`, 'success');

            // 자동 선택 (첫 번째와 두 번째)
            if (cameras.length >= 2) {
                this.camera1Select.value = cameras[0].deviceId;
                this.camera2Select.value = cameras[1].deviceId;
                await this.updateCamera(1);
                await this.updateCamera(2);
            } else if (cameras.length === 1) {
                this.camera1Select.value = cameras[0].deviceId;
                await this.updateCamera(1);
                this.updateStatus('카메라 1개만 발견됨', 'warning');
            }

        } catch (err) {
            this.updateStatus(`카메라 접근 오류: ${err.message}`, 'error');
        }
    }

    async updateCamera(num) {
        const select = num === 1 ? this.camera1Select : this.camera2Select;
        const video = num === 1 ? this.video1 : this.video2;
        const deviceId = select.value;

        if (!deviceId) {
            if (num === 1 && this.stream1) {
                this.stream1.getTracks().forEach(t => t.stop());
                this.stream1 = null;
            } else if (num === 2 && this.stream2) {
                this.stream2.getTracks().forEach(t => t.stop());
                this.stream2 = null;
            }
            video.srcObject = null;
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: num === 1 // 오디오는 첫 번째 카메라에서만
            });

            if (num === 1) {
                if (this.stream1) this.stream1.getTracks().forEach(t => t.stop());
                this.stream1 = stream;
            } else {
                if (this.stream2) this.stream2.getTracks().forEach(t => t.stop());
                this.stream2 = stream;
            }

            video.srcObject = stream;

            // 캔버스 설정 및 합성 시작
            this.setupCanvas();
            if (!this.animationId) this.startCompositing();

        } catch (err) {
            this.updateStatus(`카메라 ${num} 오류: ${err.message}`, 'error');
        }
    }

    setupCanvas() {
        const width = 1920;
        const height = this.mode === 'top-bottom' ? 1920 : 960;

        this.canvas.width = width;
        this.canvas.height = height;
    }

    startCompositing() {
        const render = () => {
            this.compositeFrame();
            this.animationId = requestAnimationFrame(render);
        };
        render();
    }

    compositeFrame() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 배경
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, w, h);

        switch (this.mode) {
            case 'side-by-side':
                // 좌우 분할: 왼쪽에 cam1, 오른쪽에 cam2
                if (this.video1.readyState >= 2) {
                    this.ctx.drawImage(this.video1, 0, 0, w / 2, h);
                }
                if (this.video2.readyState >= 2) {
                    this.ctx.drawImage(this.video2, w / 2, 0, w / 2, h);
                }
                break;

            case 'top-bottom':
                // 상하 분할: 위에 cam1, 아래에 cam2
                if (this.video1.readyState >= 2) {
                    this.ctx.drawImage(this.video1, 0, 0, w, h / 2);
                }
                if (this.video2.readyState >= 2) {
                    this.ctx.drawImage(this.video2, 0, h / 2, w, h / 2);
                }
                break;

            case 'equirect':
                // Equirectangular 시뮬레이션 (간단한 버전)
                // cam1을 왼쪽 180도, cam2를 오른쪽 180도로 매핑
                // 실제 스티칭이 아닌 단순 배치
                if (this.video1.readyState >= 2) {
                    // 약간의 왜곡 효과 (구형 느낌)
                    this.ctx.save();
                    this.ctx.drawImage(this.video1, 0, h * 0.1, w / 2, h * 0.8);
                    this.ctx.restore();
                }
                if (this.video2.readyState >= 2) {
                    this.ctx.save();
                    this.ctx.drawImage(this.video2, w / 2, h * 0.1, w / 2, h * 0.8);
                    this.ctx.restore();
                }

                // 상하 검정 영역 표시
                this.ctx.fillStyle = '#111';
                this.ctx.fillRect(0, 0, w, h * 0.1);
                this.ctx.fillRect(0, h * 0.9, w, h * 0.1);
                break;
        }

        // 텍스트 오버레이 (디버그용)
        if (!this.stream1 && !this.stream2) {
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('카메라를 선택하세요', w / 2, h / 2);
        }
    }

    async start() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            this.updateStatus('룸 ID를 입력하세요', 'error');
            return;
        }

        if (!this.stream1 && !this.stream2) {
            this.updateStatus('최소 1개 카메라를 선택하세요', 'error');
            return;
        }

        try {
            this.updateStatus('스트림 생성 중...', 'info');

            // Canvas에서 스트림 캡처
            this.combinedStream = this.canvas.captureStream(30);

            // 오디오 트랙 추가 (stream1에서)
            if (this.stream1) {
                const audioTracks = this.stream1.getAudioTracks();
                audioTracks.forEach(track => {
                    this.combinedStream.addTrack(track);
                });
            }

            this.updateStatus('PeerJS 연결 중...', 'info');

            const peerId = `sender-${roomId}`;
            this.peer = new Peer(peerId, { debug: 2 });

            this.peer.on('open', (id) => {
                this.peerInfo.style.display = 'block';
                this.myPeerIdEl.textContent = roomId;
                this.updateStatus('수신자 대기 중...', 'success');
                this.isStreaming = true;
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
            });

            this.peer.on('call', (call) => {
                console.log('수신자 연결:', call.peer);
                this.updateStatus('수신자 연결됨! 스트리밍 중...', 'success');

                call.answer(this.combinedStream);
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
                if (err.type === 'unavailable-id') {
                    this.updateStatus('이 룸 ID는 이미 사용 중', 'error');
                } else {
                    this.updateStatus(`오류: ${err.message}`, 'error');
                }
            });

        } catch (err) {
            this.updateStatus(`오류: ${err.message}`, 'error');
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
                                this.codecInfo.innerHTML =
                                    `<span style="color:#4CAF50">●</span> <strong>${codec.toUpperCase()}</strong> | ${this.canvas.width}x${this.canvas.height} | ${Math.round(bytes/1024)}KB | ${Math.round(fps)}fps`;
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

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // 스트림은 유지 (미리보기용)
        this.combinedStream = null;
        this.peerInfo.style.display = 'none';
        this.isStreaming = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.updateStatus('중지됨', 'info');

        // 다시 합성 시작
        this.startCompositing();
    }
}

new DualCameraSender();
