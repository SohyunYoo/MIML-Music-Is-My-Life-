/**
 * 태그 없는 기존 posts에 AI 태그 생성해서 업데이트
 * node scripts/fix-tags.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
  storageBucket: 'miml-af637.firebasestorage.app',
  messagingSenderId: '436334131597',
  appId: '1:436334131597:web:1317900b4847bb39b525c4',
};

const BACKEND_URL = 'http://13.209.228.73:8080';
const EMAIL    = 'juyean2004@gmail.com';
const PASSWORD = 'my647121';

async function main() {
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  console.log('🔐 로그인 중...');
  const { user } = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  const token = await user.getIdToken();
  console.log(`✅ 로그인: ${user.email}`);

  // 태그 없는 posts 전부 가져오기
  const snap = await getDocs(collection(db, 'posts'));
  const needsFix = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.tags?.length);

  console.log(`📋 태그 없는 게시물: ${needsFix.length}개\n`);

  let success = 0, failed = 0, skipped = 0;

  for (const post of needsFix) {
    const review = post.content || post.review || '';
    const spotifyId = post.songData?.spotifyId;
    const title = post.songData?.title || post.song || '?';

    if (!spotifyId) {
      process.stdout.write(`⏭  [${title}] spotifyId 없음 — 스킵\n`);
      skipped++;
      continue;
    }

    process.stdout.write(`🏷  [${title}] 태그 생성 중... `);
    try {
      const res = await fetch(`${BACKEND_URL}/api/tags/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ review, spotifyId }),
      });

      if (!res.ok) {
        console.log(`❌ HTTP ${res.status}`);
        failed++;
        continue;
      }

      const data = await res.json();
      const tags = data.tags || [];

      await updateDoc(doc(db, 'posts', post.id), { tags });
      console.log(`→ ${tags.join(', ') || '없음'} ✅`);
      success++;

      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.log(`❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 완료! 성공 ${success} / 실패 ${failed} / 스킵 ${skipped}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
