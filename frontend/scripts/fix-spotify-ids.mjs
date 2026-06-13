/**
 * 가짜 spotifyId 가진 posts → 실제 Spotify ID + 앨범아트로 업데이트
 * node scripts/fix-spotify-ids.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
};

const CLIENT_ID = 'f8656c156c9d4f07a1f159cb38cfc203';
const EMAIL    = 'juyean2004@gmail.com';
const PASSWORD = 'my647121';

const isRealSpotifyId = (id) => !!id && /^[A-Za-z0-9]{22}$/.test(id);

// Firebase 유저 토큰으로 Spotify 검색
async function searchSpotify(token, title, artist) {
  try {
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    const track = data.tracks?.items?.[0];
    if (!track) return null;
    return {
      spotifyId: track.id,
      albumImageUrl: track.album?.images?.[0]?.url || null,
    };
  } catch { return null; }
}

async function main() {
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  console.log('🔐 Firebase 로그인...');
  const { user } = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log(`✅ ${user.email}`);

  // Spotify 토큰 가져오기 (저장된 refresh token 사용)
  // AsyncStorage 접근 불가 → 직접 Spotify 로그인 URL 방식 불가
  // 대신: 백엔드 없이 Spotify Web API Bearer 토큰 직접 입력
  console.log('\n⚠️  Spotify 액세스 토큰이 필요해요!');
  console.log('앱에서 Spotify 연결 후 콘솔 로그에서 토큰 복사해서 아래에 붙여넣으세요.');
  console.log('(Metro 로그에서 "Bearer" 뒤의 토큰 값)\n');

  // 환경변수로 받기
  const spotifyToken = process.env.SPOTIFY_TOKEN;
  if (!spotifyToken) {
    console.log('❌ SPOTIFY_TOKEN 환경변수가 없어요!');
    console.log('실행 방법: SPOTIFY_TOKEN=your_token node scripts/fix-spotify-ids.mjs');
    process.exit(1);
  }

  // 가짜 ID 가진 포스트 찾기
  const snap = await getDocs(collection(db, 'posts'));
  const needsFix = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.songData?.title && !isRealSpotifyId(p.songData?.spotifyId));

  console.log(`🔍 가짜/없는 spotifyId 포스트: ${needsFix.length}개\n`);

  let success = 0, failed = 0;

  for (const post of needsFix) {
    const { title, artist } = post.songData;
    process.stdout.write(`🎵 [${artist} - ${title}] ... `);

    const result = await searchSpotify(spotifyToken, title, artist);
    if (result?.spotifyId) {
      await updateDoc(doc(db, 'posts', post.id), {
        'songData.spotifyId': result.spotifyId,
        'songData.albumImageUrl': result.albumImageUrl,
      });
      console.log(`✅ ${result.spotifyId} | 🖼 ${result.albumImageUrl ? '있음' : '없음'}`);
      success++;
    } else {
      console.log('❌ 검색 실패');
      failed++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n🎉 완료! 성공 ${success} / 실패 ${failed}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
