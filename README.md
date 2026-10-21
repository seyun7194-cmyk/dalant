# 무순 키우기 관찰기 웹앱 — GitHub + Vercel 배포 가이드

기존 구글 앱스 스크립트 버전을 **GitHub에 저장하고 Vercel로 배포**할 수 있게 바꾼 버전입니다.
화면과 사용 방법(학생/교사 로그인, 하루 1회 기록, 교사별 구글 시트·사진 폴더 자동 생성)은 그대로이고,
**데이터는 여전히 구글 시트와 구글 드라이브에 저장**됩니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `api/rpc.js` | 서버 로직 (기존 `Code.gs`). 구글 시트·드라이브 API로 로그인, 학생 등록, 기록 저장/조회 |
| `public/index.html` | 첫 화면 — 학생/교사 로그인, 교사 회원가입 (기존 `Login.html`) |
| `public/student.html` | 학생 화면 (기존 `Student.html`) |
| `public/teacher.html` | 교사 화면 (기존 `Teacher.html`) |
| `public/style.css` | 공통 디자인 (기존 `Stylesheet.html`) |
| `public/shared.js` | 공통 자바스크립트 (기존 `SharedScript.html`) |
| `package.json` / `vercel.json` | Vercel 배포 설정 |

## 앱스 스크립트 버전과 달라진 점

- 주소가 `.../exec` 대신 `https://프로젝트이름.vercel.app` 이 되고, 화면 주소는 `/`, `/student.html`, `/teacher.html` 입니다.
- 마스터 스프레드시트의 `교사계정`, `학생명단` 탭은 **처음 접속할 때 자동으로 만들어집니다.** (`initializeSpreadsheet` 실행 불필요)
- 비밀번호 해시 방식(SHA-256)이 같아서, **기존 마스터 스프레드시트와 계정을 그대로 이어서 쓸 수 있습니다.**
- 코드를 고치면 GitHub에 push만 하면 Vercel이 자동으로 다시 배포합니다. (앱스 스크립트의 "새 버전 배포" 과정이 필요 없음)

## 1. 구글 쪽 준비 (최초 1회)

앱스 스크립트는 "실행 계정: 나"로 선생님 계정 권한을 바로 썼지만, Vercel에서는 그 권한을 직접 연결해 줘야 합니다.

### 1-1. 마스터 스프레드시트 준비
1. 구글 드라이브에서 새 스프레드시트를 만듭니다. (이름 예: `무순앱_마스터`) — 기존 것을 써도 됩니다.
2. 주소창의 `https://docs.google.com/spreadsheets/d/`**`이_부분`**`/edit` 이 긴 문자열이 `MASTER_SHEET_ID` 입니다. 복사해 두세요.

### 1-2. 구글 클라우드에서 API 켜고 인증 정보 만들기
1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트를 만듭니다.
2. **API 및 서비스 → 라이브러리**에서 `Google Sheets API`와 `Google Drive API`를 각각 **사용 설정**합니다.
3. **API 및 서비스 → OAuth 동의 화면**
   - 사용자 유형: **외부**, 앱 이름·이메일 등 필수 항목만 입력
   - 게시 상태를 **"프로덕션으로 푸시(앱 게시)"** 로 바꿉니다.
     (테스트 상태로 두면 **7일마다 토큰이 만료**되어 앱이 멈춥니다. 본인만 쓰는 앱은 게시해도 심사가 필요 없고, 로그인할 때 "확인되지 않은 앱" 경고만 뜹니다.)
4. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 리디렉션 URI**에 `https://developers.google.com/oauthplayground` 추가
   - 만들어지면 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사해 둡니다.

### 1-3. Refresh Token 발급
1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)를 엽니다.
2. 오른쪽 위 톱니바퀴(⚙) → **Use your own OAuth credentials** 체크 → 위에서 만든 클라이언트 ID/보안 비밀번호 입력
3. 왼쪽 입력칸에 아래 두 줄을 입력하고 **Authorize APIs**
   ```
   https://www.googleapis.com/auth/spreadsheets
   https://www.googleapis.com/auth/drive
   ```
4. 데이터를 저장할 **선생님 구글 계정**으로 로그인해 허용합니다. ("확인되지 않은 앱" 화면에서는 고급 → 이동)
5. **Exchange authorization code for tokens** 를 누르면 나오는 **Refresh token** 을 복사합니다.

> 모든 교사의 기록 시트와 사진은 이 계정의 구글 드라이브에 만들어집니다. (앱스 스크립트 버전의 "대표 선생님 1명의 드라이브"와 같은 구조)

## 2. GitHub에 올리기

```bash
cd musun-vercel
git init
git add .
git commit -m "무순 관찰기 Vercel 버전"
git branch -M main
git remote add origin https://github.com/내아이디/저장소이름.git
git push -u origin main
```

