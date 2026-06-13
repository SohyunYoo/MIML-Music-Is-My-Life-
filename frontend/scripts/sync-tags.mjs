import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp({
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
});

const auth = getAuth(app);
const { user } = await signInWithEmailAndPassword(auth, 'juyean2004@gmail.com', 'my647121');
const token = await user.getIdToken();
console.log('✅ 로그인 완료');

console.log('🔄 sync-community-tags 호출 중...');
const res = await fetch('http://13.209.228.73:8080/api/admin/bulk-import/sync-community-tags', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(120000), // 2분 타임아웃
});
const text = await res.text();
console.log(`STATUS: ${res.status}`);
console.log(`RESPONSE: ${text}`);
process.exit(0);
