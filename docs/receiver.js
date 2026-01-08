class VRReceiver {
    constructor() {
        this.peer = null;
        this.call = null;
        this.remoteStream = null;

        // Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.videoTexture = null;
        this.videoElement = null;
        this.textureReady = false;

        // Controls
        this.isUserInteracting = false;
        this.lon = 0;
        this.lat = 0;
        this.onPointerDownLon = 0;
        this.onPointerDownLat = 0;
        this.onPointerDownX = 0;
        this.onPointerDownY = 0;

        // XR
        this.xrSession = null;

        // DOM
        this.canvas = document.getElementById('vrCanvas');
        this.connectBtn = document.getElementById('connectBtn');
        this.vrButton = document.getElementById('vrButton');
        this.roomIdInput = document.getElementById('roomId');
        this.statusDiv = document.getElementById('status');
        this.codecInfo = document.getElementById('codecInfo');
        this.overlay = document.getElementById('overlay');
        this.debugVideo = document.getElementById('debugVideo');
        this.toggleDebugBtn = document.getElementById('toggleDebug');

        this.init();
        this.setupEvents();
    }

    updateStatus(msg, type = 'info') {
        this.statusDiv.textContent = msg;
        this.statusDiv.className = `status ${type}`;
    }

    init() {
        // Video element
        this.videoElement = document.createElement('video');
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        this.videoElement.autoplay = true;
        this.videoElement.crossOrigin = 'anonymous';

        // Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101010);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1100);
        this.camera.position.set(0, 0, 0.1);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.xr.enabled = true;

        // Sphere
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        // Placeholder texture
        const placeholderCanvas = document.createElement('canvas');
        placeholderCanvas.width = 512;
        placeholderCanvas.height = 256;
        const ctx = placeholderCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 512, 256);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('영상 대기 중...', 256, 128);

        const material = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(placeholderCanvas),
            side: THREE.BackSide
        });
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);

        this.checkXRSupport();
        this.checkCodecs();
        this.animate();
    }

    async checkXRSupport() {
        if (navigator.xr) {
            try {
                const supported = await navigator.xr.isSessionSupported('immersive-vr');
                this.vrButton.disabled = !supported;
                this.vrButton.textContent = supported ? 'VR 모드' : 'VR 미지원';
            } catch (e) {
                this.vrButton.textContent = 'VR 확인 실패';
            }
        } else {
            this.vrButton.textContent = 'WebXR 미지원';
        }
    }

    checkCodecs() {
        if (!RTCRtpReceiver.getCapabilities) return;

        const caps = RTCRtpReceiver.getCapabilities('video');
        const codecs = caps.codecs.map(c => c.mimeType.toLowerCase());

        const has = (name) => codecs.some(c => c.includes(name));

        this.codecInfo.innerHTML = ['h265', 'vp9', 'h264', 'vp8'].map(c =>
            `<span style="color:${has(c) ? '#4CAF50' : '#f44336'}">${c.toUpperCase()}${has(c) ? '✓' : '✗'}</span>`
        ).join(' | ');
    }

    setupEvents() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.vrButton.addEventListener('click', () => this.toggleVR());

        this.toggleDebugBtn.addEventListener('click', () => {
            this.debugVideo.classList.toggle('hidden');
            this.toggleDebugBtn.textContent = this.debugVideo.classList.contains('hidden') ? '미리보기 보기' : '미리보기 숨기기';
        });

        // Mouse/Touch
        this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('mouseup', () => this.onPointerUp());
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.onPointerDown(e.touches[0]); });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.onPointerMove(e.touches[0]); });
        this.canvas.addEventListener('touchend', () => this.onPointerUp());

        // Wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            this.camera.fov = Math.max(30, Math.min(100, this.camera.fov + e.deltaY * 0.05));
            this.camera.updateProjectionMatrix();
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Click to play
        this.canvas.addEventListener('click', () => {
            if (this.videoElement?.paused && this.remoteStream) {
                this.videoElement.play().catch(() => {});
            }
        });
    }

    onPointerDown(e) {
        this.isUserInteracting = true;
        this.onPointerDownX = e.clientX;
        this.onPointerDownY = e.clientY;
        this.onPointerDownLon = this.lon;
        this.onPointerDownLat = this.lat;
    }

    onPointerMove(e) {
        if (!this.isUserInteracting) return;
        this.lon = (this.onPointerDownX - e.clientX) * 0.2 + this.onPointerDownLon;
        this.lat = (e.clientY - this.onPointerDownY) * 0.2 + this.onPointerDownLat;
    }

    onPointerUp() {
        this.isUserInteracting = false;
    }

    connect() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            this.updateStatus('룸 ID를 입력하세요', 'error');
            return;
        }

        this.updateStatus('PeerJS 연결 중...', 'info');

        // Receiver용 고유 ID
        const myId = `receiver-${roomId}-${Date.now()}`;
        this.peer = new Peer(myId, { debug: 1 });

        this.peer.on('open', () => {
            this.updateStatus('송신자 연결 시도 중...', 'info');

            const senderId = `sender-${roomId}`;

            // DataConnection으로 먼저 연결 확인
            const conn = this.peer.connect(senderId);

            conn.on('open', () => {
                console.log('데이터 연결 성공, 스트림 요청');
                conn.send({ type: 'request-stream' });
            });

            conn.on('error', (err) => {
                console.error('데이터 연결 오류:', err);
            });
        });

        // 송신자가 call 해올 때 받기
        this.peer.on('call', (call) => {
            console.log('송신자로부터 call 수신');
            this.updateStatus('스트림 수신 중...', 'info');

            // 스트림 없이 answer
            call.answer();

            call.on('stream', (stream) => {
                console.log('스트림 수신!', stream.getTracks());
                this.handleStream(stream);
            });

            call.on('close', () => {
                this.updateStatus('송신자 연결 끊김', 'error');
            });

            call.on('error', (err) => {
                console.error('Call 오류:', err);
                this.updateStatus(`오류: ${err}`, 'error');
            });

            this.call = call;
        });

        this.peer.on('error', (err) => {
            console.error('Peer 오류:', err);
            if (err.type === 'peer-unavailable') {
                this.updateStatus('송신자를 찾을 수 없습니다', 'error');
            } else {
                this.updateStatus(`오류: ${err.message}`, 'error');
            }
        });
    }

    handleStream(stream) {
        this.remoteStream = stream;
        this.videoElement.srcObject = stream;
        this.debugVideo.srcObject = stream;

        // 비디오 준비 대기
        this.videoElement.onloadedmetadata = () => {
            console.log('메타데이터 로드:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);
        };

        this.videoElement.oncanplay = () => {
            console.log('재생 가능');
            this.videoElement.play().then(() => {
                console.log('재생 시작');
                this.updateStatus('스트리밍 수신 중!', 'success');
                // 약간의 딜레이 후 텍스처 생성
                setTimeout(() => this.updateVideoTexture(), 100);
            }).catch((e) => {
                console.error('재생 실패:', e);
                this.updateStatus('화면을 클릭하여 재생', 'warning');
            });
        };

        this.monitorStats();
    }

    monitorStats() {
        const check = async () => {
            if (!this.call?.peerConnection) return;

            try {
                const stats = await this.call.peerConnection.getStats();
                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        const codecId = report.codecId;
                        const bytes = report.bytesReceived || 0;

                        stats.forEach(cr => {
                            if (cr.id === codecId && cr.mimeType) {
                                const codec = cr.mimeType.split('/')[1];
                                const res = this.videoElement.videoWidth > 0
                                    ? `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`
                                    : '...';
                                this.codecInfo.innerHTML = `<span style="color:#4CAF50">●</span> <strong>${codec.toUpperCase()}</strong> | ${res} | ${Math.round(bytes/1024)}KB`;
                            }
                        });
                    }
                });
            } catch (e) {}
        };

        setInterval(check, 2000);
    }

    updateVideoTexture() {
        // 비디오가 실제로 재생 중이고 크기가 있는지 확인
        if (!this.videoElement ||
            this.videoElement.readyState < 3 ||
            this.videoElement.videoWidth === 0 ||
            this.videoElement.videoHeight === 0) {
            console.log('비디오 아직 준비 안됨, 재시도...');
            setTimeout(() => this.updateVideoTexture(), 300);
            return;
        }

        console.log('텍스처 생성:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);

        this.videoTexture = new THREE.VideoTexture(this.videoElement);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
        this.videoTexture.format = THREE.RGBAFormat;
        this.videoTexture.generateMipmaps = false;

        // 이전 material 정리
        if (this.sphere.material) {
            this.sphere.material.dispose();
        }

        this.sphere.material = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.BackSide
        });

        this.textureReady = true;
        console.log('텍스처 적용 완료');
    }

    async toggleVR() {
        if (this.xrSession) {
            await this.xrSession.end();
            return;
        }

        try {
            this.xrSession = await navigator.xr.requestSession('immersive-vr', {
                optionalFeatures: ['local-floor', 'bounded-floor']
            });

            this.xrSession.addEventListener('end', () => {
                this.xrSession = null;
                this.vrButton.textContent = 'VR 모드';
                this.overlay.classList.remove('hidden');
            });

            await this.renderer.xr.setSession(this.xrSession);
            this.vrButton.textContent = 'VR 종료';
            this.overlay.classList.add('hidden');
        } catch (err) {
            this.updateStatus(`VR 오류: ${err.message}`, 'error');
        }
    }

    animate() {
        this.renderer.setAnimationLoop(() => this.render());
    }

    render() {
        if (!this.renderer.xr.isPresenting) {
            this.lat = Math.max(-85, Math.min(85, this.lat));
            const phi = THREE.MathUtils.degToRad(90 - this.lat);
            const theta = THREE.MathUtils.degToRad(this.lon);

            this.camera.lookAt(
                500 * Math.sin(phi) * Math.cos(theta),
                500 * Math.cos(phi),
                500 * Math.sin(phi) * Math.sin(theta)
            );
        }

        // 텍스처 업데이트 - 비디오가 실제로 재생 중일 때만
        if (this.textureReady &&
            this.videoTexture &&
            this.videoElement &&
            !this.videoElement.paused &&
            this.videoElement.readyState >= 3) {
            this.videoTexture.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new VRReceiver();
