import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD2mvNMpSe52TjPWO9mw8-I7Bv3bCiPK8U',
  authDomain: 'sitediary-e91dd.firebaseapp.com',
  projectId: 'sitediary-e91dd',
  storageBucket: 'sitediary-e91dd.firebasestorage.app',
  messagingSenderId: '898373108005',
  appId: '1:898373108005:android:b38f71c2422ebd1799dacc',
};

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
