# Pagade Firestore Security Specification

## 1. Data Invariants
1. **Identity Isolation (`/players/{userId}`)**: Every `/players/{userId}` document can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId` and `incoming().uid == request.auth.uid`, or by a verified administrator (`isAdmin()`).
2. **Verified Account Requirement**: All write operations require `request.auth.token.email_verified == true`.
3. **Bootstrapped Super-Admin & Delegated Admin RBAC (`/admin_emails/{emailId}`)**:
   - The primary owner (`pradyumnad777@gmail.com` with `email_verified == true`) is the bootstrapped Super-Admin (`isSuperAdmin()`).
   - Additional admins can be added to `/admin_emails/{emailId}` by an existing admin (`isAdmin()`).
   - Non-admins have zero read or write access (`allow read, write: if false`) to `/admin_emails/{emailId}`.
4. **Strict Schema & Bounds**:
   - `PlayerProgress`: `uid` (1..128), `displayName` (1..80), `provider` (`'google'|'apple'`), bounded integers, server timestamps (`request.time`).
   - `AdminGrant`: `email` (3..120), `role` (`'owner'|'admin'`), `addedBy` (3..120), `createdAt == request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/players/user_1`.
2. **Unverified Email Spoof**: `auth.uid = 'user_1'`, `email_verified = false` attempting `create`.
3. **Cross-User Read (PII/State Scraping)**: `auth.uid = 'attacker'` attempting `get` on `/players/victim`.
4. **Cross-User Overwrite (Identity Spoofing)**: `auth.uid = 'attacker'` attempting `update` on `/players/victim`.
5. **Mismatched Body UID**: `auth.uid = 'user_1'` creating `/players/user_1` with `data.uid = 'user_2'`.
6. **Shadow / Ghost Field Injection**: Adding `isAdmin: true` or `extraGold: 9999` on `create` or `update`.
7. **Resource Exhaustion (1MB String)**: Setting `displayName` to a 5000-character string (`> 80`).
8. **Path ID Poisoning**: Creating `/players/invalid$id!with*spaces`.
9. **Unauthorized Admin Self-Promotion**: Regular user (`regular@gmail.com`) attempting `create` on `/admin_emails/regular_at_gmail_dot_com`.
10. **Unverified Super-Admin Email Spoof**: User with `email: 'pradyumnad777@gmail.com'` but `email_verified: false` attempting to read or write `/admin_emails`.
11. **Immortal Field Tampering**: Mutating `createdAt` or `uid` during an `update`.
12. **Forged Client Timestamp**: Sending a future or past `updatedAt` timestamp that does not equal `request.time`.
