/**
 * 커뮤니티 후기 일괄 등록 스크립트
 *
 * 사용법:
 *   1. 아래 SEED_DATA에 곡 + 후기 입력
 *   2. EMAIL / PASSWORD에 Firebase 계정 입력
 *   3. node scripts/seed-posts.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ── Firebase 설정 ─────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
  storageBucket: 'miml-af637.firebasestorage.app',
  messagingSenderId: '436334131597',
  appId: '1:436334131597:web:1317900b4847bb39b525c4',
};

const BACKEND_URL = 'http://13.209.228.73:8080';

// ── 로그인 계정 (Firebase Auth) ───────────────────────────────────
const EMAIL    = 'juyean2004@gmail.com';
const PASSWORD = 'my647121';

// ── 등록할 후기 데이터 ────────────────────────────────────────────
const SEED_DATA = [
  {
    spotifyId: '0t1kP63rueHleOhQkYSXFY',
    title: 'Dynamite',
    artist: 'BTS',
    albumImageUrl: null,
    review: '운동할 때 이 노래 없으면 진짜 못 뛰겠음. 후렴 터지는 순간 갑자기 페이스 올라감 ㅋㅋ',
  },
  {
    spotifyId: '0VjIjW4GlUZAMYd2vXMi3b',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    albumImageUrl: null,
    review: '새벽 2시에 혼자 드라이브할 때 진짜 미침. 가로등 불빛이랑 싱크 맞으면 영화 주인공 된 기분',
  },
  {
    spotifyId: '7qiZfU4dY1lWllzX7mPBI3',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    albumImageUrl: null,
    review: '카페에서 공부할 때 백그라운드로 틀어두기 딱 좋음. 리듬감 있어서 지루하지 않고 집중도 잘됨',
  },
  {
    spotifyId: '1BxfuPKGuaTgP7aM0Bbdwr',
    title: 'Levitating',
    artist: 'Dua Lipa',
    albumImageUrl: null,
    review: '친구들이랑 드라이브 갈 때 필수템. 차 안에서 다같이 따라부르면 분위기 극 상승',
  },
  {
    spotifyId: '3AJwUDP919kvQ9QcozQPxg',
    title: 'Sunflower',
    artist: 'Post Malone, Swae Lee',
    albumImageUrl: null,
    review: '맑은 날 오전에 창문 열고 청소할 때 들으면 기분이 너무 좋아짐. 나른하고 편안한 느낌',
  },
  {
    spotifyId: '2XU0oxnq2qxCpomAAuJY8K',
    title: 'Photograph',
    artist: 'Ed Sheeran',
    albumImageUrl: null,
    review: '오래된 사진 보면서 들으면 추억이 확 올라와서 괜히 감성에 젖음. 혼자 있을 때 듣는 노래',
  },
  {
    spotifyId: '0pqnGHJpmpxLKifKRmU6WP',
    title: 'Butter',
    artist: 'BTS',
    albumImageUrl: null,
    review: '출근길 기분 올릴 때 최고. 귀에 착착 감기고 자꾸 흥얼거리게 되는 노래',
  },
  {
    spotifyId: '5HCyWlXZPP0y6Gqq8TgA20',
    title: 'STAY',
    artist: 'The Kid LAROI, Justin Bieber',
    albumImageUrl: null,
    review: '이별하고 나서 반복 재생했던 노래. 가사가 너무 찔려서 울었음ㅋㅋ 근데 멜로디는 중독성 있어서 계속 들음',
  },
  {
    spotifyId: '6f3Slt0GbA2bPZlz0aIFXN',
    title: 'Hype Boy',
    artist: 'NewJeans',
    albumImageUrl: null,
    review: '자전거 타면서 들었는데 페달 밟는 속도가 자동으로 맞춰짐 ㅋㅋ 가볍고 통통 튀는 느낌이 너무 좋음',
  },
  {
    spotifyId: '3LEiNPMBe5j0TiNKtFHGPP',
    title: 'OMG',
    artist: 'NewJeans',
    albumImageUrl: null,
    review: '봄에 한강 가서 돗자리 깔고 들으면 진짜 힐링. 가사도 귀엽고 곡 전체 분위기가 설레는 느낌',
  },
  {
    spotifyId: 'spotify_iu_paletter3',
    title: 'LILAC',
    artist: 'IU',
    albumImageUrl: null,
    review: '졸업하고 처음 들었을 때 눈물 날 뻔했음. 끝이 아쉽고 새로운 시작이 두려운 그 기분이 노래에 다 담겨있음',
  },
  {
    spotifyId: 'spotify_iu_bam_pyeonji',
    title: '밤편지',
    artist: 'IU',
    albumImageUrl: null,
    review: '자려고 누웠는데 잠이 안 올 때 이어폰 꽂고 들으면 마음이 차분해짐. 그리운 사람 생각나는 노래',
  },
  {
    spotifyId: 'spotify_melomance_gift',
    title: '선물',
    artist: '멜로망스',
    albumImageUrl: null,
    review: '좋아하는 사람 생각할 때 듣는 노래. 가사 하나하나가 너무 예뻐서 여러 번 돌려듣게 됨',
  },
  {
    spotifyId: 'spotify_paul_kim_every_day',
    title: '매일 듣는 노래',
    artist: '폴킴',
    albumImageUrl: null,
    review: '비 오는 날 창가에서 커피 마시며 듣기 딱 좋음. 목소리가 너무 따뜻해서 마음이 편안해짐',
  },
  {
    spotifyId: '6UelLqGlWMcVH1E5c4H7lY',
    title: 'Watermelon Sugar',
    artist: 'Harry Styles',
    albumImageUrl: null,
    review: '여름 바다 갈 때 차 안에서 틀면 진짜 분위기 살아남. 햇살이랑 이 노래랑 궁합이 너무 좋음',
  },
  {
    spotifyId: '2takcwOaAZWiXenfMWav9k',
    title: 'don\'t blame me',
    artist: 'Taylor Swift',
    albumImageUrl: null,
    review: '밤에 조명 끄고 혼자 들으면 소름 돋음. 목소리 변화가 미칠 듯이 좋고 후반부 터지는 구간에서 닭살',
  },
  {
    spotifyId: '7MXVkk9YMctZqd1Srtv4MB',
    title: 'Shallow',
    artist: 'Lady Gaga, Bradley Cooper',
    albumImageUrl: null,
    review: '영화 보고 나서 너무 여운이 남아서 반복 재생함. 감정이 폭발하는 그 순간이 진짜 소름',
  },
  {
    spotifyId: '6habFhsOp5rp2RBPqXxvmS',
    title: 'Anti-Hero',
    artist: 'Taylor Swift',
    albumImageUrl: null,
    review: '자존감 낮아질 때 이상하게 이 노래 들으면 위로가 됨. 나만 이런 게 아니구나 싶어서 공감됨 ㅋㅋ',
  },
  {
    spotifyId: '0nJW01T7XtvILxQgC5J7Wh',
    title: 'Attention',
    artist: 'Charlie Puth',
    albumImageUrl: null,
    review: '헬스장에서 이 노래 나오면 갑자기 힘이 솟음. 리듬이 운동 페이스에 딱 맞음',
  },
  {
    spotifyId: '0e7ipj03S05BNilyu5bRzt',
    title: 'rockstar',
    artist: 'Lisa',
    albumImageUrl: null,
    review: '친구들이랑 노래방 갈 때 첫 곡으로 항상 이거 틀음. 처음부터 분위기 확 살려주는 노래',
  },
  // ── 추가 80곡 ──────────────────────────────────────────────────
  {
    spotifyId: '4iZ4pt7kvcaH6Yo8UoZ4s2',
    title: 'Someone Like You',
    artist: 'Adele',
    albumImageUrl: null,
    review: '이별하고 나서 이 노래를 들으면서 진짜 엄청 울었음. 가사가 내 상황이랑 딱 맞아서 오히려 위로가 됐음',
  },
  {
    spotifyId: '5XeFesFbtLpXzIVDNQP22n',
    title: 'Rolling in the Deep',
    artist: 'Adele',
    albumImageUrl: null,
    review: '화날 때 이거 틀면 후련해짐. 애들이랑 같이 차 안에서 따라 부르면 진짜 스트레스 날아감',
  },
  {
    spotifyId: '4aebBr4JAihzJQR0CiIZJv',
    title: 'Hello',
    artist: 'Adele',
    albumImageUrl: null,
    review: '오랫동안 연락 못한 사람 생각날 때 들으면 진짜 마음이 먹먹해짐. 목소리 하나만으로 감정 전달이 됨',
  },
  {
    spotifyId: '3AhXZa8sUQht0UEdBJgpGc',
    title: 'Fix You',
    artist: 'Coldplay',
    albumImageUrl: null,
    review: '힘든 시기에 진짜 많이 들었던 노래. 후반부 올라가는 부분에서 눈물 참기 힘듦. 지쳐있을 때 듣는 곡',
  },
  {
    spotifyId: '0wwPcA6wtMf6HUMpIRdeP7',
    title: 'Yellow',
    artist: 'Coldplay',
    albumImageUrl: null,
    review: '봄 날씨에 이어폰 꽂고 걸을 때 진짜 딱임. 가볍고 따뜻한 기타 선율이 기분 좋게 만들어줌',
  },
  {
    spotifyId: '2dpaYNEQHiRxtZbfNsse99',
    title: 'A Sky Full of Stars',
    artist: 'Coldplay',
    albumImageUrl: null,
    review: '페스티벌에서 라이브로 들었는데 진짜 소름 돋았음. 밤에 야외에서 들으면 별 보는 기분',
  },
  {
    spotifyId: '0nrRP4Gr2iHHKziGP6bDaR',
    title: 'The Scientist',
    artist: 'Coldplay',
    albumImageUrl: null,
    review: '후회되는 일이 있을 때 반복 재생하는 노래. 천천히 흘러가는 멜로디가 생각 정리하게 해줌',
  },
  {
    spotifyId: '7Cuk8jsPPoNYQWXK9XRFpg',
    title: 'All of Me',
    artist: 'John Legend',
    albumImageUrl: null,
    review: '웨딩 영상에서 배경음악으로 나왔는데 진짜 눈물 났음. 세상에서 제일 로맨틱한 노래인 듯',
  },
  {
    spotifyId: '1dGr1c8CrMLDpV6mPbImSI',
    title: 'Stay With Me',
    artist: 'Sam Smith',
    albumImageUrl: null,
    review: '혼자 있는 새벽에 듣기 딱 좋음. 외롭고 허전한 기분 그대로 담겨있어서 이상하게 공감되고 위로됨',
  },
  {
    spotifyId: '4MzXwWMhyBbmu6hOcLWhZn',
    title: 'Someone You Loved',
    artist: 'Lewis Capaldi',
    albumImageUrl: null,
    review: '이 노래 들으면서 버스에서 울었던 기억 있음. 그냥 목소리가 너무 진정성 있어서 감정이 전달됨',
  },
  {
    spotifyId: '0tgVpDi06FyKpA1z0VMD4v',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    albumImageUrl: null,
    review: '소중한 사람이랑 같이 들으면 딱인 노래. 가사 하나하나가 진심으로 느껴져서 괜히 설레게 됨',
  },
  {
    spotifyId: 'spotify_say_you_wont_let_go',
    title: 'Say You Won\'t Let Go',
    artist: 'James Arthur',
    albumImageUrl: null,
    review: '좋아하는 사람 생길 때마다 꼭 듣게 되는 노래. 담담하게 고백하는 느낌이 오히려 더 진심으로 느껴짐',
  },
  {
    spotifyId: '2dpaYNEQHiRxtZbfNsse66',
    title: 'drivers license',
    artist: 'Olivia Rodrigo',
    albumImageUrl: null,
    review: '실연 후에 차 타고 아무 데나 드라이브하면서 들었는데 가사가 너무 맞아서 진짜 많이 울었음',
  },
  {
    spotifyId: '6PERP62TZbLMFDFmcElMaB',
    title: 'good 4 u',
    artist: 'Olivia Rodrigo',
    albumImageUrl: null,
    review: '전 남친이 잘 지내는 거 보고 열받았을 때 이거 들으면서 풀었음ㅋㅋ 속시원한 노래',
  },
  {
    spotifyId: '7MXVkk9YMctZqd1Srtv4MB',
    title: 'bad guy',
    artist: 'Billie Eilish',
    albumImageUrl: null,
    review: '집에서 혼자 청소하면서 틀면 갑자기 쿨해지는 기분ㅋㅋ 독특한 비트가 중독성 있음',
  },
  {
    spotifyId: 'spotify_lovely_billie',
    title: 'lovely',
    artist: 'Billie Eilish, Khalid',
    albumImageUrl: null,
    review: '기분이 우울하고 아무것도 하기 싫을 때 그냥 누워서 들음. 슬픈 감정을 같이 느껴주는 노래',
  },
  {
    spotifyId: '1rfofaqEpACxVEHIZBJe6W',
    title: 'Lose Yourself',
    artist: 'Eminem',
    albumImageUrl: null,
    review: '중요한 발표나 시험 전에 꼭 들음. 들으면 진짜 뭔가 할 수 있을 것 같은 기분이 됨',
  },
  {
    spotifyId: '7lQ8MOhq6IN2w8EYcFNSUk',
    title: 'In The End',
    artist: 'Linkin Park',
    albumImageUrl: null,
    review: '중학교 때부터 들어온 노래인데 지금 들어도 소름. 가사 의미 알고 나서 더 깊게 들리게 됨',
  },
  {
    spotifyId: '1OhG6LifeLLjasRbWkm8Kn',
    title: 'Numb',
    artist: 'Linkin Park',
    albumImageUrl: null,
    review: '지쳐서 아무것도 하기 싫을 때 공감되는 노래. 이 감정을 이렇게 잘 표현한 곡이 또 있을까',
  },
  {
    spotifyId: '0HUTL8i4y4MiGCPId7M5R5',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    albumImageUrl: null,
    review: '영화 보고 나서 진짜 레전드라는 걸 다시 깨달음. 노래방에서 이거 부르면 다들 같이 따라부름',
  },
  {
    spotifyId: '3T4tZoS43U6BTe3SVF1sxk',
    title: 'Don\'t Stop Me Now',
    artist: 'Queen',
    albumImageUrl: null,
    review: '기분 좋을 때 이 노래 없으면 허전함. 밝고 신나는 에너지가 주변에 전파되는 노래',
  },
  {
    spotifyId: '0aym2LBJBk9DAYuHHutrIl',
    title: 'Hey Jude',
    artist: 'The Beatles',
    albumImageUrl: null,
    review: '힘들 때 들으면 어깨 토닥여주는 느낌. 후반부 나나나나 부분에서 같이 따라부르면 마음이 풀림',
  },
  {
    spotifyId: '7iN1s7xHE4ifF5povM6A48',
    title: 'Let It Be',
    artist: 'The Beatles',
    albumImageUrl: null,
    review: '해결 안 되는 문제로 머리 복잡할 때 들으면 마음이 편해짐. 그냥 되는 대로 두자는 위로가 됨',
  },
  {
    spotifyId: '1TfqLAPs4K3s2rJMoCokcS',
    title: 'Dancing Queen',
    artist: 'ABBA',
    albumImageUrl: null,
    review: '엄마가 좋아하는 노래라서 어릴 때부터 들어왔는데 지금 들어도 기분이 좋아짐. 세대를 초월하는 노래',
  },
  {
    spotifyId: 'spotify_faded_walker',
    title: 'Faded',
    artist: 'Alan Walker',
    albumImageUrl: null,
    review: '밤에 드라이브하면서 들으면 진짜 영화 속 주인공이 된 기분. 몽환적인 느낌이 야경이랑 잘 어울림',
  },
  {
    spotifyId: 'spotify_wake_me_up_avicii',
    title: 'Wake Me Up',
    artist: 'Avicii',
    albumImageUrl: null,
    review: '방학 시작할 때마다 생각나는 노래. 자유로운 기분이랑 새로운 시작의 설렘이 담겨있음',
  },
  {
    spotifyId: 'spotify_the_nights_avicii',
    title: 'The Nights',
    artist: 'Avicii',
    albumImageUrl: null,
    review: '졸업 여행 가는 버스에서 들었는데 진짜 울컥했음. 지금 이 순간을 기억하라는 가사가 너무 와닿음',
  },
  {
    spotifyId: '0cf26uHali0RO4b9HNXL9q',
    title: 'Closer',
    artist: 'The Chainsmokers',
    albumImageUrl: null,
    review: '대학교 신입생 때 파티에서 이 노래 나오면 다들 같이 따라불렀던 기억. 청춘의 노래',
  },
  {
    spotifyId: 'spotify_thunder_id',
    title: 'Thunder',
    artist: 'Imagine Dragons',
    albumImageUrl: null,
    review: '뭔가 잘 될 것 같은 날 아침에 들으면 딱임. 나 할 수 있다는 기분 들게 해주는 노래',
  },
  {
    spotifyId: '5VnDkUus7MNxluMsRPEkBP',
    title: 'Radioactive',
    artist: 'Imagine Dragons',
    albumImageUrl: null,
    review: '게임할 때 틀어놓으면 집중력이 올라감. 무게감 있는 비트가 몰입감을 높여줌',
  },
  {
    spotifyId: '7gSQv1OHpkIoAdUy9YBRCI',
    title: 'Peaches',
    artist: 'Justin Bieber',
    albumImageUrl: null,
    review: '여름 오후에 낮잠 자기 전에 들으면 나른하고 기분 좋음. 따뜻하고 달달한 느낌',
  },
  {
    spotifyId: '50kpGaPAhYJ3sGmk6vplg0',
    title: 'Love Yourself',
    artist: 'Justin Bieber',
    albumImageUrl: null,
    review: '헤어지고 나서 갑자기 공감됐던 노래. 담담하게 이별을 말하는 방식이 오히려 더 서늘하게 느껴짐',
  },
  {
    spotifyId: 'spotify_sorry_bieber',
    title: 'Sorry',
    artist: 'Justin Bieber',
    albumImageUrl: null,
    review: '기분 좋고 춤추고 싶을 때 틀게 되는 노래. 자꾸 어깨가 들썩거리게 만드는 리듬감',
  },
  {
    spotifyId: '2374M0fQpWi3dLnB54qaLX',
    title: 'positions',
    artist: 'Ariana Grande',
    albumImageUrl: null,
    review: '잠들기 전에 들으면 기분이 몽글몽글해짐. 부드러운 목소리가 이불 속에서 듣기 딱 좋음',
  },
  {
    spotifyId: 'spotify_7rings_ariana',
    title: '7 rings',
    artist: 'Ariana Grande',
    albumImageUrl: null,
    review: '자신감 넘칠 때 들으면 더 자신감이 올라감ㅋㅋ 쇼핑하면서 이거 들으면 갑자기 힙해지는 느낌',
  },
  {
    spotifyId: 'spotify_thanku_ariana',
    title: 'thank u, next',
    artist: 'Ariana Grande',
    albumImageUrl: null,
    review: '헤어지고 나서 우울할 때 이거 들으면 갑자기 쿨해지는 마음이 생김. 자기 자신 챙기는 노래',
  },
  {
    spotifyId: '6RUKPb4LETWmmr3iAEQktW',
    title: 'Treat You Better',
    artist: 'Shawn Mendes',
    albumImageUrl: null,
    review: '좋아하는 사람이 생겼을 때 들으면 감정이 증폭됨. 직접 말 못 할 때 대신 들어주는 노래',
  },
  {
    spotifyId: 'spotify_as_it_was_harry',
    title: 'As It Was',
    artist: 'Harry Styles',
    albumImageUrl: null,
    review: '뭔가 예전으로 돌아가고 싶다는 기분 들 때 자꾸 생각남. 밝은 멜로디인데 가사는 쓸쓸한 그 묘한 감각',
  },
  {
    spotifyId: 'spotify_hotline_bling',
    title: 'Hotline Bling',
    artist: 'Drake',
    albumImageUrl: null,
    review: '옛날 연락 오면 이 노래 생각남ㅋㅋ 리듬이 중독적이고 후크 부분이 계속 머릿속에 맴돔',
  },
  {
    spotifyId: '5nujrmhLynf4yMoMtj8AQF',
    title: 'HUMBLE.',
    artist: 'Kendrick Lamar',
    albumImageUrl: null,
    review: '뭔가 집중해서 작업할 때 틀어놓으면 텐션이 올라감. 강렬한 비트가 집중력을 높여주는 느낌',
  },
  {
    spotifyId: 'spotify_god_menu_skz',
    title: 'God\'s Menu',
    artist: 'Stray Kids',
    albumImageUrl: null,
    review: '운동할 때 이거 틀면 세트 수가 늘어남ㅋㅋ 강렬하고 파워풀한 에너지가 몸에 전달됨',
  },
  {
    spotifyId: 'spotify_miroh_skz',
    title: 'MIROH',
    artist: 'Stray Kids',
    albumImageUrl: null,
    review: '힘든 시기에 진짜 많이 들었음. 두려움 없이 앞으로 나아가라는 메시지가 진짜 힘이 됨',
  },
  {
    spotifyId: 'spotify_psycho_rv',
    title: 'Psycho',
    artist: 'Red Velvet',
    albumImageUrl: null,
    review: '겨울 밤에 조명 켜놓고 혼자 있을 때 들으면 분위기가 묘하게 좋아짐. 세련된 느낌',
  },
  {
    spotifyId: 'spotify_fancy_twice',
    title: 'Fancy',
    artist: 'TWICE',
    albumImageUrl: null,
    review: '봄에 꽃 피는 캠퍼스 걸으면서 들으면 딱임. 경쾌하고 설레는 느낌이 계절이랑 잘 맞음',
  },
  {
    spotifyId: 'spotify_feel_special_twice',
    title: 'Feel Special',
    artist: 'TWICE',
    albumImageUrl: null,
    review: '자존감 떨어질 때 들으면 다시 힘이 남. 나는 소중한 사람이라는 걸 노래가 계속 상기시켜줌',
  },
  {
    spotifyId: 'spotify_love_dive_ive',
    title: 'Love Dive',
    artist: 'IVE',
    albumImageUrl: null,
    review: '좋아하는 사람 생겼을 때 귀에 꽂히는 노래. 사랑에 빠지는 설렘이 노래에 그대로 담겨있음',
  },
  {
    spotifyId: 'spotify_after_like_ive',
    title: 'After LIKE',
    artist: 'IVE',
    albumImageUrl: null,
    review: '샘플링 부분에서 처음 들었을 때 소름 돋았음. 중독성이 너무 강해서 한번 들으면 하루 종일 머릿속에 맴돔',
  },
  {
    spotifyId: 'spotify_tomboy_gidle',
    title: 'TOMBOY',
    artist: '(G)I-DLE',
    albumImageUrl: null,
    review: '남 눈치 안 보고 내 맘대로 살고 싶을 때 들으면 속이 시원해짐. 자신감 뿜뿜 노래',
  },
  {
    spotifyId: 'spotify_next_level_aespa',
    title: 'Next Level',
    artist: 'aespa',
    albumImageUrl: null,
    review: '처음 들었을 때 이게 뭔 장르지 싶었는데 점점 빠져들었음. 독특한 구성이 중독성 강함',
  },
  {
    spotifyId: 'spotify_antifragile_lesserafim',
    title: 'ANTIFRAGILE',
    artist: 'LE SSERAFIM',
    albumImageUrl: null,
    review: '무너질 것 같을 때 들으면 다시 일어서게 해주는 노래. 강인한 에너지가 전달됨',
  },
  {
    spotifyId: 'spotify_pink_venom_bp',
    title: 'Pink Venom',
    artist: 'BLACKPINK',
    albumImageUrl: null,
    review: '자신감 올리고 싶을 때 틀면 진짜 세상 최강자가 된 기분ㅋㅋ 파워풀한 에너지가 넘침',
  },
  {
    spotifyId: 'spotify_hylt_bp',
    title: 'How You Like That',
    artist: 'BLACKPINK',
    albumImageUrl: null,
    review: '힘 빠질 때 듣는 노래. 다시 일어서는 느낌의 가사랑 강렬한 드롭이 에너지를 충전시켜줌',
  },
  {
    spotifyId: 'spotify_power_exo',
    title: 'Power',
    artist: 'EXO',
    albumImageUrl: null,
    review: '일하기 싫을 때 이거 틀면 갑자기 의욕이 생김. 밝고 경쾌한 에너지가 기분을 끌어올려줌',
  },
  {
    spotifyId: 'spotify_superhuman_exo',
    title: 'Supernova',
    artist: 'aespa',
    albumImageUrl: null,
    review: '여름 내내 들었던 노래. 강렬하면서도 중독성 있는 훅이 한번 들으면 머릿속에서 안 떠남',
  },
  {
    spotifyId: 'spotify_traffic_light',
    title: '신호등',
    artist: '이무진',
    albumImageUrl: null,
    review: '이 노래 처음 들었을 때 가사가 너무 독특해서 놀랐음. 계속 신호등 볼 때마다 생각날 것 같은 노래',
  },
  {
    spotifyId: 'spotify_universe_bbq',
    title: '우주를 줄게',
    artist: '볼빨간사춘기',
    albumImageUrl: null,
    review: '좋아하는 사람한테 고백하고 싶을 때 대신 들음ㅋㅋ 순수하고 달달한 감정이 노래에 가득 담겨있음',
  },
  {
    spotifyId: 'spotify_jannabi_lovers',
    title: '주저하는 연인들을 위해',
    artist: '잔나비',
    albumImageUrl: null,
    review: '레트로 감성이 물씬 나는 노래. 오래된 감성 드라마 OST 같은 느낌이라 묘하게 그리운 기분이 듦',
  },
  {
    spotifyId: 'spotify_200pct_akmu',
    title: '200%',
    artist: '악동뮤지션',
    albumImageUrl: null,
    review: '설레는 감정을 이렇게 잘 표현한 노래가 또 있을까. 누군가 좋아질 때마다 자동재생되는 노래',
  },
  {
    spotifyId: 'spotify_star_jeokjae',
    title: '별 보러 가자',
    artist: '적재',
    albumImageUrl: null,
    review: '캠핑 가서 밤하늘 보면서 들었는데 진짜 완벽한 조합이었음. 맑고 투명한 느낌의 노래',
  },
  {
    spotifyId: 'spotify_epik_umbrella',
    title: '우산',
    artist: '에픽하이',
    albumImageUrl: null,
    review: '비 오는 날 이 노래 들으면서 우산 없이 걸어봤음. 가사 의미 다시 생각하게 됨',
  },
  {
    spotifyId: 'spotify_just_the_way',
    title: 'Just The Way You Are',
    artist: 'Bruno Mars',
    albumImageUrl: null,
    review: '좋아하는 사람에게 보내주고 싶은 노래 1위. 있는 그대로 완벽하다는 말이 이렇게 설레게 느껴질 줄은',
  },
  {
    spotifyId: 'spotify_marry_you_bruno',
    title: 'Marry You',
    artist: 'Bruno Mars',
    albumImageUrl: null,
    review: '웨딩 파티 분위기에서 틀기 딱 좋은 노래. 가볍고 행복한 에너지가 가득해서 듣는 것만으로도 기분이 좋아짐',
  },
  {
    spotifyId: 'spotify_treasure_bruno',
    title: 'Treasure',
    artist: 'Bruno Mars',
    albumImageUrl: null,
    review: '데이트할 때 차 안에서 틀면 분위기가 살아남. 경쾌하고 달달한 느낌이 행복한 하루에 잘 어울림',
  },
  {
    spotifyId: 'spotify_sugar_maroon5',
    title: 'Sugar',
    artist: 'Maroon 5',
    albumImageUrl: null,
    review: '기분 좋은 날 아침에 일어나서 들으면 하루가 달달하게 시작됨. 기분 전환용 1순위 노래',
  },
  {
    spotifyId: 'spotify_memories_maroon5',
    title: 'Memories',
    artist: 'Maroon 5',
    albumImageUrl: null,
    review: '친구들이랑 찍은 옛날 사진 보면서 들으면 감성이 올라옴. 소중한 순간들을 떠올리게 하는 노래',
  },
  {
    spotifyId: 'spotify_girls_like_you',
    title: 'Girls Like You',
    artist: 'Maroon 5',
    albumImageUrl: null,
    review: '중요한 사람이 생겼을 때 이 노래 들으면 마음이 따뜻해짐. 오래 곁에 있어주고 싶다는 감정',
  },
  {
    spotifyId: 'spotify_one_dance_drake',
    title: 'One Dance',
    artist: 'Drake',
    albumImageUrl: null,
    review: '파티나 클럽 분위기에서 이 노래 나오면 몸이 자동으로 움직임. 그루브가 살아있는 노래',
  },
  {
    spotifyId: 'spotify_circles_post',
    title: 'Circles',
    artist: 'Post Malone',
    albumImageUrl: null,
    review: '반복되는 이별과 화해를 이렇게 잘 표현했음. 상황은 힘든데 멜로디는 예뻐서 묘한 감정',
  },
  {
    spotifyId: 'spotify_your_song_elton',
    title: 'Your Song',
    artist: 'Elton John',
    albumImageUrl: null,
    review: '오래된 노래인데 들으면 클래식하게 기분이 좋아짐. 누군가에게 진심을 전하는 방법을 보여주는 노래',
  },
  {
    spotifyId: 'spotify_fly_me',
    title: 'Fly Me to the Moon',
    artist: 'Frank Sinatra',
    albumImageUrl: null,
    review: '와인 한 잔 하면서 분위기 잡을 때 딱임. 오래된 재즈 선율이 공간을 고급스럽게 만들어줌',
  },
  {
    spotifyId: 'spotify_garota_ipanema',
    title: 'The Girl from Ipanema',
    artist: 'João Gilberto',
    albumImageUrl: null,
    review: '카페에서 공부할 때 보사노바 들으면 집중이 잘 됨. 이 노래는 특히 여유로운 브라질 해변 분위기가 느껴짐',
  },
  {
    spotifyId: 'spotify_billie_jean_mj',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    albumImageUrl: null,
    review: '노래방 18번 중 하나. 베이스라인 나오는 순간부터 몸이 자동으로 반응함. 세기의 명곡',
  },
  {
    spotifyId: 'spotify_beat_it_mj',
    title: 'Beat It',
    artist: 'Michael Jackson',
    albumImageUrl: null,
    review: '드라이브할 때 이 노래 틀면 속도를 높이고 싶어짐ㅋㅋ 에너지가 너무 넘치는 노래',
  },
  {
    spotifyId: 'spotify_ready_to_love_svt',
    title: 'Ready to Love',
    artist: 'SEVENTEEN',
    albumImageUrl: null,
    review: '가을에 걸으면서 들으면 딱인 노래. 쓸쓸하면서도 따뜻한 감성이 계절이랑 잘 맞음',
  },
  {
    spotifyId: 'spotify_ring_ding_dong',
    title: 'Ring Ding Dong',
    artist: 'SHINee',
    albumImageUrl: null,
    review: '기분 올리고 싶을 때 틀면 무조건 기분이 좋아짐. 레트로 케이팝 감성이 오히려 신선하게 느껴짐',
  },
  {
    spotifyId: 'spotify_again_and_again_2pm',
    title: 'Again & Again',
    artist: '2PM',
    albumImageUrl: null,
    review: '추억의 노래. 어릴 때 처음 케이팝에 빠지게 해준 노래들 중 하나. 지금 들어도 설레는 게 신기함',
  },
  {
    spotifyId: 'spotify_something_chainsmokers',
    title: 'Something Just Like This',
    artist: 'The Chainsmokers, Coldplay',
    albumImageUrl: null,
    review: '두 아티스트의 조합이 너무 잘 맞음. 평범한 사랑을 원한다는 가사가 오히려 더 와닿음',
  },
  {
    spotifyId: 'spotify_happier_marshmello',
    title: 'Happier',
    artist: 'Marshmello, Bastille',
    albumImageUrl: null,
    review: '이별 후에 상대방의 행복을 진심으로 바라면서 듣는 노래. 슬프지만 따뜻한 이별 노래',
  },
  {
    spotifyId: 'spotify_story_of_my_life',
    title: 'Story of My Life',
    artist: 'One Direction',
    albumImageUrl: null,
    review: '청소년 때 이 노래로 영어 공부했던 기억. 멜로디도 좋고 가사도 예뻐서 지금도 가끔 찾아 들음',
  },
  {
    spotifyId: 'spotify_what_makes_you',
    title: 'What Makes You Beautiful',
    artist: 'One Direction',
    albumImageUrl: null,
    review: '처음 좋아하는 사람이 생겼을 때 들으면서 설레던 노래. 지금 들으면 그 풋풋했던 감정이 되살아남',
  },
  {
    spotifyId: 'spotify_adore_you_harry',
    title: 'Adore You',
    artist: 'Harry Styles',
    albumImageUrl: null,
    review: '해변가나 바다 갈 때 자동재생되는 플레이리스트에 항상 포함시킴. 여름 바다랑 궁합이 너무 좋음',
  },
  {
    spotifyId: 'spotify_stay_the_night',
    title: 'Alone',
    artist: 'Marshmello',
    albumImageUrl: null,
    review: '혼자 방에서 공부할 때 틀어두면 집중이 잘 됨. 가사 없는 EDM인데 감정은 충분히 전달됨',
  },
  {
    spotifyId: 'spotify_sweet_night_v',
    title: 'Sweet Night',
    artist: 'V (BTS)',
    albumImageUrl: null,
    review: '이태원클라쓰 OST인데 드라마 안 봐도 가사가 너무 좋음. 잠들기 전에 들으면 기분이 포근해짐',
  },
  {
    spotifyId: 'spotify_christmas_mariah',
    title: 'All I Want for Christmas Is You',
    artist: 'Mariah Carey',
    albumImageUrl: null,
    review: '12월 되면 자동으로 귀에 들려오는 노래. 이거 들리면 진짜 크리스마스가 왔다는 실감이 남',
  },
  // ── 추가 50곡 ──────────────────────────────────────────────────
  { spotifyId: 'spotify_nxde_gidle', title: 'Nxde', artist: '(G)I-DLE', albumImageUrl: null,
    review: '처음 들었을 때 오히려 파격적인 콘셉트에 놀랐는데 들을수록 완성도가 느껴짐. 자신감 있는 에너지가 인상적' },
  { spotifyId: 'spotify_queencard_gidle', title: 'Queencard', artist: '(G)I-DLE', albumImageUrl: null,
    review: '기분 좋은 날 거울 보면서 들으면 자존감이 폭발함ㅋㅋ 나 예쁘다는 확신을 주는 노래' },
  { spotifyId: 'spotify_eve_psyche_gidle', title: 'Eve, Psyche & The Bluebeard\'s wife', artist: '(G)I-DLE', albumImageUrl: null,
    review: '신화 컨셉이 독특해서 처음엔 낯설었는데 반복해서 들으니까 중독성이 엄청남. 걸크러쉬 장르의 정점' },
  { spotifyId: 'spotify_spicy_aespa', title: 'Spicy', artist: 'aespa', albumImageUrl: null,
    review: '여름에 들으면 더 신나는 노래. 쿨한 느낌이랑 강렬한 비트가 더운 날씨를 이기게 해줌' },
  { spotifyId: 'spotify_drama_aespa', title: 'Drama', artist: 'aespa', albumImageUrl: null,
    review: '뮤직비디오랑 같이 보면 진짜 영화 한 편 본 것 같음. 압도적인 스케일과 웅장한 사운드가 인상적' },
  { spotifyId: 'spotify_kill_this_love', title: 'Kill This Love', artist: 'BLACKPINK', albumImageUrl: null,
    review: '헤어지고 나서 오히려 강해지고 싶을 때 듣는 노래. 이별을 강하게 받아들이는 느낌이 씩씩하고 좋음' },
  { spotifyId: 'spotify_ddu_du_bp', title: 'DDU-DU DDU-DU', artist: 'BLACKPINK', albumImageUrl: null,
    review: '처음 나왔을 때 진짜 충격이었음. 강렬하고 시원한 느낌이 여름에 특히 잘 어울리는 노래' },
  { spotifyId: 'spotify_lovesick_girls', title: 'Lovesick Girls', artist: 'BLACKPINK', albumImageUrl: null,
    review: '이별 후에 생각보다 괜찮다고 느낄 때 듣는 노래. 슬프지만 씩씩한 이 감정이 딱 표현됨' },
  { spotifyId: 'spotify_on_bts', title: 'ON', artist: 'BTS', albumImageUrl: null,
    review: '뭔가 큰일을 앞두고 각오를 다질 때 듣는 노래. 웅장한 사운드가 마음을 단단하게 해줌' },
  { spotifyId: 'spotify_spring_day_bts', title: 'Spring Day', artist: 'BTS', albumImageUrl: null,
    review: '겨울에서 봄으로 넘어갈 때 들으면 진짜 감성이 폭발함. 그리운 사람 생각하며 듣기 좋은 노래' },
  { spotifyId: 'spotify_boy_with_luv', title: 'Boy With Luv', artist: 'BTS', albumImageUrl: null,
    review: '처음 좋아하는 사람이 생겼을 때 이 노래 들으면 설렘이 배가 됨. 밝고 귀여운 에너지가 좋음' },
  { spotifyId: 'spotify_fake_love_bts', title: 'FAKE LOVE', artist: 'BTS', albumImageUrl: null,
    review: '헤어진 뒤에 내 감정도 진짜였는지 의심하게 될 때 자꾸 생각나는 노래. 무거운 감정이 담겨있음' },
  { spotifyId: 'spotify_celebrity_iu', title: 'Celebrity', artist: 'IU', albumImageUrl: null,
    review: '좋아하는 사람한테 이 노래 들려주고 싶어짐. 너는 내 눈에 이미 스타라는 말이 너무 다정함' },
  { spotifyId: 'spotify_strawberry_moon', title: 'strawberry moon', artist: 'IU', albumImageUrl: null,
    review: '여름 저녁에 들으면 딱인 노래. 몽환적이고 달콤한 분위기가 행복한 감정을 증폭시켜줌' },
  { spotifyId: 'spotify_palette_iu', title: 'Palette', artist: 'IU', albumImageUrl: null,
    review: '나이 들어가는 것에 대한 노래인데 이상하게 위로가 됨. 나도 나만의 색깔을 찾아가고 있다는 생각' },
  { spotifyId: 'spotify_through_the_night', title: 'Through the Night', artist: 'IU', albumImageUrl: null,
    review: '잠 못 드는 새벽에 들으면 마음이 차분해짐. 멀리 있는 소중한 사람 생각나는 노래' },
  { spotifyId: 'spotify_my_old_story', title: '옛날 이야기', artist: 'IU', albumImageUrl: null,
    review: '아련한 첫사랑 생각날 때 자꾸 듣게 되는 노래. 과거의 순간이 선명하게 떠오르는 느낌' },
  { spotifyId: 'spotify_money_lisa', title: 'MONEY', artist: 'Lisa', albumImageUrl: null,
    review: '자신감 넘치고 싶을 때 틀면 갑자기 쿨해지는 기분ㅋㅋ 스웨그 있는 에너지가 전달됨' },
  { spotifyId: 'spotify_lalisa', title: 'LALISA', artist: 'Lisa', albumImageUrl: null,
    review: '솔로 데뷔곡인데 라리사 특유의 파워풀한 느낌이 잘 살아있음. 헬스할 때 틀면 진짜 힘이 남' },
  { spotifyId: 'spotify_mantra_jennie', title: 'Mantra', artist: 'Jennie', albumImageUrl: null,
    review: '자존감 높아지는 주문 같은 노래. 반복해서 들으면 진짜 내가 제일 쿨한 사람인 것 같은 기분' },
  { spotifyId: 'spotify_solo_jennie', title: 'SOLO', artist: 'Jennie', albumImageUrl: null,
    review: '혼자여도 충분히 멋지다는 걸 느끼게 해주는 노래. 이별 후에 나 자신을 다시 세우고 싶을 때 딱' },
  { spotifyId: 'spotify_seven_jungkook', title: 'Seven', artist: 'Jung Kook', albumImageUrl: null,
    review: '일주일 내내 듣고 싶은 노래. 중독성 있는 후크와 밝은 에너지가 매일매일 기분 좋게 만들어줌' },
  { spotifyId: 'spotify_standing_next_jk', title: 'Standing Next to You', artist: 'Jung Kook', albumImageUrl: null,
    review: '80년대 팝 스타일인데 요즘 느낌으로 재해석한 게 신선함. 댄서블한 리듬이 몸을 들썩이게 함' },
  { spotifyId: 'spotify_love_is_a_losing_game', title: 'Love Is a Losing Game', artist: 'Amy Winehouse', albumImageUrl: null,
    review: '재즈 발라드인데 가사가 너무 아파서 들을 때마다 마음이 먹먹해짐. 목소리 하나로 감정 전달이 완벽함' },
  { spotifyId: 'spotify_back_to_black', title: 'Back to Black', artist: 'Amy Winehouse', albumImageUrl: null,
    review: '우울하고 어두운 감정을 이렇게 아름답게 표현할 수 있다는 게 신기함. 감성에 젖고 싶을 때 듣는 노래' },
  { spotifyId: 'spotify_rehab_amy', title: 'Rehab', artist: 'Amy Winehouse', albumImageUrl: null,
    review: '처음 들었을 때 이 목소리가 뭔가 싶었음. 빈티지한 느낌이 요즘 노래들이랑 차별화되는 매력' },
  { spotifyId: 'spotify_creep_radiohead', title: 'Creep', artist: 'Radiohead', albumImageUrl: null,
    review: '자신감 없고 주눅 들 때 이 노래 들으면 오히려 공감받는 느낌. 소외감을 이렇게 음악으로 표현했다는 게 대단함' },
  { spotifyId: 'spotify_wonderwall_oasis', title: 'Wonderwall', artist: 'Oasis', albumImageUrl: null,
    review: '기타 선율 하나로 이렇게 감성적인 분위기를 만든다는 게 신기함. 90년대 브릿팝의 정수' },
  { spotifyId: 'spotify_mr_brightside', title: 'Mr. Brightside', artist: 'The Killers', albumImageUrl: null,
    review: '질투심과 상상이 뒤엉키는 감정을 너무 잘 표현했음. 인트로 기타 나오는 순간 자동으로 흥이 오름' },
  { spotifyId: 'spotify_take_on_me', title: 'Take On Me', artist: 'a-ha', albumImageUrl: null,
    review: '80년대 노래인데 지금 들어도 전혀 촌스럽지 않음. 신스팝 특유의 경쾌함이 기분을 밝게 해줌' },
  { spotifyId: 'spotify_never_gonna', title: 'Never Gonna Give You Up', artist: 'Rick Astley', albumImageUrl: null,
    review: '릭롤링 밈으로 알게 됐는데 진짜로 들어보니 명곡임. 진심 어린 사랑 고백 노래인데 귀에 쏙 들어옴' },
  { spotifyId: 'spotify_september_eo', title: 'September', artist: 'Earth, Wind & Fire', albumImageUrl: null,
    review: '이 노래 들으면 저절로 춤을 추게 됨. 파티 분위기에서 빠질 수 없는 영원한 명곡' },
  { spotifyId: 'spotify_superstition_stevie', title: 'Superstition', artist: 'Stevie Wonder', albumImageUrl: null,
    review: '훵키한 리듬이 몸을 자동으로 움직이게 함. 수십 년이 지났는데도 이 에너지는 진짜 따라올 수 없음' },
  { spotifyId: 'spotify_i_will_always', title: 'I Will Always Love You', artist: 'Whitney Houston', albumImageUrl: null,
    review: '이 노래만큼 강렬한 이별 노래가 또 있을까. 마지막 고음 부분에서 소름이 돋지 않는 사람이 있다면 귀가 없는 것' },
  { spotifyId: 'spotify_greatest_love', title: 'Greatest Love of All', artist: 'Whitney Houston', albumImageUrl: null,
    review: '스스로를 사랑하라는 메시지가 진짜 와닿는 노래. 우울할 때 들으면 힘이 됨' },
  { spotifyId: 'spotify_thriller_mj', title: 'Thriller', artist: 'Michael Jackson', albumImageUrl: null,
    review: '핼러윈 때마다 빠지지 않는 노래. 뮤직비디오랑 함께라면 더할 나위 없이 완벽한 경험' },
  { spotifyId: 'spotify_smooth_criminal', title: 'Smooth Criminal', artist: 'Michael Jackson', albumImageUrl: null,
    review: '앤티그래비티 댄스 장면이랑 이 노래는 영원한 레전드. 리듬이 너무 중독적이라 계속 듣게 됨' },
  { spotifyId: 'spotify_black_or_white', title: 'Black or White', artist: 'Michael Jackson', albumImageUrl: null,
    review: '인트로 기타 리프가 너무 강렬해서 들을 때마다 에너지가 충전됨. 메시지도 지금도 유효한 명곡' },
  { spotifyId: 'spotify_hotel_california', title: 'Hotel California', artist: 'Eagles', albumImageUrl: null,
    review: '8분짜리 노래인데 한 순간도 지루하지 않음. 기타 솔로 부분에서 진짜 소름 돋는 경험을 함' },
  { spotifyId: 'spotify_stairway_heaven', title: 'Stairway to Heaven', artist: 'Led Zeppelin', albumImageUrl: null,
    review: '록 음악의 역사를 바꾼 노래라는 말이 과장이 아님. 처음에는 잔잔하다가 점점 폭발하는 구성이 완벽함' },
  { spotifyId: 'spotify_smells_like_teen', title: 'Smells Like Teen Spirit', artist: 'Nirvana', albumImageUrl: null,
    review: '그런지 록의 교과서. 인트로 리프 나오는 순간 90년대 청춘의 반항심이 그대로 느껴짐' },
  { spotifyId: 'spotify_purple_rain_prince', title: 'Purple Rain', artist: 'Prince', albumImageUrl: null,
    review: '빗소리가 들리면 자동으로 생각나는 노래. 감성적인 기타와 목소리가 합쳐진 완벽한 밸러드' },
  { spotifyId: 'spotify_sign_o_times', title: 'When Doves Cry', artist: 'Prince', albumImageUrl: null,
    review: '베이스가 없는 독특한 구성인데 오히려 그게 더 인상적임. 프린스의 천재성이 느껴지는 곡' },
  { spotifyId: 'spotify_supermassive_muse', title: 'Supermassive Black Hole', artist: 'Muse', albumImageUrl: null,
    review: '운동할 때나 게임할 때 틀면 집중력과 텐션이 동시에 올라감. 긴장감 있는 리프가 중독성 강함' },
  { spotifyId: 'spotify_uprising_muse', title: 'Uprising', artist: 'Muse', albumImageUrl: null,
    review: '세상에 저항하고 싶은 기분이 들 때 이 노래 들으면 용기가 솟음. 메시지도 강하고 사운드도 강함' },
  { spotifyId: 'spotify_time_pink_floyd', title: 'Time', artist: 'Pink Floyd', albumImageUrl: null,
    review: '시간이 빠르게 지나가는 것에 대한 노래인데 들을 때마다 내 삶을 돌아보게 됨. 철학적인 명곡' },
  { spotifyId: 'spotify_wish_you_were', title: 'Wish You Were Here', artist: 'Pink Floyd', albumImageUrl: null,
    review: '그리운 사람이 있을 때 들으면 감정이 가득 차오름. 단순한 기타 코드인데 왜 이렇게 마음이 울리는지' },
  { spotifyId: 'spotify_comfortably_numb', title: 'Comfortably Numb', artist: 'Pink Floyd', albumImageUrl: null,
    review: '기타 솔로가 역대 최고 수준이라고 생각함. 눈 감고 들으면 다른 세계로 빠져드는 경험' },
  { spotifyId: 'spotify_sweet_home_alabama', title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', albumImageUrl: null,
    review: '바비큐 파티나 야외 모임에서 이 노래 나오면 분위기가 확 살아남. 여름 드라이브에도 완벽한 노래' },
  { spotifyId: 'spotify_eye_of_tiger', title: 'Eye of the Tiger', artist: 'Survivor', albumImageUrl: null,
    review: '운동 시작 전에 듣는 필수 곡. 이거 듣고 나면 진짜 무엇이든 할 수 있을 것 같은 기분이 됨' },
];

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  // 1) Firebase 로그인
  console.log('🔐 Firebase 로그인 중...');
  const { user } = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  const token = await user.getIdToken();
  console.log(`✅ 로그인 완료: ${user.email}`);

  let success = 0;
  let failed  = 0;

  for (const item of SEED_DATA) {
    process.stdout.write(`📝 [${item.artist} - ${item.title}] 처리 중... `);
    try {
      // 2) 백엔드에서 태그 추출 (실패해도 계속 진행)
      let tags = [];
      try {
        const tagRes = await fetch(`${BACKEND_URL}/api/tags/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ review: item.review, spotifyId: item.spotifyId }),
          signal: AbortSignal.timeout(5000),
        });
        if (tagRes.ok) {
          const tagData = await tagRes.json();
          tags = tagData.tags || [];
        }
      } catch (_) {
        // 백엔드 꺼져있어도 태그 없이 저장
      }

      // 3) Firestore posts 컬렉션에 저장
      await addDoc(collection(db, 'posts'), {
        userId:    user.uid,
        userName:  user.displayName || user.email.split('@')[0],
        content:   item.review,
        tags,
        songData: {
          title:         item.title,
          artist:        item.artist,
          spotifyId:     item.spotifyId,
          albumImageUrl: item.albumImageUrl,
        },
        likes:     [],
        createdAt: serverTimestamp(),
      });

      console.log(`→ 태그: ${tags.join(', ') || '없음'} ✅`);
      success++;

      // API 과부하 방지 (500ms 간격)
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log(`❌ 실패: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 완료! 성공 ${success}개 / 실패 ${failed}개`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
