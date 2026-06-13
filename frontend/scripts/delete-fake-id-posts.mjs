import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
};

const EMAIL    = 'juyean2004@gmail.com';
const PASSWORD = 'my647121';

const isRealSpotifyId = (id) => !!id && /^[A-Za-z0-9]{22}$/.test(id);

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('🔐 로그인 중...');
  const { user } = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log(`✅ ${user.email}`);

  const snap = await getDocs(collection(db, 'posts'));
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const toDelete = all.filter(p => {
    const spotifyId = p.songData?.spotifyId;
    // spotifyId가 없거나 가짜인 것만 삭제
    // (null, undefined, "spotify_xxx" 형태)
    return spotifyId !== undefined && spotifyId !== null && !isRealSpotifyId(spotifyId);
  });

  const toKeep = all.filter(p => {
    const spotifyId = p.songData?.spotifyId;
    return !spotifyId || isRealSpotifyId(spotifyId);
  });

  console.log(`\n✅ 유지할 게시물: ${toKeep.length}개 (진짜 ID or ID 없음)`);
  console.log(`🗑  삭제할 게시물: ${toDelete.length}개 (가짜 ID)\n`);

  if (toDelete.length === 0) {
    console.log('삭제할 게시물이 없어요!');
    process.exit(0);
  }

  // 삭제 목록 미리 보기
  toDelete.slice(0, 5).forEach(p =>
    console.log(`  - [${p.songData?.title}] spotifyId: ${p.songData?.spotifyId}`)
  );
  if (toDelete.length > 5) console.log(`  ... 외 ${toDelete.length - 5}개`);
  console.log('');

  let count = 0;
  for (const p of toDelete) {
    process.stdout.write(`삭제: [${p.songData?.title || p.song}] (${p.songData?.spotifyId}) ... `);
    await deleteDoc(doc(db, 'posts', p.id));
    console.log('✅');
    count++;
  }

  console.log(`\n🎉 완료! ${count}개 삭제, ${toKeep.length}개 유지`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
