# 🎵 MIML — Music Is My Life

자연어로 지금 기분을 말하면, AI가 어울리는 음악을 추천해주는 서비스.

> "요즘 좀 지쳐있어서 조용하고 따뜻한 노래 듣고 싶어"  
> → 에너지 낮고 어쿠스틱한 감성의 곡들을 추천

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Language | Kotlin |
| Framework | Spring Boot 3.x |
| Database | MySQL (AWS RDS) |
| 인증 | Firebase Authentication |
| 플레이리스트 저장 | Firestore |
| 배포 | AWS EC2 (Amazon Linux 2023, Java 17) |
| 외부 API | Spotify, Last.fm, OpenAI (GPT-4o-mini, text-embedding-3-small), SoundNet (RapidAPI) |

---

## 프로젝트 구조

```
backend/
└── src/main/kotlin/com/miml/backend/
    ├── client/         # 외부 API 클라이언트 (Spotify, OpenAI, Last.fm, SoundNet)
    ├── config/         # Firebase, Security, WebClient 설정
    ├── controller/     # REST API 엔드포인트
    ├── dto/            # 요청/응답 데이터 클래스
    ├── entity/         # JPA 엔티티 (Music, AudioFeatures, MusicTag, User 등)
    ├── repository/     # Spring Data JPA 레포지토리
    ├── Security/       # Firebase 인증 필터
    └── service/        # 핵심 비즈니스 로직
```

---

## 핵심 기능

### 1. 음악 데이터 파이프라인
- Spotify에서 사용자의 좋아요 곡을 일괄 import
- SoundNet(RapidAPI)으로 각 곡의 음향 수치(energy, happiness, danceability, acousticness, tempo) 분석 및 저장
- Last.fm으로 아티스트별 장르 태그 수집
- OpenAI `text-embedding-3-small`로 태그 벡터 생성

### 2. AI 추천 알고리즘 (`SmartRecommendationService`)
1. GPT-4o-mini가 자연어 입력을 분석해 오디오 피처 수치 + 장르 필터 추출
2. 유저 청취 프로필과 지정 비율(profileRatio)로 블렌딩
3. 오디오 범위 필터 + 태그 임베딩 코사인 유사도로 후보 풀 추출
4. 장르 pre-filter (사용자가 장르를 명시한 경우에만 적용)
5. 오디오 거리 점수 → 태그 커버리지 점수 순으로 최종 순위 결정
6. 아티스트 중복 제한(최대 2곡/아티스트) + 가중 샘플링

### 3. 피드백 기반 프로필 학습
- 좋아요/싫어요 피드백으로 유저의 오디오 피처 프로필 점진적 업데이트
- 무드 피드백으로 세부 분위기 선호도 반영

---

## API 엔드포인트

모든 API는 Firebase Auth 토큰(`Authorization: Bearer <token>`) 필요.

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/recommend/smart` | 자연어 기반 음악 추천 |
| `POST` | `/api/feedback/satisfaction` | 좋아요/싫어요 피드백 |
| `POST` | `/api/feedback/mood` | 무드 피드백 |
| `GET` | `/api/user/me` | 유저 프로필 조회 |
| `POST` | `/api/spotify/import/liked` | Spotify 좋아요 곡 import |
| `GET` | `/api/hello` | 서버 상태 확인 (인증 불필요) |

---

## 로컬 실행 방법

### 1. 환경변수 설정

`.env` 파일을 생성하거나 환경변수로 아래 값들을 설정:

```env
DB_HOST=localhost
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

OPENAI_API_KEY=your_openai_api_key
LASTFM_API_KEY=your_lastfm_api_key
RAPIDAPI_KEY=your_rapidapi_key
```

### 2. Firebase 설정

`backend/src/main/resources/firebase-service-account.json.example`을 복사해 `firebase-service-account.json`으로 저장한 뒤 실제 값 입력:

```bash
cp src/main/resources/firebase-service-account.json.example \
   src/main/resources/firebase-service-account.json
```

### 3. 빌드 및 실행

```bash
cd backend
./gradlew bootRun
```

---

## 데이터베이스 스키마

주요 테이블:

| 테이블 | 설명 |
|--------|------|
| `music` | 곡 메타데이터 (title, artist, album, spotifyId, albumImageUrl) |
| `audio_features` | 음향 수치 (energy, happiness, danceability, acousticness, tempo) |
| `music_tags` | 커뮤니티 태그 + voteCount |
| `artist_genres` | Last.fm 장르 데이터 |
| `users` | Firebase UID 기반 유저 + 오디오 피처 프로필 |

플레이리스트는 Firestore에 스냅샷으로 저장 (MySQL 변경에 독립적).
