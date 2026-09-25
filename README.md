# festival_SWing — 주점 주문 관리 시스템

축제 주점 운영을 위한 실시간 주문·주방·타이머 관리 웹앱.  
모바일 LTE 환경 최적화, 1~40번 테이블 지원.

---

## 서비스 접속 주소

| 대상 | URL |
|---|---|
| 손님 예약 | https://festival-swing.duckdns.org/reserve |
| 운영자 전체 | https://festival-swing.duckdns.org |
| 매출 (비공개) | https://festival-swing.duckdns.org/stats |

---

## 목차

1. [기술 스택](#기술-스택)
2. [인프라 구축 이력](#인프라-구축-이력)
3. [기능 구현 이력](#기능-구현-이력)
4. [트러블슈팅 기록](#트러블슈팅-기록)
5. [운영 설정 변경 이력](#운영-설정-변경-이력)
6. [성능 측정 결과](#성능-측정-결과)
7. [서버 운영 가이드](#서버-운영-가이드)
8. [주요 파일](#주요-파일)

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | React 18, Vite, React Router v6 |
| 백엔드 | Node.js, Express, Socket.io |
| 상태 영속성 | 인메모리 + JSON 파일 (`/home/ubuntu/data/state.json`) |
| 프로세스 관리 | PM2 (fork mode, startup 등록) |
| 리버스 프록시 | Nginx (WebSocket 지원, 86400s timeout) |
| SSL | ZeroSSL (acme.sh DNS-01 방식, 자동 갱신) |
| 인프라 | AWS EC2 t3.micro (ap-northeast-2c), Ubuntu 24.04 |
| 도메인 | DuckDNS — festival-swing.duckdns.org |
| Elastic IP | 13.125.114.50 |

---

## 인프라 구축 이력

### 1단계 — AWS EC2 + Nginx + PM2

- t3.micro 인스턴스 생성 (ap-northeast-2c 서울 리전)
- Ubuntu 24.04 + Node.js 22 설치
- PM2로 서버 프로세스 관리 및 부팅 자동 시작 등록
- Nginx 리버스 프록시 설정 (HTTP 3002 → HTTPS 443 포워딩)
- WebSocket 업그레이드 헤더 (`Upgrade`, `Connection`) 추가
- Nginx `proxy_read_timeout 86400s` — Socket.io 장기 연결 유지

### 2단계 — SSL 인증서 (ZeroSSL + acme.sh)

- acme.sh DNS-01 방식으로 ZeroSSL 인증서 발급
- DuckDNS TXT 레코드 자동 생성으로 도메인 소유권 인증
- 인증서 경로: `/home/ubuntu/.acme.sh/festival-swing.duckdns.org_ecc/`
- 갱신 명령: `acme.sh --renew -d festival-swing.duckdns.org --force && sudo systemctl reload nginx`

### 3단계 — 보안 그룹 설정

- 초기: SSH 포트 22를 특정 IP로 제한 → IP 변경 시마다 편집 필요
- **조치**: SSH 소스를 `0.0.0.0/0`으로 변경 (`.pem` 키 인증이 실질적 보안 담당)
- HTTP(80), HTTPS(443), 소켓 포트(3002) 인바운드 허용

### 4단계 — Swap 추가

- t3.micro 기본 Swap: 0 (없음)
- 부하 테스트 결과 50 클라이언트 피크 시 여유 RAM 102MB — OOM Kill 위험 확인
- **조치**: Swap 512MB 추가 및 `/etc/fstab` 등록으로 재부팅 후에도 유지

```bash
sudo fallocate -l 512M /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 기능 구현 이력

### v0 — 기초 시스템

- Express + Socket.io 기반 실시간 서버 구축
- 인메모리 상태 관리 + `state.json` 파일 영속성 (PM2 재시작 후 복원)
- 주문서 / 주방 / 테이블 현황 / 설정 탭 기본 구현
- 1~40번 테이블 그리드 뷰 (파란 테두리: 이용 중, 빨간 테두리: 시간 초과)
- 타이머 카운트다운 (기본 90분 → 후에 120분으로 변경)
- 메뉴 품절 토글 (설정 탭 → 주문서 즉시 반영)
- PM2 startup 등록으로 EC2 재부팅 시 자동 복구

### v1 — 모바일 최적화 및 연결 안정성

- Socket.io `pingTimeout: 60000 / pingInterval: 25000` 조정
- `reconnectionDelayMax: 10000` — LTE 환경 재연결 최적화
- 반응형 CSS — 모바일 / 태블릿 / 데스크톱 레이아웃

### v2 — 주문 안전성 개선

**문제**: 입금 확인 모달에서 주문 완료 클릭 시 즉시 연결이 끊기는 현상  
**원인**: `state.menu.map(...)` → `state.menu`가 `undefined`라 TypeError 발생 → PM2 재시작 → 전체 클라이언트 강제 종료  
**수정**: `MENU_LIST.map(...)` (import된 상수 사용)

**중복 주문 방지 (submitId)**
- 주문 완료 클릭 시 `submitId` 생성 (모달 열릴 때 1회 생성, `useRef`로 고정)
- 서버에서 최근 100건 submitId 캐시 → 재연결 후 재시도해도 중복 차단
- Socket ack가 도착하지 않으면 `isSubmitting` stuck 상태 방지: 연결 끊김 시 `useEffect`로 즉시 리셋

```js
useEffect(() => {
  if (!connected) setIsSubmitting(false);
}, [connected]);
```

### v3 — 매뉴얼 탭 + 메뉴 개편

- 매뉴얼 탭(`/manual`) 추가: 자릿세 규정, 최소 주문 기준, 탭별 사용법·주의사항
- 세트 메뉴 4종 삭제 → 메뉴 단순화
- 콘치즈·오지치즈 후라이 카테고리 변경: 메인 → 사이드
- 닭강정·제육·소세지 나초 가격: 15,000원 → 18,000원
- 매출 탭 nav에서 제거 (URL 직접 접속 `/stats` 으로만 접근)
- 시간 초과 테이블 재주문 시 타이머 자동 재시작 (기존: 추적 불가)

### v4 — 예약 시스템

- 손님 예약 전용 화면 `/reserve` (헤더·탭 없음, QR 코드 배포용)
- 운영자 예약 관리 탭 `/reservations`
  - 실시간 예약 목록 (접수순 정렬)
  - 수기 등록: 이름·전화번호·인원 입력 후 즉시 추가
  - 전화하기 버튼 (`tel:` 링크)
  - 삭제 확인 모달 (이름·전화번호 표시 후 2단계 삭제)
- 반응형 레이아웃: 데스크톱(4열 폼, 카드 가로) / 모바일(1열 폼, 카드 세로)
- 모바일 가로 오버플로우 수정: CSS Grid `min-width: 0; width: 100%`

### v5 — 테이블 현황 고도화

**입금자 추적**
- 주문서에 입금자 입력 필드 추가
- 테이블 상태에 `depositor`, `depositors` 저장
- 복수 입금자: 이름이 다를 경우 `,`로 연결하여 테이블 카드에 표시 (중복 제외)

**누적 금액**
- 테이블별 `totalAmount` 누적 (주문마다 합산)
- 테이블 카드에 누적 금액 표시 → 송금 금액 크로스체크 용도

**주문 내역 모달**
- 테이블 카드 우상단 **내역** 버튼
- 모달: 주문 회차별 품목·소계, 하단 누적 합계
- 테이블 해제(✕) 시 orderHistory 함께 초기화

**UI 개선**
- 테이블 카드 헤더 2행 구조 개편: `[N번 · 내역 · ✕]` 한 줄 → `[N번 내역 ✕] / [이용 중]` 2행으로 분리 (요소 겹침 해결)
- 그리드 8열 고정 (`repeat(8, 1fr)`)
- 컨테이너 최대폭 1100px → 1600px (노트북 화면 최대 활용)

**연장 기능 제거**
- 테이블 연장(+연장) 버튼 및 `system:extend` 서버 핸들러 삭제
- 설정 탭 연장 시간 설정 UI 제거

---

## 트러블슈팅 기록

| # | 현상 | 원인 | 해결 |
|---|---|---|---|
| 1 | 주문 완료 시 전체 클라이언트 연결 끊김 | `state.menu.map()` → TypeError (state.menu가 undefined) → PM2 재시작 | `MENU_LIST.map()`으로 교체 |
| 2 | "처리 중…" + "연결이 끊겼습니다" 동시 표시 | 소켓 ack가 도착 못해 `isSubmitting=true` 고착 | 연결 끊김 감지 시 `isSubmitting` 강제 리셋 |
| 3 | 시간 초과 테이블 재주문 시 타이머 추적 불가 | 초과 상태에서 새 주문이 와도 `timerStartedAt` 갱신 안 됨 | 초과 상태 확인 후 `timerStartedAt = Date.now()`, `bonusLimitMinutes = 0` 리셋 |
| 4 | 모바일 예약 폼 가로 화면 오버플로우 | CSS Grid 아이템 기본 `min-width: auto` → 컨테이너 초과 | `min-width: 0; width: 100%` 적용 |
| 5 | 테이블 카드 헤더 요소 겹침 | 번호·상태·내역·✕ 4개가 한 줄에 들어가 번호 줄바꿈 | 헤더를 2행으로 분리 (1행: 번호+버튼, 2행: 상태) |
| 6 | SSH 접속 불가 (매번 IP 변경) | 보안 그룹 port 22 소스가 고정 IP로 설정됨 | 소스를 `0.0.0.0/0`으로 변경 (pem 키 인증으로 보안 유지) |
| 7 | state.json에 90분이 저장되어 코드 변경(120분)이 무시됨 | 서버 로드 시 파일 값이 기본값을 덮어씀 | EC2에서 state.json 직접 수정 후 PM2 재시작 |
| 8 | 자릿세 메뉴 위치 | MENU_LIST 배열 맨 마지막에 위치 → 주문서 맨 아래 표시 | MENU_LIST 배열 순서 변경으로 맨 위로 이동 |

---

## 운영 설정 변경 이력

| 항목 | 초기값 | 변경값 | 사유 |
|---|---|---|---|
| 기본 타이머 | 90분 | **120분** | 2시간 운영 기준 |
| 닭강정 가격 | 15,000원 | **18,000원** | 원가 반영 |
| 제육 가격 | 15,000원 | **18,000원** | 원가 반영 |
| 소세지 나초 가격 | 15,000원 | **18,000원** | 원가 반영 |
| 세트 메뉴 | 4종 운영 | **삭제** | 운영 단순화 |
| 콘치즈 카테고리 | 메인 | **사이드** | 메뉴 분류 재정비 |
| 오지치즈 후라이 카테고리 | 메인 | **사이드** | 메뉴 분류 재정비 |
| 테이블 연장 기능 | 있음 | **제거** | 운영 정책 변경 |
| 그리드 열 수 | auto (5~6열) | **8열 고정** | 노트북 화면 최적화 |

---

## 성능 측정 결과

> 40개 테이블 시뮬레이션 데이터 로드 상태에서 측정 (2025-05-21)

### 베이스라인 (유휴 상태)

| 항목 | 값 |
|---|---|
| CPU | 0% (100% idle) |
| RAM 사용 | 400MB / 911MB |
| Node.js RSS | 72MB |
| TCP ESTABLISHED | 5개 |

### 부하 테스트 결과

| 항목 | 30 클라이언트 | 50 클라이언트 |
|---|---|---|
| 연결 성공률 | **100%** (30/30) | **100%** (50/50) |
| 연결 오류 | 0 | 0 |
| 주문 ack 성공률 | 100% | 100% |
| 평균 응답 지연 | **16ms** | **54ms** |
| p95 응답 지연 | ~20ms | **129ms** |
| 최대 응답 지연 | 23ms | 165ms |
| 피크 RAM 사용 | 421MB | **465MB** |
| 피크 여유 RAM | 490MB | **102MB** |
| Node.js RSS | 73.8MB | 74.5MB |
| state 브로드캐스트 | 930회 | 2,550회 |
| PM2 비정상 재시작 | 0 | 0 |

### 실제 운영 예상 동시 접속

| 역할 | 기기 수 |
|---|---|
| 주문서 (서빙) | 3~5대 |
| 주방 디스플레이 | 1~2대 |
| 테이블 현황 | 1~2대 |
| 손님 예약 QR 피크 | 5~10명 |
| **합계** | **약 15~20개** |

→ 30 클라이언트 결과(16ms, 여유 RAM 490MB) 기준 충분한 여유. **t3.micro로 운영 가능 판정.**

### 리스크 및 조치

| 리스크 | 조치 |
|---|---|
| Swap 부재 → OOM Kill 위험 | **Swap 512MB 추가 완료** (`/etc/fstab` 영구 등록) |
| orderHistory 무한 누적 | 테이블 해제 시 초기화됨 (회차당 수 KB 수준, 실운영 무관) |

---

## 서버 운영 가이드

### 일상 운영 명령

```bash
# EC2 접속
ssh -i ~/festival-swing-key.pem ubuntu@13.125.114.50

# 서버 상태 확인
pm2 status

# 서버 재시작
pm2 restart festival

# 실시간 로그 확인
pm2 logs festival --lines 50

# Nginx 상태
sudo systemctl status nginx
```

### 비상 대응

| 상황 | 조치 |
|---|---|
| 앱 응답 없음 | `pm2 restart festival` |
| 페이지 열리지 않음 | `sudo systemctl restart nginx` |
| EC2 재부팅 후 | 자동 복구 (PM2 startup + Nginx systemd 등록됨) |
| 주문 데이터 유실 우려 | `state.json` 자동 저장 (`/home/ubuntu/data/state.json`) |
| SSL 인증서 만료 | `~/.acme.sh/acme.sh --renew -d festival-swing.duckdns.org --force && sudo systemctl reload nginx` |
| 메모리 과다 사용 | `free -h` 확인 후 `pm2 restart festival` |

### 행사 당일 체크리스트

```
[ ] EC2 인스턴스 시작 확인 (중지 상태면 AWS 콘솔에서 시작)
[ ] pm2 status → festival online 확인
[ ] https://festival-swing.duckdns.org 브라우저 접속 확인
[ ] 설정 탭 → 기본 제한 시간 확인 (120분)
[ ] 설정 탭 → 품절 메뉴 사전 처리
[ ] 전체 초기화 탭 → 이전 데이터 정리
[ ] 각 테이블 QR 코드 부착 (→ /reserve)
```

### 로컬 개발 → EC2 배포

SSH 키(`festival-swing-key.pem`)는 EC2 인스턴스 생성 시 AWS에서 한 번만 내려받을 수 있습니다(재다운로드 불가).
WSL에서는 `/mnt/c/...`의 파일 권한을 제한할 수 없어 ssh가 거부하므로, 최초 1회 홈으로 복사해 권한을 설정합니다.

```bash
# 0-1. (최초 1회) 키를 WSL 홈으로 복사 후 권한 설정
cp /mnt/c/Users/<윈도우사용자>/Downloads/festival-swing-key.pem ~/
chmod 400 ~/festival-swing-key.pem

# 0-2. 배포 전 상태 파일 백업
ssh -i ~/festival-swing-key.pem ubuntu@13.125.114.50 \
  'cp /home/ubuntu/data/state.json /home/ubuntu/data/state.json.bak-$(date +%m%d-%H%M)'

# 1. 빌드
npm run build

# 2. 정적 파일 배포
rsync -av -e "ssh -i ~/festival-swing-key.pem" --delete \
  dist/ ubuntu@13.125.114.50:/home/ubuntu/festival_SWing/dist/

# 3. 서버 파일 배포 (-R: server/, shared/ 폴더 구조 유지 — 없으면 최상위에 평탄화되어 복사됨)
rsync -avR -e "ssh -i ~/festival-swing-key.pem" \
  server/index.js shared/menu.js \
  ubuntu@13.125.114.50:/home/ubuntu/festival_SWing/

# 4. 재시작 + 로그 확인
ssh -i ~/festival-swing-key.pem ubuntu@13.125.114.50 \
  "pm2 restart festival && pm2 logs festival --lines 20 --nostream"
```

배포 후 이미 열려 있는 운영 기기(주방·테이블 현황 등)는 새로고침합니다.

### 배포 구조

```
[브라우저] ──HTTPS 443──▶ [Nginx]
                               │ HTTP 3002 (WebSocket Upgrade)
                               ▼
                     [Node.js + Socket.io]  ← PM2 관리
                               │ 상태 변경마다 broadcastState()
                               ▼
                     [state.json]  /home/ubuntu/data/state.json
```

---

## 주요 파일

| 파일 | 설명 |
|---|---|
| `server/index.js` | Express + Socket.io 서버, 소켓 이벤트 핸들러, 상태 관리 |
| `shared/menu.js` | 메뉴 목록 정의 (메뉴 변경 시 이 파일만 수정) |
| `src/pages/OrderPage.jsx` | 주문서 탭 (submitId 중복 방지, 입금자 입력) |
| `src/pages/KitchenPage.jsx` | 주방 탭 |
| `src/pages/SystemPage.jsx` | 테이블 현황 탭 (타이머, 내역 모달) |
| `src/pages/SettingsPage.jsx` | 설정 탭 (타이머·품절) |
| `src/pages/StatsPage.jsx` | 매출 탭 (URL 직접 접속 전용) |
| `src/pages/ReservePage.jsx` | 손님 예약 화면 (`/reserve`, QR 배포용) |
| `src/pages/ReservationsPage.jsx` | 운영자 예약 관리 탭 |
| `src/pages/ManualPage.jsx` | 서버 매뉴얼 탭 |
| `src/context/SocketContext.jsx` | Socket.io 클라이언트 전역 컨텍스트 |
| `src/index.css` | 전체 스타일 (다크 테마, 반응형) |
| `ecosystem.config.cjs` | PM2 설정 |
| `nginx.conf` | Nginx 리버스 프록시 + SSL 설정 |
