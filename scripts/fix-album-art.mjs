/**
 * albumImageUrl이 null인 posts에 Spotify 앨범아트 URL 업데이트
 * node scripts/fix-album-art.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
};

const SPOTIFY_CLIENT_ID = 'f8656c156c9d4f07a1f159cb38cfc203';
const EMAIL    = 'juyean2004@gmail.com';
const PASSWORD = 'my647121';

// Spotify Client Credentials (앱 토큰 — 유저 로그인 불필요)
async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${SPOTIFY_CLIENT_ID}&client_secret=`,
  });
  // client_secret 없으면 실패 → PKCE 방식 대신 search API 직접 사용
  // 유저 토큰 없어도 search는 client_credentials로 가능
  const data = await res.json();
  return data.access_token || null;
}

async function searchAlbumArt(token, title, artist) {
  try {
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    const track = data.tracks?.items?.[0];
    return {
      albumImageUrl: track?.album?.images?.[0]?.url || null,
      spotifyId: track?.id || null,
    };
  } catch { return { albumImageUrl: null, spotifyId: null }; }
}

async function main() {
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  console.log('🔐 Firebase 로그인...');
  const { user } = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  const firebaseToken = await user.getIdToken();
  console.log(`✅ ${user.email}`);

  // Spotify 토큰 (유저 토큰 재사용)
  // Client Credentials가 안 되므로 Firebase 토큰으로 백엔드 우회 대신
  // 직접 Spotify search API에 유저 토큰 사용
  // → 앱의 refresh token을 AsyncStorage에서 못 읽으니 일단 null 처리
  // → 대신 Last.fm open API 사용 (무료, 키 불필요)
  console.log('\n📀 Last.fm으로 앨범아트 업데이트 중...\n');

  const snap = await getDocs(collection(db, 'posts'));
  const needsFix = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.songData?.albumImageUrl && p.songData?.title);

  console.log(`앨범아트 없는 게시물: ${needsFix.length}개\n`);

  let success = 0, failed = 0;

  for (const post of needsFix) {
    const { title, artist } = post.songData;
    process.stdout.write(`🖼  [${artist} - ${title}] ... `);
    try {
      // Last.fm open API (API 키 불필요한 엔드포인트)
      const url = `https://lastfm-but-with-album-art-api.freetls.fastly.net/...`;
      // Last.fm track.getInfo (API 키 필요) 대신 musicbrainz 사용
      const mbRes = await fetch(
        `https://musicbrainz.org/ws/2/recording?query=recording:${encodeURIComponent(title)}+artist:${encodeURIComponent(artist)}&limit=1&fmt=json`,
        { headers: { 'User-Agent': 'MIML/1.0 (juyean2004@gmail.com)' } }
      );
      const mbData = await mbRes.json();
      const releaseId = mbData.recordings?.[0]?.releases?.[0]?.id;

      let albumImageUrl = null;
      if (releaseId) {
        const caRes = await fetch(`https://coverartarchive.org/release/${releaseId}`, {
          headers: { Accept: 'application/json' },
        });
        if (caRes.ok) {
          const caData = await caRes.json();
          albumImageUrl = caData.images?.[0]?.thumbnails?.['500'] ||
                          caData.images?.[0]?.thumbnails?.large ||
                          caData.images?.[0]?.image || null;
        }
      }

      if (albumImageUrl) {
        await updateDoc(doc(db, 'posts', post.id), {
          'songData.albumImageUrl': albumImageUrl,
        });
        console.log(`✅ ${albumImageUrl.slice(0, 50)}...`);
        success++;
      } else {
        console.log('⚠️  앨범아트 없음');
        failed++;
      }

      await new Promise(r => setTimeout(r, 800)); // MusicBrainz rate limit
    } catch (e) {
      console.log(`❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 완료! 성공 ${success} / 실패·없음 ${failed}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