`.env`, `node_modules`는 `.gitignore`로 제외되어 있습니다. **인증 정보는 절대 GitHub에 올리지 마세요.**
(저장소는 Private으로 만드는 것을 권장합니다.)

## 3. Vercel로 배포하기

1. [vercel.com](https://vercel.com)에 GitHub 계정으로 로그인 → **Add New → Project** → 방금 올린 저장소 **Import**
2. 설정은 기본값 그대로 두고(Framework Preset: Other), **Environment Variables**에 아래 4개를 입력합니다.

   | 이름 | 값 |
   |---|---|
   | `GOOGLE_CLIENT_ID` | 1-2에서 복사한 클라이언트 ID |
   | `GOOGLE_CLIENT_SECRET` | 1-2에서 복사한 보안 비밀번호 |
   | `GOOGLE_REFRESH_TOKEN` | 1-3에서 복사한 Refresh token |
   | `MASTER_SHEET_ID` | 1-1에서 복사한 스프레드시트 ID |
   | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey)에서 발급한 Gemini API 키 (AI 댓글용) |
   | `GEMINI_MODEL` | (선택) 사용할 모델 이름. 비워 두면 `gemini-3.5-flash-lite` |

3. **Deploy**를 누르면 `https://프로젝트이름.vercel.app` 주소가 생깁니다. 이 주소를 학생과 선생님께 공유하세요.
4. 환경변수를 나중에 바꾸면 **Deployments → 최근 배포 → Redeploy** 를 해야 반영됩니다.

## 4. 처음 사용 시작하기

앱스 스크립트 버전과 같습니다.

1. 배포 주소 접속 → **교사** 탭 → **교사 회원가입** (그 교사 전용 구글 시트와 사진 폴더가 자동 생성)
2. 교사 화면에서 학생 계정을 개별/일괄 등록
3. 학생들은 같은 주소에서 **학생** 탭으로 로그인해 매일 기록

## AI 댓글 (Gemini)

- 학생이 기록을 제출하면 서버가 **사진 + 세 가지 글**을 Gemini에 보내 2~3문장의 댓글을 받아, 구글 시트 **J열(`AI 댓글`)** 에 저장합니다.
- 학생은 제출 직후 완료 화면에서 댓글을 보고, 이후 **나의 기록 / 같은 반 기록**에서도 볼 수 있습니다.
- `GEMINI_API_KEY`가 없거나 Gemini 호출이 실패해도 **기록 제출은 정상 완료**되고, 댓글만 비어 있습니다.
- 댓글 말투와 규칙은 `api/rpc.js`의 `COMMENT_SYSTEM_PROMPT`에서 바꿀 수 있습니다.
- 모델 이름이 바뀌거나 종료되면 코드 수정 없이 Vercel의 `GEMINI_MODEL` 값만 바꾸고 Redeploy 하면 됩니다.
- **이미 만들어 둔 교사별 기록 시트**는 J1 칸에 `AI 댓글` 이라고 직접 적어 주세요. (새로 가입하는 교사의 시트는 자동으로 들어갑니다.)

## 알아두어야 할 점

- **AI 댓글과 개인정보**: 학생이 쓴 글과 촬영한 사진이 Gemini(구글)로 전송됩니다. 학생 얼굴 등이 사진에 나오지 않도록 안내하고, 무료 등급의 데이터 이용 조건과 학교의 개인정보 방침을 확인한 뒤 사용하세요.
- **AI 댓글의 한계**: AI가 사진이나 글을 잘못 해석할 수 있으니, 교사가 시트에서 가끔 댓글을 훑어보는 것을 권장합니다.

- **사진 공개 범위**: 사진은 "링크가 있으면 볼 수 있음"으로 저장됩니다. 주소가 외부에 노출되지 않도록 주의하세요.
- **보안 수준**: 학교 내부용 소규모 도구 수준입니다. 로그인 후 서버가 별도의 인증 토큰을 발급하지 않으므로, 실제 개인정보(주민번호 등)는 입력하지 마세요.
- **Vercel 요청 크기 제한**: 요청 본문은 약 4.5MB까지입니다. 사진은 브라우저에서 1024px / JPEG 70%로 압축해 보내므로 문제없습니다.
- **구글 API 사용량**: 한 학급(20~30명, 하루 1회 제출) 규모에서는 무료 할당량 안에서 충분합니다. 여러 학급이 동시에 쓰면 조회 때마다 시트를 읽기 때문에 느려질 수 있습니다.
- **로그인 유지**: 로그인 정보는 브라우저 탭의 세션 저장소에 있어서, 탭을 닫으면 다시 로그인해야 합니다.

## 내 컴퓨터에서 테스트하고 싶다면 (선택)

```bash
npm install
npm i -g vercel
vercel dev
```
프로젝트 폴더에 `.env.example`을 복사한 `.env` 파일을 만들어 값을 채우면 `http://localhost:3000` 에서 확인할 수 있습니다.
