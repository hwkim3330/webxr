class VRReceiver {
    constructor() {
        this.ws = null;
        this.peerConnection = null;
        this.remoteStream = null;

        // Three.js 관련
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.videoTexture = null;
        this.videoElement = null;

        // 컨트롤 관련
        this.isUserInteracting = false;
        this.lon = 0;
        this.lat = 0;
        this.phi = 0;
        this.theta = 0;
        this.onPointerDownLon = 0;
        this.onPointerDownLat = 0;
        this.onPointerDownX = 0;
        this.onPointerDownY = 0;

        // XR 관련
        this.xrSession = null;

        // DOM 요소
        this.canvas = document.getElementById('vrCanvas');
        this.connectBtn = document.getElementById('connectBtn');
        this.vrButton = document.getElementById('vrButton');
        this.roomIdInput = document.getElementById('roomId');
        this.statusDiv = document.getElementById('status');
        this.overlay = document.getElementById('overlay');
        this.codecInfo = document.getElementById('codecInfo');
        this.debugVideo = document.getElementById('debugVideo');
        this.toggleDebugBtn = document.getElementById('toggleDebug');

        this.init();
        this.setupEventListeners();
    }

    updateStatus(message, type = 'info') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
        console.log(`[${type}] ${message}`);
    }

    init() {
        // 비디오 엘리먼트 생성
        this.videoElement = document.createElement('video');
        this.videoElement.playsInline = true;
        this.videoElement.muted = true; // 자동재생을 위해 muted
        this.videoElement.autoplay = true;
        this.videoElement.crossOrigin = 'anonymous';

        // Three.js 초기화
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101010);

        // 카메라 설정
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1100
        );
        this.camera.position.set(0, 0, 0.1);

        // 렌더러 설정
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.xr.enabled = true;

        // 360도 구체 생성 (내부에서 볼 수 있도록)
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // 내부에서 보기 위해 뒤집기

        // 초기 텍스처 (테스트 패턴)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 그라데이션 배경
        const gradient = ctx.createLinearGradient(0, 0, 512, 256);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 256);

        // 텍스트
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('영상 대기 중...', 256, 128);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText('송신자가 연결되면 영상이 표시됩니다', 256, 160);

        const initialTexture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: initialTexture,
            side: THREE.BackSide
        });
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);

        // WebXR 지원 확인
        this.checkXRSupport();

        // 지원 코덱 확인
        this.checkSupportedCodecs();

        // 애니메이션 시작
        this.animate();
    }

    checkSupportedCodecs() {
        if (!RTCRtpReceiver.getCapabilities) {
            if (this.codecInfo) {
                this.codecInfo.textContent = '코덱 API 미지원';
            }
            return;
        }

        const capabilities = RTCRtpReceiver.getCapabilities('video');
        const codecs = capabilities.codecs.map(c => c.mimeType);

        const hasH265 = codecs.some(c => c.toLowerCase().includes('h265') || c.toLowerCase().includes('hevc'));
        const hasVP9 = codecs.some(c => c.toLowerCase().includes('vp9'));
        const hasH264 = codecs.some(c => c.toLowerCase().includes('h264'));
        const hasVP8 = codecs.some(c => c.toLowerCase().includes('vp8'));

        console.log('수신 지원 코덱:', codecs);

        if (this.codecInfo) {
            this.codecInfo.innerHTML =
                `지원: ${hasH265 ? '<span style="color:#4CAF50">H265✓</span>' : '<span style="color:#f44336">H265✗</span>'} | ` +
                `${hasVP9 ? '<span style="color:#4CAF50">VP9✓</span>' : '<span style="color:#f44336">VP9✗</span>'} | ` +
                `${hasH264 ? '<span style="color:#4CAF50">H264✓</span>' : '<span style="color:#f44336">H264✗</span>'} | ` +
                `${hasVP8 ? '<span style="color:#4CAF50">VP8✓</span>' : '<span style="color:#f44336">VP8✗</span>'}`;
        }
    }

    async checkXRSupport() {
        if (navigator.xr) {
            try {
                const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
                if (isSupported) {
                    this.vrButton.disabled = false;
                    this.vrButton.textContent = 'VR 모드 시작';
                } else {
                    this.vrButton.textContent = 'VR 미지원 (일반 모드 사용)';
                    this.vrButton.disabled = true;
                }
            } catch (e) {
                this.vrButton.textContent = 'VR 확인 실패';
                this.vrButton.disabled = true;
            }
        } else {
            this.vrButton.textContent = 'WebXR 미지원 (일반 모드)';
            this.vrButton.disabled = true;
        }
    }

    setupEventListeners() {
        // 연결 버튼
        this.connectBtn.addEventListener('click', () => this.connect());

        // VR 버튼
        this.vrButton.addEventListener('click', () => this.toggleVR());

        // 디버그 비디오 토글
        this.toggleDebugBtn.addEventListener('click', () => {
            this.debugVideo.classList.toggle('hidden');
            this.toggleDebugBtn.textContent =
                this.debugVideo.classList.contains('hidden') ? '미리보기 보기' : '미리보기 숨기기';
        });

        // 마우스/터치 컨트롤
        this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('mouseup', () => this.onPointerUp());
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.onPointerDown(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.onPointerMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', () => this.onPointerUp());

        // 마우스 휠 줌
        this.canvas.addEventListener('wheel', (e) => {
            this.camera.fov = Math.max(30, Math.min(100, this.camera.fov + e.deltaY * 0.05));
            this.camera.updateProjectionMatrix();
        });

        // 윈도우 리사이즈
        window.addEventListener('resize', () => this.onResize());

        // 클릭으로 비디오 재생 (자동재생 정책 우회)
        this.canvas.addEventListener('click', () => {
            if (this.videoElement && this.videoElement.paused && this.remoteStream) {
                this.videoElement.play().catch(e => console.warn('재생 실패:', e));
            }
        });
    }

    onPointerDown(event) {
        this.isUserInteracting = true;
        this.onPointerDownX = event.clientX;
        this.onPointerDownY = event.clientY;
        this.onPointerDownLon = this.lon;
        this.onPointerDownLat = this.lat;
    }

    onPointerMove(event) {
        if (!this.isUserInteracting) return;

        this.lon = (this.onPointerDownX - event.clientX) * 0.2 + this.onPointerDownLon;
        this.lat = (event.clientY - this.onPointerDownY) * 0.2 + this.onPointerDownLat;
    }

    onPointerUp() {
        this.isUserInteracting = false;
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    async connect() {
        try {
            this.updateStatus('서버 연결 중...', 'info');

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.ws = new WebSocket(`${protocol}//${window.location.host}`);

            this.ws.onopen = () => {
                this.updateStatus('서버 연결됨. 송신자 대기 중...', 'success');

                // 룸 참가
                this.ws.send(JSON.stringify({
                    type: 'join',
                    room: this.roomIdInput.value,
                    clientType: 'receiver'
                }));
            };

            this.ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'sender-ready':
                        this.updateStatus('송신자 발견! 연결 중...', 'info');
                        break;

                    case 'offer':
                        await this.handleOffer(data.offer);
                        break;

                    case 'ice-candidate':
                        await this.handleIceCandidate(data.candidate);
                        break;

                    case 'sender-left':
                        this.updateStatus('송신자가 나갔습니다', 'error');
                        break;
                }
            };

            this.ws.onclose = () => {
                this.updateStatus('서버 연결 끊김', 'error');
            };

            this.ws.onerror = (error) => {
                this.updateStatus('WebSocket 오류', 'error');
                console.error('WebSocket 오류:', error);
            };

        } catch (error) {
            this.updateStatus(`연결 오류: ${error.message}`, 'error');
        }
    }

    async handleOffer(offer) {
        try {
            this.updateStatus('P2P 연결 설정 중...', 'info');

            // PeerConnection 생성
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // 원격 스트림 수신
            this.peerConnection.ontrack = (event) => {
                console.log('트랙 수신:', event.track.kind);

                if (event.track.kind === 'video') {
                    this.remoteStream = event.streams[0];
                    this.videoElement.srcObject = this.remoteStream;

                    // 디버그 비디오에도 연결
                    this.debugVideo.srcObject = this.remoteStream;

                    // 비디오 메타데이터 로드 대기
                    this.videoElement.onloadedmetadata = () => {
                        console.log('비디오 메타데이터 로드됨:',
                            this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);

                        this.videoElement.play().then(() => {
                            console.log('비디오 재생 시작');
                            this.updateVideoTexture();
                            this.updateStatus('스트리밍 수신 중!', 'success');
                        }).catch(e => {
                            console.error('비디오 재생 오류:', e);
                            this.updateStatus('화면을 클릭하여 재생', 'info');
                        });
                    };

                    // 비디오 데이터 수신 시
                    this.videoElement.onplaying = () => {
                        console.log('비디오 재생 중');
                        this.updateVideoTexture();
                    };
                }
            };

            // ICE candidate 이벤트
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.ws.send(JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }));
                }
            };

            // 연결 상태 모니터링
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                console.log('연결 상태:', state);

                if (state === 'connected') {
                    this.updateStatus('스트리밍 수신 중!', 'success');
                    this.logActiveCodec();
                } else if (state === 'disconnected' || state === 'failed') {
                    this.updateStatus('연결 끊김', 'error');
                }
            };

            // Offer 설정 및 Answer 생성
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.ws.send(JSON.stringify({
                type: 'answer',
                answer: answer
            }));

        } catch (error) {
            this.updateStatus(`연결 오류: ${error.message}`, 'error');
            console.error('Offer 처리 오류:', error);
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('ICE candidate 추가 오류:', error);
        }
    }

    // 현재 사용 중인 코덱 확인 (반복 호출)
    async logActiveCodec() {
        const checkCodec = async () => {
            if (!this.peerConnection) return;

            try {
                const stats = await this.peerConnection.getStats();
                let found = false;

                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        const codecId = report.codecId;
                        const bytesReceived = report.bytesReceived || 0;
                        const framesDecoded = report.framesDecoded || 0;

                        stats.forEach(codecReport => {
                            if (codecReport.id === codecId && codecReport.mimeType) {
                                found = true;
                                const codecName = codecReport.mimeType;
                                const codec = codecName.split('/')[1] || 'unknown';
                                console.log('수신 코덱:', codecName, '바이트:', bytesReceived, '프레임:', framesDecoded);

                                if (this.codecInfo) {
                                    const resolution = this.videoElement.videoWidth > 0
                                        ? `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`
                                        : '로딩중...';
                                    this.codecInfo.innerHTML =
                                        `<span style="color:#4CAF50">●</span> 사용: <strong>${codec.toUpperCase()}</strong> | ${resolution} | ${Math.round(bytesReceived/1024)}KB`;
                                }
                            }
                        });
                    }
                });

                if (!found && this.codecInfo) {
                    this.codecInfo.innerHTML = '<span style="color:#ff9800">●</span> 코덱 협상 중...';
                }
            } catch (e) {
                console.warn('코덱 확인 실패:', e);
            }
        };

        // 즉시 1회 + 2초 후 반복
        await checkCodec();
        setTimeout(() => checkCodec(), 2000);
        setTimeout(() => checkCodec(), 5000);
    }

    updateVideoTexture() {
        if (!this.videoElement || this.videoElement.readyState < 2) {
            console.log('비디오 아직 준비 안됨, 재시도...');
            setTimeout(() => this.updateVideoTexture(), 500);
            return;
        }

        console.log('비디오 텍스처 생성:',
            this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);

        // 비디오 텍스처 생성
        this.videoTexture = new THREE.VideoTexture(this.videoElement);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
        this.videoTexture.format = THREE.RGBAFormat;
        this.videoTexture.generateMipmaps = false;

        // 구체에 비디오 텍스처 적용
        this.sphere.material.dispose();
        this.sphere.material = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.BackSide
        });

        console.log('텍스처 적용 완료');
    }

    async toggleVR() {
        if (this.xrSession) {
            await this.xrSession.end();
            return;
        }

        try {
            const sessionInit = {
                optionalFeatures: ['local-floor', 'bounded-floor']
            };

            this.xrSession = await navigator.xr.requestSession('immersive-vr', sessionInit);

            this.xrSession.addEventListener('end', () => {
                this.xrSession = null;
                this.vrButton.textContent = 'VR 모드 시작';
                this.overlay.classList.remove('hidden');
            });

            await this.renderer.xr.setSession(this.xrSession);
            this.vrButton.textContent = 'VR 모드 종료';
            this.overlay.classList.add('hidden');

        } catch (error) {
            console.error('VR 세션 시작 오류:', error);
            this.updateStatus(`VR 오류: ${error.message}`, 'error');
        }
    }

    animate() {
        this.renderer.setAnimationLoop(() => this.render());
    }

    render() {
        // VR 모드가 아닐 때만 수동 카메라 제어
        if (!this.renderer.xr.isPresenting) {
            this.lat = Math.max(-85, Math.min(85, this.lat));
            this.phi = THREE.MathUtils.degToRad(90 - this.lat);
            this.theta = THREE.MathUtils.degToRad(this.lon);

            const x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
            const y = 500 * Math.cos(this.phi);
            const z = 500 * Math.sin(this.phi) * Math.sin(this.theta);

            this.camera.lookAt(x, y, z);
        }

        // 비디오 텍스처 업데이트
        if (this.videoTexture && this.videoElement && !this.videoElement.paused) {
            this.videoTexture.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// 초기화
const receiver = new VRReceiver();
