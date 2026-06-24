import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import type { DummyUser } from './models';
import type { AuthRepository } from './repositories';

/**
 * Real Firebase Email/Password auth — not used in the dummy app yet.
 * Swap DummyAuthRepository for this in App.tsx when ready.
 */
export class FirebaseAuthRepository implements AuthRepository {
  async signIn(email: string, password: string): Promise<DummyUser> {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    return {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? user.email ?? '',
    };
  }

  async signUp(email: string, password: string, displayName: string): Promise<DummyUser> {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    return { uid: result.user.uid, email, displayName };
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  currentUser(): DummyUser | null {
    const user = auth.currentUser;
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? user.email ?? '',
    };
  }
}
