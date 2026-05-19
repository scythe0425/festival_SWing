# festival_SWing — 주점 주문 관리 시스템

축제 주점 운영을 위한 실시간 주문·주방·매출 관리 웹앱.  
Socket.io 기반 실시간 동기화, 모바일 LTE 환경 최적화.

---

## 서비스 정보

| 항목 | 값 |
|---|---|
| 서비스 URL | https://festival-swing.duckdns.org |
| 손님 주문 URL | https://festival-swing.duckdns.org/reserve |
| 서버 | AWS EC2 t3.micro (서울, ap-northeast-2c) |
| 도메인 | DuckDNS (festival-swing.duckdns.org → 13.125.114.50) |

---

## URL별 역할

| URL | 대상 | 설명 |
|---|---|---|
| `/reserve` | 손님 | 메뉴 선택 및 주문 |
| `/` | 운영자 | 주문서 (테이블별 주문 현황) |
| `/kitchen` | 주방 | 조리 대기/완료 처리 |
| `/system` | 운영자 | 품절 설정 등 시스템 관리 |
| `/stats` | 운영자 | 매출 통계 |
| `/reservations` | 운영자 | 예약 목록 |
| `/reset` | 운영자 | 전체 데이터 초기화 |

---

## 행사 당일 — 서버 시작

### 1. EC2 접속

```bash
ssh -i ~/festival-swing-key.pem ubuntu@13.125.114.50
```

### 2. 서버 상태 확인

```bash
pm2 status
```

`festival` 앱이 `online` 상태이면 별도 조치 불필요.  
`stopped` 또는 목록에 없으면 아래 명령 실행:

```bash
cd ~/festival_SWing
pm2 start ecosystem.config.cjs
```

### 3. Nginx 상태 확인

```bash
sudo systemctl status nginx
```

`active (running)` 상태이면 정상. 아니면:

```bash
sudo systemctl start nginx
```

### 4. 서비스 확인

브라우저 또는 기기에서 https://festival-swing.duckdns.org 접속 → 페이지 로드 확인.

---

## 행사 당일 — 운영 절차

### 시작 전

1. 운영자 기기에서 https://festival-swing.duckdns.org 접속
2. `/system` 에서 품절 메뉴 설정
3. 손님 QR 코드 부착 (URL: https://festival-swing.duckdns.org/reserve)

### 영업 중

- **손님**: 스마트폰으로 QR 스캔 → `/reserve` 에서 메뉴 선택 후 주문
- **주방**: `/kitchen` 에서 주문 확인 → 조리 완료 시 완료 처리
- **운영자**: `/` (주문서) 에서 테이블별 현황 실시간 확인

### 영업 종료

1. `/stats` 에서 매출 최종 확인 (스크린샷 보관 권장)
2. `/reset` 에서 전체 초기화 (다음 행사 대비)

---

## 비상 상황 대응

### 서버가 응답하지 않을 때

```bash
ssh -i ~/festival-swing-key.pem ubuntu@13.125.114.50
pm2 restart festival
```

재시작 후 state.json에서 데이터 자동 복원됨.

### Nginx가 내려갔을 때

```bash
sudo systemctl restart nginx
```

### 서버 재부팅 후 자동 복구

PM2 startup 등록이 완료되어 있어 EC2 재시작 시 자동으로 서버가 올라옴.  
Nginx도 systemd 기본 설정으로 자동 시작.

### 인증서 만료

acme.sh 크론잡이 자동 갱신 처리 (만료 30일 전 갱신 시도).  
수동 갱신이 필요하면:

```bash
~/.acme.sh/acme.sh --renew -d festival-swing.duckdns.org --force
sudo systemctl reload nginx
```

---

## 로컬 개발 환경

### 사전 준비

- Node.js 18+
- npm

### 설치 및 실행

```bash
npm install
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드: http://localhost:3002

### 프로덕션 빌드

```bash
npm run build
node server/index.js
```

---

## 배포 구조

```
[손님/운영자 브라우저]
        │ HTTPS (443)
        ▼
[Nginx — festival-swing.duckdns.org]
        │ HTTP (3002)
        ▼
[Node.js + Socket.io — PM2 관리]
        │
        ▼
[state.json — /home/ubuntu/data/state.json]
```

- SSL 인증서: ZeroSSL (acme.sh DNS-01, `/etc/ssl/festival/`)
- 상태 파일: PM2 재시작 시에도 주문 데이터 유지
- WebSocket 연결 유지: pingTimeout 60초, 재연결 딜레이 최대 10초

---

## 주요 파일

| 파일 | 설명 |
|---|---|
| `server/index.js` | Express + Socket.io 서버 |
| `shared/menu.js` | 메뉴 목록 (수정 시 여기만 변경) |
| `ecosystem.config.cjs` | PM2 설정 |
| `nginx.conf` | Nginx 리버스 프록시 설정 |
| `src/pages/` | 각 화면 컴포넌트 |
