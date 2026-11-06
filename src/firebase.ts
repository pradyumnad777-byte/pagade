import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { DifficultyTierId } from './data/pagadeData';
import { GameMode } from './utils/pagadeEngine';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Validate connection to Firestore at boot as required by guidelines
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CloudPlayerPayload {
  highestUnlockedLevel: number;
  totalWins: number;
  totalCaptures: number;
  gloryPoints: number;
  selectedDifficulty: DifficultyTierId | 'auto';
  gameMode: GameMode;
  autoMoveSingle: boolean;
  fastSpeed: boolean;
}

/**
 * Fetches or initializes the authenticated player's `/players/{uid}` document in Firestore,
 * merging local progress with cloud progress so no unlocked levels or Glory are ever lost.
 */
export async function syncPlayerCloudProgress(
  uid: string,
  displayName: string,
  provider: 'google' | 'apple',
  localProgress: CloudPlayerPayload
): Promise<CloudPlayerPayload> {
  const path = `players/${uid}`;
  const playerRef = doc(db, 'players', uid);

  let snap;
  try {
    snap = await getDoc(playerRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const sanitizedName = (displayName || 'Royal Challenger').trim().slice(0, 80) || 'Royal Challenger';
  const validDifficulties = new Set([
    'auto',
    'beginner',
    'intermediate',
    'advanced',
    'semi-pro',
    'pro',
    'super-pro',
    'undisputed',
  ]);

  if (snap && snap.exists()) {
    const cloud = snap.data();
    const merged: CloudPlayerPayload = {
      highestUnlockedLevel: Math.min(
        100000,
        Math.max(1, localProgress.highestUnlockedLevel, Number(cloud.highestUnlockedLevel) || 1)
      ),
      totalWins: Math.min(
        100000000,
        Math.max(0, localProgress.totalWins, Number(cloud.totalWins) || 0)
      ),
      totalCaptures: Math.min(
        100000000,
        Math.max(0, localProgress.totalCaptures, Number(cloud.totalCaptures) || 0)
      ),
      gloryPoints: Math.min(
        100000000,
        Math.max(0, localProgress.gloryPoints, Number(cloud.gloryPoints) || 0)
      ),
      selectedDifficulty: validDifficulties.has(cloud.selectedDifficulty)
        ? cloud.selectedDifficulty
        : localProgress.selectedDifficulty,
      gameMode: cloud.gameMode === 'quick_blitz' ? 'quick_blitz' : localProgress.gameMode,
      autoMoveSingle:
        typeof cloud.autoMoveSingle === 'boolean'
          ? cloud.autoMoveSingle
          : localProgress.autoMoveSingle,
      fastSpeed:
        typeof cloud.fastSpeed === 'boolean' ? cloud.fastSpeed : localProgress.fastSpeed,
    };

    try {
      await updateDoc(playerRef, {
        displayName: sanitizedName,
        provider,
        highestUnlockedLevel: merged.highestUnlockedLevel,
        totalWins: merged.totalWins,
        totalCaptures: merged.totalCaptures,
        gloryPoints: merged.gloryPoints,
        selectedDifficulty: merged.selectedDifficulty,
        gameMode: merged.gameMode,
        autoMoveSingle: merged.autoMoveSingle,
        fastSpeed: merged.fastSpeed,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    return merged;
  } else {
    const initial: CloudPlayerPayload = {
      highestUnlockedLevel: Math.min(100000, Math.max(1, Math.floor(localProgress.highestUnlockedLevel))),
      totalWins: Math.min(100000000, Math.max(0, Math.floor(localProgress.totalWins))),
      totalCaptures: Math.min(100000000, Math.max(0, Math.floor(localProgress.totalCaptures))),
      gloryPoints: Math.min(100000000, Math.max(0, Math.floor(localProgress.gloryPoints))),
      selectedDifficulty: validDifficulties.has(localProgress.selectedDifficulty)
        ? localProgress.selectedDifficulty
        : 'auto',
      gameMode: localProgress.gameMode === 'quick_blitz' ? 'quick_blitz' : 'classic',
      autoMoveSingle: Boolean(localProgress.autoMoveSingle),
      fastSpeed: Boolean(localProgress.fastSpeed),
    };

    try {
      await setDoc(playerRef, {
        uid,
        displayName: sanitizedName,
        provider,
        highestUnlockedLevel: initial.highestUnlockedLevel,
        totalWins: initial.totalWins,
        totalCaptures: initial.totalCaptures,
        gloryPoints: initial.gloryPoints,
        selectedDifficulty: initial.selectedDifficulty,
        gameMode: initial.gameMode,
        autoMoveSingle: initial.autoMoveSingle,
        fastSpeed: initial.fastSpeed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return initial;
  }
}

export async function signInWithGooglePopup() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signInWithApplePopup() {
  const provider = new OAuthProvider('apple.com');
  return signInWithPopup(auth, provider);
}

export async function signOutFirebase() {
  return firebaseSignOut(auth);
}
