import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// In-memory store for OAuth-acquired GitHub token (single-user workspace context)
let oauthGithubToken: string | null = null;
let oauthGithubUsername: string | null = null;

// Primary Owner Super-Admin + Delegated Admin Emails Allowlist
const OWNER_ADMIN_EMAIL = 'pradyumnad777@gmail.com';
const authorizedAdminEmails = new Set<string>([OWNER_ADMIN_EMAIL]);

function isEmailAuthorizedAdmin(emailHeader: unknown): boolean {
  if (typeof emailHeader !== 'string') return false;
  const clean = emailHeader.trim().toLowerCase();
  return clean.length > 0 && authorizedAdminEmails.has(clean);
}

const DEV_SERVER_URL =
  process.env.APP_URL ||
  'https://ais-dev-ibesgp6pbtqa2ru7kdzzyv-399442165368.asia-east1.run.app';
const PROD_SERVER_URL =
  'https://ais-pre-ibesgp6pbtqa2ru7kdzzyv-399442165368.asia-east1.run.app';

// Excluded directories and transient files when pushing to GitHub
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.aistudio']);
const IGNORED_FILES = new Set(['.env', '.env.local', 'DRAFT_firestore.rules', 'package-lock.json']);

interface RepoFileEntry {
  relativePath: string;
  sizeBytes: number;
  isBinary: boolean;
}

function collectWorkspaceFiles(dir: string, baseDir: string = dir): RepoFileEntry[] {
  const results: RepoFileEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      results.push(...collectWorkspaceFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      const stat = fs.statSync(fullPath);
      // Skip large binary files > 2.5MB
      if (stat.size > 2.5 * 1024 * 1024) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const isBinary = ['.jpg', '.jpeg', '.png', '.webp', '.ico', '.woff2'].includes(ext);
      results.push({
        relativePath: relPath,
        sizeBytes: stat.size,
        isBinary,
      });
    }
  }
  return results;
}

function getActiveGithubToken(): string | null {
  return oauthGithubToken || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || null;
}

