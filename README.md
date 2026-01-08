# 360 VR 실시간 스트리밍

WebRTC + WebXR 기반 P2P 360도 실시간 영상 스트리밍 시스템

## 데모

**GitHub Pages**: https://hwkim3330.github.io/webxr/

## 기능

- 웹캠 영상을 360도 구체에 투영하여 VR로 시청
- P2P 연결 (서버 없이 PeerJS Cloud 사용)
- 코덱 선택 (H.265, VP9, H.264, VP8)
- 해상도/비트레이트 조절
- WebXR 지원 (Galaxy XR, Quest 등)

## 사용법

### 송신자
1. [송신자 페이지](https://hwkim3330.github.io/webxr/sender.html) 접속
2. 룸 ID 확인 (자동 생성됨)
3. 코덱/해상도 선택 후 "스트리밍 시작"
4. 룸 ID를 수신자에게 공유

### 수신자
1. [수신자 페이지](https://hwkim3330.github.io/webxr/receiver.html) 접속
2. 송신자의 룸 ID 입력
3. "연결" 클릭
4. VR 기기에서 "VR 모드" 버튼으로 몰입 모드 진입

## 기술 스택

- **PeerJS**: P2P 시그널링 (Cloud 서버 사용)
- **WebRTC**: 실시간 영상 전송
- **Three.js**: 360도 구체 렌더링
- **WebXR**: VR 지원

## 로컬 개발

```bash
# Node.js 서버 버전 (public 폴더)
npm install
npm start
# http://localhost:3000

# GitHub Pages 버전 (docs 폴더)
# 정적 서버로 docs 폴더 서빙
npx serve docs
```

## 폴더 구조

```
├── docs/              # GitHub Pages용 (PeerJS)
│   ├── index.html
│   ├── sender.html
│   ├── receiver.html
│   └── *.js, *.css
├── public/            # Node.js 서버용
│   └── ...
├── server.js          # WebSocket 시그널링 서버
└── package.json
```

## 주의사항

- HTTPS 필요 (GitHub Pages는 기본 HTTPS)
- PeerJS Cloud는 무료지만 트래픽 제한 있음
- 진정한 360도 영상은 360 카메라 필요
