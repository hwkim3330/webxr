# 클라우드 시그널링 서버 배포 가이드

외부망(LTE/WAN)에서 사용하려면 시그널링 서버를 클라우드에 배포해야 합니다.

## 방법 1: Glitch (가장 간단, 무료)

### 1단계: Glitch 계정 생성
- https://glitch.com 접속
- GitHub 계정으로 로그인

### 2단계: 새 프로젝트 생성
1. "New Project" → "glitch-hello-node" 선택
2. 프로젝트 이름 변경 (예: `my-webxr-signal`)

### 3단계: 파일 업로드
1. 왼쪽 파일 목록에서 기존 파일 삭제
2. 다음 파일들을 복사/붙여넣기:
   - `package.json` (dependencies 부분만)
   - `server-cloud.js` → `server.js`로 이름 변경

### 4단계: package.json 수정
```json
{
  "name": "webxr-signaling",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "cors": "^2.8.5"
  }
}
```

### 5단계: 자동 배포
- Glitch가 자동으로 `npm install` 실행
- 상단에 "Show" 버튼 클릭 → 서버 주소 확인
- 예: `https://my-webxr-signal.glitch.me`

---

## 방법 2: Railway (무료 500시간/월)

### 1단계: Railway 가입
- https://railway.app 접속
- GitHub 계정으로 로그인

### 2단계: 프로젝트 배포
1. "New Project" → "Deploy from GitHub repo"
2. 또는 "Empty Project" → "Add New Service" → "GitHub Repo"

### 3단계: 환경 변수 설정 (필요시)
```
PORT=3000
```

### 4단계: 배포 완료
- Railway가 자동으로 배포
- 도메인 주소 제공 (예: `my-app.up.railway.app`)

---

## 방법 3: Render (무료)

### 1단계: Render 가입
- https://render.com 접속
- GitHub 계정으로 로그인

### 2단계: Web Service 생성
1. "New" → "Web Service"
2. GitHub 저장소 연결
3. 설정:
   - **Build Command**: `npm install`
   - **Start Command**: `node server-cloud.js`

### 3단계: 배포 완료
- 자동 배포 후 URL 제공
- 예: `https://my-webxr.onrender.com`

---

## 클라이언트 설정 변경

배포 후 **sender.html**과 **receiver.html**에서 WebSocket 주소를 수정하세요.

### 기존 코드 (내부망용):
```javascript
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
ws = new WebSocket(`${protocol}//${location.host}?role=sender`);
```

### 변경 코드 (클라우드용):
```javascript
// Glitch 예시
const SIGNAL_SERVER = 'wss://my-webxr-signal.glitch.me';
ws = new WebSocket(`${SIGNAL_SERVER}?role=sender`);
```

⚠️ **HTTPS 사이트에서는 반드시 `wss://` (Secure WebSocket) 사용!**

---

## 자동 모드 전환 (권장)

클라이언트가 자동으로 내부망/외부망을 감지하도록 설정:

```javascript
function connectWebSocket() {
  // 로컬 개발 또는 내부망
  if (location.hostname === 'localhost' || location.hostname.startsWith('192.168.')) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}?role=sender`);
  }
  // 외부망 (클라우드 서버 사용)
  else {
    const CLOUD_SERVER = 'wss://my-webxr-signal.glitch.me';
    ws = new WebSocket(`${CLOUD_SERVER}?role=sender`);
  }
}
```

---

## 테스트

### 내부망 테스트:
```
송신자: http://192.168.1.100:3000/sender.html
수신자: http://192.168.1.100:3000/receiver.html
```

### 외부망 테스트:
1. HTML 파일을 GitHub Pages나 Netlify에 올리기
2. 또는 클라우드 서버의 `/public` 폴더에 올리기
3. 스마트폰/VR 헤드셋으로 접속

```
송신자: https://your-site.com/sender.html
수신자: https://your-site.com/receiver.html
```

---

## 문제 해결

### WebSocket 연결 실패
- 클라우드 서버 URL이 정확한지 확인
- `wss://` (HTTPS용) vs `ws://` (HTTP용) 구분
- 브라우저 개발자 도구(F12) → Console 확인

### STUN 서버 연결 실패
- 방화벽에서 UDP 포트 열림 확인
- 구글 STUN 서버가 차단되었다면 다른 서버 사용:
  ```javascript
  { urls: 'stun:stun.stunprotocol.org:3478' }
  ```

### ICE 연결 실패 (relay 필요)
- 일부 네트워크는 STUN만으로 부족
- TURN 서버 필요 (유료) - Twilio, Cloudflare 등

---

## 비용

| 서비스 | 무료 제공 | 제한 |
|--------|-----------|------|
| **Glitch** | ✅ 무제한 | 5분 비활성시 sleep, 프로젝트당 월 1000시간 |
| **Railway** | ✅ 500시간/월 | 5$/월 초과시 과금 |
| **Render** | ✅ 750시간/월 | 15분 비활성시 sleep |
| **Heroku** | ❌ 무료 폐지 | 최소 5$/월 |

**추천**: Glitch (프로토타입용) → Railway/Render (프로덕션용)
