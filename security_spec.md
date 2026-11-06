# Pagade Firestore Security Specification

## 1. Data Invariants
1. **Identity Isolation**: Every `/players/{userId}` document can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId` and `incoming().uid == request.auth.uid`.
2. **Verified Account Requirement**: All write operations require `request.auth.token.email_verified == true`.
3. **No PII Leakage**: The `PlayerProgress` document stores no email, phone, or address fields; even so, `get` access is strictly limited to the document owner (`request.auth.uid == userId`), and `list` operations are completely denied (`allow list: if false;`).
4. **Strict Schema & Bounds**:
   - `uid`: string, length 1..128, matches `^[a-zA-Z0-9_\-]+$`
   - `displayName`: string, length 1..80
   - `provider`: `'google'` or `'apple'`
   - `highestUnlockedLevel`: int, 1..100000
   - `totalWins`, `totalCaptures`, `gloryPoints`: int, 0..100000000
   - `selectedDifficulty`: one of `['auto', 'beginner', 'intermediate', 'advanced', 'semi-pro', 'pro', 'super-pro', 'undisputed']`
   - `gameMode`: one of `['classic', 'quick_blitz']`
   - `autoMoveSingle`, `fastSpeed`: bool
   - `createdAt`, `updatedAt`: server timestamp (`request.time`)

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/players/user_1`.
2. **Unverified Email Spoof**: `auth.uid = 'user_1'`, `email_verified = false` attempting `create`.
3. **Cross-User Read (PII/State Scraping)**: `auth.uid = 'attacker'` attempting `get` on `/players/victim`.
4. **Cross-User Overwrite (Identity Spoofing)**: `auth.uid = 'attacker'` attempting `update` on `/players/victim`.
5. **Mismatched Body UID**: `auth.uid = 'user_1'` creating `/players/user_1` with `data.uid = 'user_2'`.
6. **Shadow / Ghost Field Injection**: Adding `isAdmin: true` or `extraGold: 9999` on `create` or `update`.
7. **Resource Exhaustion (1MB String)**: Setting `displayName` to a 5000-character string (`> 80`).
8. **Path ID Poisoning**: Creating `/players/invalid$id!with*spaces`.
9. **Negative / Out-of-Bounds Level**: Setting `highestUnlockedLevel: 0` or `-55`.
10. **Invalid Enum Injection**: Setting `selectedDifficulty: 'god_mode'` or `gameMode: 'hacked'`.
11. **Immortal Field Tampering**: Mutating `createdAt` or `uid` during an `update`.
12. **Forged Client Timestamp**: Sending a future or past `updatedAt` timestamp that does not equal `request.time`.
