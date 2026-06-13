import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
};

const EMAIL    = 'juyean2004@gmail.com';
const PASSWORD = 'my647121';

// 2026년 6월 8일 오후 9시 15분 40초 UTC+9 = 오후 12시 15분 40초 UTC
const CUTOFF = new Date('2026-06-08T12:15:40.000Z').getTime();

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('🔐 로그인 중...');
  const { user } = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log(`✅ ${user.email}`);

  const snap = await getDocs(collection(db, 'posts'));
  const toDelete = snap.docs.filter(d => {
    const ts = d.data().createdAt?.toMillis?.() || 0;
    return ts >= CUTOFF;
  });

  console.log(`\n🗑  삭제할 게시물: ${toDelete.length}개 (${new Date(CUTOFF).toLocaleString('ko-KR')} 이후)\n`);

  let count = 0;
  for (const d of toDelete) {
    const data = d.data();
    process.stdout.write(`삭제: [${data.songData?.title || data.song}] ... `);
    await deleteDoc(doc(db, 'posts', d.id));
    console.log('✅');
    count++;
  }

  console.log(`\n🎉 완료! ${count}개 삭제됨`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
