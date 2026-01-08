class VideoSender {
    constructor() {
        this.ws = null;
        this.peerConnection = null;
        this.localStream = null;
        this.isStreaming = false;

        // DOM 요소
        this.localVideo = document.getElementById('localVideo');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.roomIdInput = document.getElementById('roomId');
        this.statusDiv = document.getElementById('status');
        this.codecInfo = document.getElementById('codecInfo');
        this.resolutionSelect = document.getElementById('resolution');
        this.bitrateSelect = document.getElementById('bitrate');

        // 코덱 지원 상태
        this.codecSupport = {
            H265: false,
            VP9: false,
            H264: false,
            VP8: false
        };

        this.startBtn.addEventListener('click', () => this.startStreaming());
        this.stopBtn.addEventListener('click', () => this.stopStreaming());

        // 지원 코덱 확인
        this.checkSupportedCodecs();
    }

    getSelectedCodec() {
        const selected = document.querySelector('input[name="codec"]:checked');
        return selected ? selected.value : 'VP9';
    }

    getSelectedResolution() {
        const res = this.resolutionSelect.value.split('x');
        return { width: parseInt(res[0]), height: parseInt(res[1]) };
    }

    getSelectedBitrate() {
        return parseInt(this.bitrateSelect.value);
    }

    checkSupportedCodecs() {
        if (!RTCRtpSender.getCapabilities) {
            console.log('코덱 확인 API 미지원');
            if (this.codecInfo) {
                this.codecInfo.textContent = '코덱 API 미지원';
            }
            return;
        }

        const capabilities = RTCRtpSender.getCapabilities('video');
        const codecs = capabilities.codecs.map(c => c.mimeType.toLowerCase());
        console.log('송신 지원 코덱:', codecs);

        this.codecSupport.H265 = codecs.some(c => c.includes('h265') || c.includes('hevc'));
        this.codecSupport.VP9 = codecs.some(c => c.includes('vp9'));
        this.codecSupport.H264 = codecs.some(c => c.includes('h264'));
        this.codecSupport.VP8 = codecs.some(c => c.includes('vp8'));

        // UI 업데이트
        this.updateCodecUI('h265Status', this.codecSupport.H265);
        this.updateCodecUI('vp9Status', this.codecSupport.VP9);
        this.updateCodecUI('h264Status', this.codecSupport.H264);
        this.updateCodecUI('vp8Status', this.codecSupport.VP8);

        // 라디오 버튼 비활성화
        document.getElementById('codecH265').disabled = !this.codecSupport.H265;
        document.getElementById('codecVP9').disabled = !this.codecSupport.VP9;
        document.getElementById('codecH264').disabled = !this.codecSupport.H264;
        document.getElementById('codecVP8').disabled = !this.codecSupport.VP8;

        // 지원되는 첫 번째 코덱 선택
        if (this.codecSupport.VP9) {
            document.getElementById('codecVP9').checked = true;
        } else if (this.codecSupport.H264) {
            document.getElementById('codecH264').checked = true;
        }

        if (this.codecInfo) {
            const supported = Object.entries(this.codecSupport)
                .filter(([_, v]) => v)
                .map(([k, _]) => k)
                .join(', ');
            this.codecInfo.textContent = `지원 코덱: ${supported || '없음'}`;
        }
    }

    updateCodecUI(elementId, supported) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = supported ? '✓' : '✗';
            el.className = supported ? 'supported' : 'unsupported';
        }
    }

    updateStatus(message, type = 'info') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
        console.log(`[${type}] ${message}`);
    }

    async startStreaming() {
        try {
            const resolution = this.getSelectedResolution();
            this.updateStatus(`웹캠 접근 중... (${resolution.width}x${resolution.height})`, 'info');

            // 웹캠 스트림 가져오기
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: resolution.width },
                    height: { ideal: resolution.height },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });

            this.localVideo.srcObject = this.localStream;

            const videoTrack = this.localStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            console.log('실제 해상도:', settings.width, 'x', settings.height);

            this.updateStatus('웹캠 연결됨. 서버 연결 중...', 'info');

            // WebSocket 연결
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.ws = new WebSocket(`${protocol}//${window.location.host}`);

            this.ws.onopen = () => {
                this.updateStatus('서버 연결됨. 수신자 대기 중...', 'success');

                this.ws.send(JSON.stringify({
                    type: 'join',
                    room: this.roomIdInput.value,
                    clientType: 'sender'
                }));

                this.isStreaming = true;
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
            };

            this.ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                console.log('수신 메시지:', data.type);

                switch (data.type) {
                    case 'create-offer':
                    case 'sender-ready':
                        // 수신자가 연결됨, offer 생성
                        await this.createOffer();
                        break;

                    case 'answer':
                        await this.handleAnswer(data.answer);
                        break;

                    case 'ice-candidate':
                        await this.handleIceCandidate(data.candidate);
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
            this.updateStatus(`오류: ${error.message}`, 'error');
            console.error('스트리밍 시작 오류:', error);
        }
    }

    async createOffer() {
        try {
            this.updateStatus('P2P 연결 설정 중...', 'info');

            // 기존 연결 정리
            if (this.peerConnection) {
                this.peerConnection.close();
            }

            // PeerConnection 생성
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // 트랙 추가
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // 코덱 우선순위 설정
            this.setCodecPreferences();

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
                    this.updateStatus('스트리밍 중!', 'success');
                    this.logActiveCodec();
                } else if (state === 'disconnected' || state === 'failed') {
                    this.updateStatus('연결 끊김', 'error');
                }
            };

            // Offer 생성 및 전송
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            console.log('Offer 전송');
            this.ws.send(JSON.stringify({
                type: 'offer',
                offer: offer
            }));

        } catch (error) {
            this.updateStatus(`Offer 생성 오류: ${error.message}`, 'error');
            console.error('Offer 생성 오류:', error);
        }
    }

    setCodecPreferences() {
        const selectedCodec = this.getSelectedCodec();
        const transceiver = this.peerConnection.getTransceivers()
            .find(t => t.sender.track?.kind === 'video');

        if (!transceiver || !transceiver.setCodecPreferences) {
            console.log('setCodecPreferences 미지원');
            return;
        }

        const capabilities = RTCRtpSender.getCapabilities('video');
        if (!capabilities) return;

        // 선택된 코덱을 최우선으로
        const codecMap = {
            'H265': ['video/h265', 'video/hevc'],
            'VP9': ['video/vp9'],
            'H264': ['video/h264'],
            'VP8': ['video/vp8']
        };

        const preferredMimeTypes = codecMap[selectedCodec] || ['video/vp9'];

        const sortedCodecs = [];

        // 선택된 코덱 먼저
        preferredMimeTypes.forEach(mimeType => {
            capabilities.codecs.forEach(codec => {
                if (codec.mimeType.toLowerCase() === mimeType.toLowerCase()) {
                    sortedCodecs.push(codec);
                }
            });
        });

        // 나머지 코덱
        capabilities.codecs.forEach(codec => {
            const isDuplicate = sortedCodecs.some(c =>
                c.mimeType === codec.mimeType && c.sdpFmtpLine === codec.sdpFmtpLine
            );
            if (!isDuplicate) {
                sortedCodecs.push(codec);
            }
        });

        try {
            transceiver.setCodecPreferences(sortedCodecs);
            console.log('코덱 우선순위 설정:', selectedCodec, sortedCodecs.slice(0, 2).map(c => c.mimeType));
        } catch (e) {
            console.warn('코덱 우선순위 설정 실패:', e);
        }

        // 비트레이트 설정
        this.setBitrate(transceiver.sender);
    }

    async setBitrate(sender) {
        const bitrate = this.getSelectedBitrate();

        try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }

            params.encodings[0].maxBitrate = bitrate;
            await sender.setParameters(params);
            console.log('비트레이트 설정:', bitrate / 1000000, 'Mbps');
        } catch (e) {
            console.warn('비트레이트 설정 실패:', e);
        }
    }

    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Answer 처리 완료');
        } catch (error) {
            console.error('Answer 처리 오류:', error);
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('ICE candidate 추가 오류:', error);
        }
    }

    logActiveCodec() {
        const check = async () => {
            if (!this.peerConnection) return;

            try {
                const stats = await this.peerConnection.getStats();

                stats.forEach(report => {
                    if (report.type === 'outbound-rtp' && report.kind === 'video') {
                        const codecId = report.codecId;
                        const bytesSent = report.bytesSent || 0;
                        const fps = report.framesPerSecond || 0;

                        stats.forEach(codecReport => {
                            if (codecReport.id === codecId && codecReport.mimeType) {
                                const codec = codecReport.mimeType.split('/')[1] || 'unknown';

                                const videoTrack = this.localStream?.getVideoTracks()[0];
                                const settings = videoTrack?.getSettings() || {};
                                const res = settings.width ? `${settings.width}x${settings.height}` : '';

                                this.updateStatus(`스트리밍 중! (${codec.toUpperCase()})`, 'success');

                                if (this.codecInfo) {
                                    this.codecInfo.innerHTML =
                                        `<span style="color:#4CAF50">●</span> <strong>${codec.toUpperCase()}</strong> | ${res} | ${Math.round(bytesSent/1024)}KB | ${Math.round(fps)}fps`;
                                }
                            }
                        });
                    }
                });
            } catch (e) {
                console.warn('코덱 확인 실패:', e);
            }
        };

        // 반복 체크
        check();
        setInterval(check, 3000);
    }

    stopStreaming() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.localVideo.srcObject = null;
        this.isStreaming = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.updateStatus('스트리밍 중지됨', 'info');
        this.checkSupportedCodecs(); // 코덱 정보 복원
    }
}

// 초기화
const sender = new VideoSender();