async function githubApi(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('https://')
    ? endpoint
    : `https://api.github.com${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Pagade-Release-Pipeline',
      ...(options.headers || {}),
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 0. Sync or Update Authorized Admin Emails from Verified Client / Super-Admin
  app.get('/api/admin/list', (req, res) => {
    const callerEmail = req.headers['x-admin-email'];
    if (!isEmailAuthorizedAdmin(callerEmail)) {
      res.status(403).json({ error: 'Restricted to authorized Pagade administrators.' });
      return;
    }
    res.json({
      ownerEmail: OWNER_ADMIN_EMAIL,
      adminEmails: Array.from(authorizedAdminEmails),
    });
  });

  app.post('/api/admin/grant', (req, res) => {
    const callerEmail = req.headers['x-admin-email'];
    if (!isEmailAuthorizedAdmin(callerEmail)) {
      res.status(403).json({ error: 'Only an existing admin can grant server sync rights.' });
      return;
    }
    const { email, emails }: { email?: string; emails?: string[] } = req.body || {};
    if (typeof email === 'string' && email.includes('@')) {
      authorizedAdminEmails.add(email.trim().toLowerCase());
    }
    if (Array.isArray(emails)) {
      emails.forEach((em) => {
        if (typeof em === 'string' && em.includes('@')) {
          authorizedAdminEmails.add(em.trim().toLowerCase());
        }
      });
    }
    res.json({
      ownerEmail: OWNER_ADMIN_EMAIL,
      adminEmails: Array.from(authorizedAdminEmails),
    });
  });

  app.post('/api/admin/revoke', (req, res) => {
    const callerEmail = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
    if (callerEmail !== OWNER_ADMIN_EMAIL) {
      res.status(403).json({ error: 'Only the primary Owner Super-Admin can revoke admin emails.' });
      return;
    }
    const { email }: { email?: string } = req.body || {};
    if (typeof email === 'string') {
      const clean = email.trim().toLowerCase();
      if (clean !== OWNER_ADMIN_EMAIL) {
        authorizedAdminEmails.delete(clean);
      }
    }
    res.json({
      ownerEmail: OWNER_ADMIN_EMAIL,
      adminEmails: Array.from(authorizedAdminEmails),
    });
  });

  app.post('/api/admin/github-token', (req, res) => {
    const callerEmail = req.headers['x-admin-email'];
    if (!isEmailAuthorizedAdmin(callerEmail)) {
      res.status(403).json({ error: 'Restricted to authorized Pagade administrators.' });
      return;
    }
    const { token }: { token?: string } = req.body || {};
    if (typeof token === 'string' && token.trim().length > 0) {
      oauthGithubToken = token.trim();
      res.json({ connected: true });
    } else {
      res.status(400).json({ error: 'Valid GitHub token required.' });
    }
  });

  // 1. Inspect workspace files & connection status for `pagade` repository (Admin Only)
  app.get('/api/github/status', async (req, res) => {
    const callerEmail = req.headers['x-admin-email'];
    if (!isEmailAuthorizedAdmin(callerEmail)) {
      res.status(403).json({
        error: 'Access Denied: Only authorized Pagade admins can view server sync controls.',
      });
      return;
    }
    const files = collectWorkspaceFiles(__dirname);
    const token = getActiveGithubToken();
    const hasOAuthCredentials = Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    );

    let githubUser: { login: string; avatar_url?: string; html_url?: string } | null = null;
    let repoInfo: {
      exists: boolean;
      html_url?: string;
      default_branch?: string;
      branches?: string[];
    } = { exists: false };

    if (token) {
      try {
        const userResp = await githubApi('/user', token);
        if (userResp.ok) {
          const userData = (await userResp.json()) as {
            login: string;
            avatar_url?: string;
            html_url?: string;
          };
          githubUser = userData;
          oauthGithubUsername = userData.login;

          const repoResp = await githubApi(`/repos/${userData.login}/pagade`, token);
          if (repoResp.ok) {
            const repoData = (await repoResp.json()) as {
              html_url: string;
              default_branch: string;
            };
            const branchesResp = await githubApi(
              `/repos/${userData.login}/pagade/branches`,
              token
            );
            const branchesList = branchesResp.ok
              ? ((await branchesResp.json()) as { name: string }[]).map((b) => b.name)
              : [];
            repoInfo = {
              exists: true,
              html_url: repoData.html_url,
              default_branch: repoData.default_branch,
              branches: branchesList,
            };
          }
        }
      } catch {
        // Ignore transient network errors
      }
    }

    res.json({
      repoName: 'pagade',
      connected: Boolean(githubUser),
      githubUser,
      hasOAuthCredentials,
      repoInfo,
      servers: {
        development: {
          name: 'Development Server',
          branch: 'development',
          url: DEV_SERVER_URL,
          status: 'ONLINE',
        },
        production: {
          name: 'Production Server',
          branch: 'production',
          url: PROD_SERVER_URL,
          status: 'ONLINE',
        },
      },
      workspaceFilesCount: files.length,
      workspaceFiles: files,
    });
  });

  // 2. Construct GitHub OAuth Provider URL directly (following 3P OAuth iframe guidelines)
  app.get('/api/github/auth-url', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${DEV_SERVER_URL.replace(/\/$/, '')}/auth/github/callback`;

    if (!clientId) {
      res.status(400).json({
        error:
          'GITHUB_CLIENT_ID is not configured yet in AI Studio Secrets, or set GITHUB_PERSONAL_ACCESS_TOKEN.',
        redirectUri,
      });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user',
    });

    res.json({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
    });
  });

  // 3. GitHub OAuth Callback Handler (posts OAUTH_AUTH_SUCCESS to opener and closes popup)
  const githubCallbackHandler: express.RequestHandler = async (req, res) => {
    const code = String(req.query.code || '');
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (code && clientId && clientSecret) {
      try {
        const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
          }),
        });
        const tokenData = (await tokenResp.json()) as { access_token?: string };
        if (tokenData.access_token) {
          oauthGithubToken = tokenData.access_token;
        }
      } catch (err) {
        console.error('GitHub OAuth token exchange failed:', err);
      }
    }

    res.send(`
      <!doctype html>
      <html>
        <head><title>GitHub Connected</title></head>
        <body style="background:#0F141C;color:#F8FAFC;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'github' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>GitHub authentication complete. Closing window...</p>
        </body>
      </html>
    `);
  };

  app.get(['/auth/github/callback', '/auth/github/callback/'], githubCallbackHandler);

  // 4. Sync / Push workspace code to GitHub `pagade` repository based on explicit Yes/No approval
  //    for `development` and `production` branches (Restricted to Authorized Admins).
  app.post('/api/github/sync', async (req, res) => {
    const callerEmail = req.headers['x-admin-email'];
    if (!isEmailAuthorizedAdmin(callerEmail)) {
      res.status(403).json({
        error:
          'Access Denied: Only the Owner (pradyumnad777@gmail.com) or an authorized Admin email can sync Development or Production servers.',
      });
      return;
    }

    const {
      approveDevelopment,
      approveProduction,
      commitMessage,
    }: {
      approveDevelopment: boolean;
      approveProduction: boolean;
      commitMessage?: string;
    } = req.body || {};

    if (!approveDevelopment && !approveProduction) {
      res.status(400).json({
        error:
          'Both Development and Production sync were set to NO. Approve at least one environment (YES) to push to GitHub.',
      });
      return;
    }

    const token = getActiveGithubToken();
    if (!token) {
      res.status(401).json({
        error:
          'GitHub is not connected yet. Connect your GitHub account via OAuth or add GITHUB_PERSONAL_ACCESS_TOKEN in AI Studio Secrets.',
      });
      return;
    }

    try {
      // 1. Identify authenticated GitHub user
      const userResp = await githubApi('/user', token);
      if (!userResp.ok) {
        res.status(401).json({ error: 'Invalid or expired GitHub authorization token.' });
        return;
      }
      const userData = (await userResp.json()) as { login: string };
      const owner = userData.login;
      const repo = 'pagade';

      // 2. Check if `pagade` repo exists; create it with auto_init: true if not
      let repoResp = await githubApi(`/repos/${owner}/${repo}`, token);
      if (repoResp.status === 404) {
        const createResp = await githubApi('/user/repos', token, {
          method: 'POST',
          body: JSON.stringify({
            name: repo,
            description:
              'Pagade — Royal Single-Player Ludo Campaign vs Shakuni (Development & Production Servers)',
            private: false,
            auto_init: true,
          }),
        });
        if (!createResp.ok) {
          res.status(403).json({
            error: `Repository '${owner}/pagade' does not exist yet or your Fine-Grained Token doesn't have 'Administration: Read and write' to auto-create repos. Please create an empty repository named 'pagade' at https://github.com/new (and grant your token 'Contents: Read and write' on it), then click Sync Approved again.`,
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 1200));
        repoResp = await githubApi(`/repos/${owner}/${repo}`, token);
      }

      const repoData = (await repoResp.json()) as {
        default_branch: string;
        html_url: string;
      };
      const defaultBranch = repoData.default_branch || 'main';

      // 3. Get base commit SHA from defaultBranch (or initialize empty repo if 404/409)
      let refResp = await githubApi(
        `/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
        token
      );
      if (!refResp.ok) {
        // Repo exists but is completely empty (0 commits) — initialize with README.md via Contents API
        const initResp = await githubApi(
          `/repos/${owner}/${repo}/contents/README.md`,
          token,
          {
            method: 'PUT',
            body: JSON.stringify({
              message: 'Initialize Pagade repository',
              content: Buffer.from(
                '# Pagade — Royal Ludo Campaign vs Shakuni\n\nSingle-player Ludo campaign with Development and Production release branches.\n'
              ).toString('base64'),
              branch: defaultBranch,
            }),
          }
        );
        if (!initResp.ok) {
          const errDetail = await initResp.text();
          res.status(403).json({
            error: `Cannot write to '${owner}/${repo}'. Please ensure your Fine-Grained Personal Access Token has 'Contents: Read and write' permission enabled for '${owner}/pagade'. (${errDetail})`,
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
        refResp = await githubApi(
          `/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
          token
        );
      }
      if (!refResp.ok) {
        res.status(500).json({
          error: `Could not read default branch (${defaultBranch}) reference from ${owner}/${repo}.`,
        });
        return;
      }
      const refData = (await refResp.json()) as { object: { sha: string } };
      const baseCommitSha = refData.object.sha;

      // 4. Create blobs for all workspace files & construct Git tree
      const files = collectWorkspaceFiles(__dirname);
      const treeItems: {
        path: string;
        mode: '100644';
        type: 'blob';
        sha: string;
      }[] = [];

      for (const file of files) {
        const fullPath = path.join(__dirname, file.relativePath);
        const rawBuffer = fs.readFileSync(fullPath);
        const base64Content = rawBuffer.toString('base64');

        const blobResp = await githubApi(`/repos/${owner}/${repo}/git/blobs`, token, {
          method: 'POST',
          body: JSON.stringify({
            content: base64Content,
            encoding: 'base64',
          }),
        });

        if (blobResp.ok) {
          const blobData = (await blobResp.json()) as { sha: string };
          treeItems.push({
            path: file.relativePath,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha,
          });
        }
      }

      const treeResp = await githubApi(`/repos/${owner}/${repo}/git/trees`, token, {
        method: 'POST',
        body: JSON.stringify({
          tree: treeItems,
        }),
      });
      if (!treeResp.ok) {
        res.status(500).json({ error: 'Failed to create Git tree for Pagade workspace.' });
        return;
      }
      const treeData = (await treeResp.json()) as { sha: string };

      // 5. Create commit
      const cleanMessage =
        (commitMessage || '').trim() ||
        `Sync Pagade game release (${[
          approveDevelopment ? 'development' : null,
          approveProduction ? 'production' : null,
        ]
          .filter(Boolean)
          .join(' & ')})`;

      const commitResp = await githubApi(`/repos/${owner}/${repo}/git/commits`, token, {
        method: 'POST',
        body: JSON.stringify({
          message: cleanMessage,
          tree: treeData.sha,
          parents: [baseCommitSha],
        }),
      });
      if (!commitResp.ok) {
        res.status(500).json({ error: 'Failed to create Git commit on GitHub.' });
        return;
      }
      const commitData = (await commitResp.json()) as { sha: string };
      const newCommitSha = commitData.sha;

      // Helper to update or create a branch ref
      const upsertBranch = async (branchName: string) => {
        const checkRef = await githubApi(
          `/repos/${owner}/${repo}/git/ref/heads/${branchName}`,
          token
        );
        if (checkRef.ok) {
          await githubApi(`/repos/${owner}/${repo}/git/refs/heads/${branchName}`, token, {
            method: 'PATCH',
            body: JSON.stringify({
              sha: newCommitSha,
              force: true,
            }),
          });
        } else {
          await githubApi(`/repos/${owner}/${repo}/git/refs`, token, {
            method: 'POST',
            body: JSON.stringify({
              ref: `refs/heads/${branchName}`,
              sha: newCommitSha,
            }),
          });
        }
      };

      const syncedBranches: string[] = [];
      if (approveDevelopment) {
        await upsertBranch('development');
        syncedBranches.push('development');
      }
      if (approveProduction) {
        await upsertBranch('production');
        // Also keep defaultBranch synced when Production is approved
        await upsertBranch(defaultBranch);
        syncedBranches.push('production');
      }

      res.json({
        success: true,
        repoUrl: repoData.html_url,
        commitSha: newCommitSha.slice(0, 7),
        filesPushed: treeItems.length,
        syncedBranches,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected GitHub sync error.',
      });
    }
  });

  // 5. Generate a portable git push bundle script for local CLI / dual-remote execution
  app.get('/api/github/export-bundle', (_req, res) => {
    const files = collectWorkspaceFiles(__dirname).filter((f) => !f.isBinary);
    const filePayload: Record<string, string> = {};
    for (const f of files) {
      filePayload[f.relativePath] = fs.readFileSync(path.join(__dirname, f.relativePath), 'utf-8');
    }
    res.json({
      repoName: 'pagade',
      filesCount: files.length,
      files: filePayload,
    });
  });

  // ============================================================================
  // 6. Real-Time Authoritative Multiplayer Room Engine (Max 4 Players, Instant Start for 2/3/4 Players)
  // ============================================================================
  type SeatIdx = 0 | 1 | 2 | 3;

  interface MpPlayer {
    playerId: string;
    playerName: string;
    playerTag: string;
    seat: SeatIdx;
    isHost: boolean;
    dryStreak: number;
    consecutiveSixes: number;
    joinedAt: number;
  }

  interface MpToken {
    id: string;
    seat: SeatIdx;
    tokenIndex: number; // 0..3
    step: number; // -1 = yard, 0..50 = main track, 51..55 = home stretch, 56 = home goal
  }

  interface MpMoveCandidate {
    tokenIndex: number;
    fromStep: number;
    toStep: number;
    exitsYard: boolean;
    reachesHome: boolean;
    landsOnSafe: boolean;
    formsJodiBlock: boolean;
    capturesTokens: { seat: SeatIdx; tokenIndex: number }[];
  }

  interface MpRoom {
    code: string;
    hostPlayerId: string;
    status: 'waiting' | 'playing' | 'finished';
    gameMode: 'classic' | 'quick_blitz';
    players: MpPlayer[];
    tokens: MpToken[];
    turnSeat: SeatIdx;
    diceValue: number | null;
    lastRolledValue: number | null;
    lastRolledSeat: SeatIdx | null;
    lastMovedTokenId: string | null;
    validMoves: MpMoveCandidate[];
    winnerSeat: SeatIdx | null;
    statusBanner: string;
    updatedAt: number;
  }

  const mpRooms = new Map<string, MpRoom>();
  const MP_SAFE_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);
  const SEAT_OFFSETS: Record<SeatIdx, number> = {
    0: 0,
    1: 13,
    2: 26,
    3: 39,
  };

  function getMpGlobalTrackIndex(seat: SeatIdx, step: number): number | null {
    if (step < 0 || step > 50) return null;
    return (SEAT_OFFSETS[seat] + step) % 52;
  }

  function computeMpValidMoves(
    tokens: MpToken[],
    actingSeat: SeatIdx,
    diceVal: number
  ): MpMoveCandidate[] {
    const candidates: MpMoveCandidate[] = [];
    const myTokens = tokens.filter((t) => t.seat === actingSeat);
    const otherTokens = tokens.filter((t) => t.seat !== actingSeat);

    for (const token of myTokens) {
      if (token.step === 56) continue;

      if (token.step === -1) {
        if (diceVal === 6) {
          const toStep = 0;
          const destGlobal = getMpGlobalTrackIndex(actingSeat, toStep)!;
          const landsOnSafe = MP_SAFE_INDICES.has(destGlobal);
          const friendlyAtStart = myTokens.filter(
            (m) => m.tokenIndex !== token.tokenIndex && m.step === 0
          );
          candidates.push({
            tokenIndex: token.tokenIndex,
            fromStep: -1,
            toStep: 0,
            exitsYard: true,
            reachesHome: false,
            landsOnSafe,
            formsJodiBlock: friendlyAtStart.length >= 1,
            capturesTokens: [],
          });
        }
        continue;
      }

      const toStep = token.step + diceVal;
      if (toStep > 56) continue;

      const reachesHome = toStep === 56;
      const destGlobal = getMpGlobalTrackIndex(actingSeat, toStep);
      const landsOnSafe =
        reachesHome ||
        toStep >= 51 ||
        (destGlobal !== null && MP_SAFE_INDICES.has(destGlobal));

      const friendlyAtDest =
        destGlobal !== null
          ? myTokens.filter(
              (m) =>
                m.tokenIndex !== token.tokenIndex &&
                getMpGlobalTrackIndex(actingSeat, m.step) === destGlobal
            )
          : [];
      const formsJodiBlock = destGlobal !== null && friendlyAtDest.length >= 1;

      const capturesTokens: { seat: SeatIdx; tokenIndex: number }[] = [];
      if (destGlobal !== null && !landsOnSafe) {
        // Group opponent tokens on destGlobal by their seat so we respect Jodi pair blockades (2+ of same seat)
        const oppOnSquare = otherTokens.filter(
          (o) => getMpGlobalTrackIndex(o.seat, o.step) === destGlobal
        );
        const bySeat = new Map<SeatIdx, MpToken[]>();
        for (const o of oppOnSquare) {
          const list = bySeat.get(o.seat) || [];
          list.push(o);
          bySeat.set(o.seat, list);
        }
        for (const [oppSeat, list] of bySeat.entries()) {
          // Single opponent pawn on non-safe square is captured; 2+ of same seat is a Jodi fortress
          if (list.length === 1) {
            capturesTokens.push({ seat: oppSeat, tokenIndex: list[0].tokenIndex });
          }
        }
      }

      candidates.push({
        tokenIndex: token.tokenIndex,
        fromStep: token.step,
        toStep,
        exitsYard: false,
        reachesHome,
        landsOnSafe,
        formsJodiBlock,
        capturesTokens,
      });
    }

    return candidates;
  }

  function getNextActiveSeat(room: MpRoom, currentSeat: SeatIdx): SeatIdx {
    const activeSeats = room.players.map((p) => p.seat).sort((a, b) => a - b);
    if (activeSeats.length === 0) return 0;
    const idx = activeSeats.indexOf(currentSeat);
    if (idx === -1) return activeSeats[0];
    return activeSeats[(idx + 1) % activeSeats.length];
  }

  function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const code = `PG${suffix}`;
    return mpRooms.has(code) ? generateRoomCode() : code;
  }

  function createInitialRoomTokens(players: MpPlayer[]): MpToken[] {
    const tokens: MpToken[] = [];
    for (const p of players) {
      for (let i = 0; i < 4; i++) {
        tokens.push({
          id: `s${p.seat}-${i}`,
          seat: p.seat,
          tokenIndex: i,
          // Pawn #1 (index 0) starts deployed at step 0 so every player can move immediately!
          step: i === 0 ? 0 : -1,
        });
      }
    }
    return tokens;
  }

  // Create a new Multiplayer Battle Room (Max 4 players)
  app.post('/api/multiplayer/create', (req, res) => {
    const {
      playerId,
      playerName,
      playerTag,
      gameMode,
    }: {
      playerId?: string;
      playerName?: string;
      playerTag?: string;
      gameMode?: 'classic' | 'quick_blitz';
    } = req.body || {};

    const cleanId = (playerId || `p_${Date.now()}`).trim();
    const cleanName = (playerName || 'Challenger').trim().slice(0, 24) || 'Challenger';
    const cleanTag = (playerTag || 'PGD-101').trim().slice(0, 16) || 'PGD-101';
    const code = generateRoomCode();

    const hostPlayer: MpPlayer = {
      playerId: cleanId,
      playerName: cleanName,
      playerTag: cleanTag,
      seat: 0,
      isHost: true,
      dryStreak: 0,
      consecutiveSixes: 0,
      joinedAt: Date.now(),
    };

    const room: MpRoom = {
      code,
      hostPlayerId: cleanId,
      status: 'waiting',
      gameMode: gameMode === 'quick_blitz' ? 'quick_blitz' : 'classic',
      players: [hostPlayer],
      tokens: createInitialRoomTokens([hostPlayer]),
      turnSeat: 0,
      diceValue: null,
      lastRolledValue: null,
      lastRolledSeat: null,
      lastMovedTokenId: null,
      validMoves: [],
      winnerSeat: null,
      statusBanner: `Room ${code} created by ${cleanName} (${cleanTag}). Share code to connect up to 4 players or start anytime!`,
      updatedAt: Date.now(),
    };

    mpRooms.set(code, room);
    res.json({ room });
  });

  // Join an existing Multiplayer Room by Code (Strictly max 4 players)
  app.post('/api/multiplayer/join', (req, res) => {
    const {
      code,
      playerId,
      playerName,
      playerTag,
    }: {
      code?: string;
      playerId?: string;
      playerName?: string;
      playerTag?: string;
    } = req.body || {};

    const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = mpRooms.get(cleanCode);
    if (!room) {
      res.status(404).json({ error: `Room "${cleanCode}" not found. Check the 6-character code.` });
      return;
    }

    const cleanId = (playerId || `p_${Date.now()}`).trim();
    const cleanName = (playerName || 'Challenger').trim().slice(0, 24) || 'Challenger';
    const cleanTag = (playerTag || 'PGD-101').trim().slice(0, 16) || 'PGD-101';

    // Check if this device/player is already in the room (reconnect / update name)
    const existing = room.players.find((p) => p.playerId === cleanId);
    if (existing) {
      existing.playerName = cleanName;
      existing.playerTag = cleanTag;
      room.updatedAt = Date.now();
      res.json({ room });
      return;
    }

    // Strict 4-player cap: Never allow more than 4 players
    if (room.players.length >= 4) {
      res.status(400).json({
        error: 'This room already has the maximum of 4 players. Only 4 players are allowed per battle.',
      });
      return;
    }

    if (room.status !== 'waiting') {
      res.status(400).json({
        error: 'This match is already in progress. Create a new room or wait for rematch.',
      });
      return;
    }

    const takenSeats = new Set(room.players.map((p) => p.seat));
    const availableSeats: SeatIdx[] = ([0, 1, 2, 3] as SeatIdx[]).filter(
      (s) => !takenSeats.has(s)
    );
    const assignedSeat: SeatIdx = availableSeats[0] ?? 0;

    const newPlayer: MpPlayer = {
      playerId: cleanId,
      playerName: cleanName,
      playerTag: cleanTag,
      seat: assignedSeat,
      isHost: false,
      dryStreak: 0,
      consecutiveSixes: 0,
      joinedAt: Date.now(),
    };

    room.players.push(newPlayer);
    room.players.sort((a, b) => a.seat - b.seat);
    room.tokens = createInitialRoomTokens(room.players);
    room.statusBanner = `${cleanName} (${cleanTag}) joined Seat #${assignedSeat + 1}! (${room.players.length}/4 players ready)`;
    room.updatedAt = Date.now();

    res.json({ room });
  });

  // Update Player Name & Custom ID inside an active or waiting room
  app.post('/api/multiplayer/update-profile', (req, res) => {
    const {
      code,
      playerId,
      playerName,
      playerTag,
    }: {
      code?: string;
      playerId?: string;
      playerName?: string;
      playerTag?: string;
    } = req.body || {};

    const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = mpRooms.get(cleanCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    const player = room.players.find((p) => p.playerId === playerId);
    if (player) {
      if (playerName && playerName.trim()) {
        player.playerName = playerName.trim().slice(0, 24);
      }
      if (playerTag && playerTag.trim()) {
        player.playerTag = playerTag.trim().slice(0, 16);
      }
      room.updatedAt = Date.now();
    }

    res.json({ room });
  });

  // Start Match: Starts immediately for 2, 3, or 4 players (or even 1 player) with NO minimum player validation blocking it!
  app.post('/api/multiplayer/start', (req, res) => {
    const {
      code,
      gameMode,
    }: {
      code?: string;
      playerId?: string;
      gameMode?: 'classic' | 'quick_blitz';
    } = req.body || {};

    const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = mpRooms.get(cleanCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    if (room.players.length > 4) {
      res.status(400).json({ error: 'Maximum 4 players allowed.' });
      return;
    }

    if (gameMode) {
      room.gameMode = gameMode === 'quick_blitz' ? 'quick_blitz' : 'classic';
    }

    room.players.sort((a, b) => a.seat - b.seat);
    for (const p of room.players) {
      p.dryStreak = 0;
      p.consecutiveSixes = 0;
    }

    room.tokens = createInitialRoomTokens(room.players);
    room.status = 'playing';
    room.turnSeat = room.players[0]?.seat ?? 0;
    room.diceValue = null;
    room.lastRolledValue = null;
    room.lastRolledSeat = null;
    room.lastMovedTokenId = null;
    room.validMoves = [];
    room.winnerSeat = null;

    const firstPlayer = room.players.find((p) => p.seat === room.turnSeat);
    room.statusBanner = `Battle started with ${room.players.length} player${
      room.players.length === 1 ? '' : 's'
    }! ${firstPlayer?.playerName || 'Seat 1'}'s turn to cast the ivory dice.`;
    room.updatedAt = Date.now();

    res.json({ room });
  });

  // Roll Dice in Multiplayer Battle
  app.post('/api/multiplayer/roll', (req, res) => {
    const { code, playerId }: { code?: string; playerId?: string } = req.body || {};
    const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = mpRooms.get(cleanCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    if (room.status !== 'playing' || room.winnerSeat !== null) {
      res.status(400).json({ error: 'Match is not currently active.' });
      return;
    }

    const activePlayer = room.players.find((p) => p.seat === room.turnSeat);
    if (!activePlayer || activePlayer.playerId !== playerId) {
      res.status(403).json({ error: 'Wait for your turn to roll the dice.' });
      return;
    }

    if (room.diceValue !== null) {
      res.status(400).json({ error: 'Dice already rolled—select a glowing pawn to move.' });
      return;
    }

    // Roll 1..6 with Pity-6 protection & 3-six cap
    const lockedCount = room.tokens.filter(
      (t) => t.seat === room.turnSeat && t.step === -1
    ).length;

    let rolled: number;
    if (activePlayer.consecutiveSixes >= 2) {
      rolled = Math.floor(Math.random() * 5) + 1;
    } else if (lockedCount > 0 && activePlayer.dryStreak >= 5) {
      rolled = 6;
    } else {
      rolled = Math.floor(Math.random() * 6) + 1;
    }

    if (rolled === 6) {
      activePlayer.dryStreak = 0;
    } else if (lockedCount > 0) {
      activePlayer.dryStreak += 1;
    }

    room.lastRolledValue = rolled;
    room.lastRolledSeat = room.turnSeat;

    const moves = computeMpValidMoves(room.tokens, room.turnSeat, rolled);

    if (moves.length === 0) {
      activePlayer.consecutiveSixes = 0;
      const nextSeat = getNextActiveSeat(room, room.turnSeat);
      const nextPlayer = room.players.find((p) => p.seat === nextSeat);
      room.diceValue = null;
      room.validMoves = [];
      room.turnSeat = nextSeat;
      room.statusBanner = `${activePlayer.playerName} rolled ${rolled} (no legal moves) · ${
        nextPlayer?.playerName || 'Next player'
      }'s turn!`;
      room.updatedAt = Date.now();
      res.json({ room });
      return;
    }

    room.diceValue = rolled;
    room.validMoves = moves;
    room.statusBanner = `${activePlayer.playerName} rolled ${rolled}! Select a glowing pawn to advance.`;
    room.updatedAt = Date.now();

    res.json({ room });
  });

  // Move Pawn in Multiplayer Battle
  app.post('/api/multiplayer/move', (req, res) => {
    const {
      code,
      playerId,
      tokenIndex,
    }: {
      code?: string;
      playerId?: string;
      tokenIndex?: number;
    } = req.body || {};

    const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = mpRooms.get(cleanCode);
    if (!room || room.status !== 'playing' || room.diceValue === null) {
      res.status(400).json({ error: 'No active roll to move.' });
      return;
    }

    const activePlayer = room.players.find((p) => p.seat === room.turnSeat);
    if (!activePlayer || activePlayer.playerId !== playerId) {
      res.status(403).json({ error: 'Not your turn.' });
      return;
    }

    const chosenMove = room.validMoves.find((m) => m.tokenIndex === Number(tokenIndex));
    if (!chosenMove) {
      res.status(400).json({ error: 'Invalid pawn selection for this roll.' });
      return;
    }

    const rolledVal = room.diceValue;
    let capturedCount = 0;

    room.tokens = room.tokens.map((t) => {
      if (t.seat === room.turnSeat && t.tokenIndex === chosenMove.tokenIndex) {
        return { ...t, step: chosenMove.toStep };
      }
      if (
        chosenMove.capturesTokens.some(
          (cap) => cap.seat === t.seat && cap.tokenIndex === t.tokenIndex
        )
      ) {
        capturedCount++;
        return { ...t, step: -1 };
      }
      return t;
    });

    room.lastMovedTokenId = `s${room.turnSeat}-${chosenMove.tokenIndex}`;
    room.diceValue = null;
    room.validMoves = [];

    const targetHome = room.gameMode === 'quick_blitz' ? 2 : 4;
    const finishedCount = room.tokens.filter(
      (t) => t.seat === room.turnSeat && t.step === 56
    ).length;

    if (finishedCount >= targetHome) {
      room.winnerSeat = room.turnSeat;
      room.status = 'finished';
      room.statusBanner = `Victory! ${activePlayer.playerName} (${activePlayer.playerTag}) led ${targetHome} pawns into the Royal Mandapa!`;
      room.updatedAt = Date.now();
      res.json({ room });
      return;
    }

    const grantsBonusTurn =
      rolledVal === 6 || capturedCount > 0 || chosenMove.reachesHome;

    if (grantsBonusTurn) {
      activePlayer.consecutiveSixes = rolledVal === 6 ? activePlayer.consecutiveSixes + 1 : 0;
      const reason =
        capturedCount > 0
          ? 'captured an opponent pawn'
          : chosenMove.reachesHome
          ? 'guided a pawn Home'
          : 'rolled a 6';
      room.statusBanner = `${activePlayer.playerName} ${reason}! Bonus roll granted—cast again.`;
    } else {
      activePlayer.consecutiveSixes = 0;
      const nextSeat = getNextActiveSeat(room, room.turnSeat);
      const nextPlayer = room.players.find((p) => p.seat === nextSeat);
      room.turnSeat = nextSeat;
      room.statusBanner = `${activePlayer.playerName} moved Pawn #${
        chosenMove.tokenIndex + 1
      } (${rolledVal} steps) · ${nextPlayer?.playerName || 'Next player'}'s turn!`;
    }

    room.updatedAt = Date.now();
    res.json({ room });
  });

  // Poll Room State by Code
  app.get('/api/multiplayer/room/:code', (req, res) => {
    const cleanCode = String(req.params.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const room = mpRooms.get(cleanCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    res.json({ room });
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pagade server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
