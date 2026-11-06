/**
 * Pagade Firestore Security Rules Verification Suite (Dirty Dozen Payloads)
 * Verifies that all 12 adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  auth: { uid: string; email_verified: boolean } | null;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    auth: null,
    path: '/players/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'Player' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    auth: { uid: 'user_1', email_verified: false },
    path: '/players/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'Player' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User Read Attempt',
    auth: { uid: 'attacker_1', email_verified: true },
    path: '/players/victim_1',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-User Update Attempt',
    auth: { uid: 'attacker_1', email_verified: true },
    path: '/players/victim_1',
    operation: 'update',
    payload: { highestUnlockedLevel: 99 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Mismatched Body UID',
    auth: { uid: 'user_1', email_verified: true },
    path: '/players/user_1',
    operation: 'create',
    payload: { uid: 'user_2', displayName: 'Player' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Field Injection',
    auth: { uid: 'user_1', email_verified: true },
    path: '/players/user_1',
    operation: 'update',
    payload: { highestUnlockedLevel: 5, isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Oversized DisplayName (>80 chars)',
    auth: { uid: 'user_1', email_verified: true },
    path: '/players/user_1',
    operation: 'update',
    payload: { displayName: 'A'.repeat(200) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Path ID Poisoning',
    auth: { uid: 'bad$id!', email_verified: true },
    path: '/players/bad$id!',
    operation: 'create',
    payload: { uid: 'bad$id!' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Negative Level Value',
    auth: { uid: 'user_1', email_verified: true },
    path: '/players/user_1',
    operation: 'update',
    payload: { highestUnlockedLevel: -10 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid Difficulty Enum',
    auth: { uid: 'user_1', email_verified: true },
    path: '/players/user_1',
    operation: 'update',
    payload: { selectedDifficulty: 'god_mode' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Immortal Field Tampering (createdAt)',
    auth: { uid: 'user_1', email_verified: true },
    path: '/players/user_1',
    operation: 'update',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Forged Client Timestamp (updatedAt != request.time)',
    auth: { uid: 'user_1', email_verified: true },
    path: '/players/user_1',
    operation: 'update',
    payload: { updatedAt: '2099-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
