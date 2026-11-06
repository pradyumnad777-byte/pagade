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
