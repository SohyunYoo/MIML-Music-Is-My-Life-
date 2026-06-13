import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAd93UKb1uoS87T2GmSMo32Kb-GzTFzrFg',
  authDomain: 'miml-af637.firebaseapp.com',
  projectId: 'miml-af637',
  storageBucket: 'miml-af637.firebasestorage.app',
  messagingSenderId: '436334131597',
  appId: '1:436334131597:web:1317900b4847bb39b525c4',
};

// 이미 초기화된 앱이 있으면 재사용 (핫리로드 대응)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  // 이미 초기화된 경우 기존 인스턴스 사용
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
