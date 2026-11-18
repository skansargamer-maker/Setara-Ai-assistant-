import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function syncUserProfileToFirestore(profile: {
  uid: string;
  name: string;
  email: string;
  avatarUrl?: string;
  connectedMethods?: string[];
}) {
  if (!auth.currentUser || auth.currentUser.uid !== profile.uid) {
    return;
  }

  const safeUid = profile.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!safeUid || safeUid !== auth.currentUser.uid) {
    return;
  }

  const userPath = `users/${safeUid}`;
  const docRef = doc(db, 'users', safeUid);

  const sanitizedName = (profile.name || 'User').trim().slice(0, 100) || 'User';
  const sanitizedEmail = (profile.email || '').trim().toLowerCase().slice(0, 254);
  const methods = (profile.connectedMethods || ['google'])
    .map((m) => (m === 'email' ? 'password' : m))
    .filter((m): m is 'google' | 'password' => m === 'google' || m === 'password')
    .slice(0, 5);

  const safeAvatarUrl =
    profile.avatarUrl &&
    profile.avatarUrl.startsWith('http') &&
    profile.avatarUrl.length <= 2048
      ? profile.avatarUrl
      : undefined;

  try {
    const existingSnap = await getDoc(docRef);
    const payload: Record<string, any> = {
      uid: safeUid,
      name: sanitizedName,
      email: sanitizedEmail,
      connectedMethods: methods.length > 0 ? methods : ['google'],
      updatedAt: serverTimestamp(),
    };
    if (safeAvatarUrl) {
      payload.avatarUrl = safeAvatarUrl;
    }

    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      await setDoc(
        docRef,
        {
          ...payload,
          createdAt: existingData.createdAt || serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function deleteUserProfileFromFirestore(uid: string) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    return;
  }
  const userPath = `users/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userPath);
  }
}
