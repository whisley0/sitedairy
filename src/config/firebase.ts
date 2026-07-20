import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// RN-only helper — present in the React Native Firebase Auth bundle, missing from web typings.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof ReactNativeAsyncStorage) => unknown;
};

const firebaseConfig = {
  apiKey: 'AIzaSyD2mvNMpSe52TjPWO9mw8-I7Bv3bCiPK8U',
  authDomain: 'sitediary-e91dd.firebaseapp.com',
  projectId: 'sitediary-e91dd',
  storageBucket: 'sitediary-e91dd.firebasestorage.app',
  messagingSenderId: '898373108005',
  appId: '1:898373108005:android:b38f71c2422ebd1799dacc',
};

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage) as never,
    });
  } catch {
    // Hot reload / second init — Auth already registered for this app.
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();
export const db = getFirestore(firebaseApp);
