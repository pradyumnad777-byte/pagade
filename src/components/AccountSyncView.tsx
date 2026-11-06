import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Upload,
  UserCheck,
  LogOut,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Cloud,
  GitBranch,
  Server,
  ExternalLink,
  RefreshCw,
  FileCode2,
} from 'lucide-react';
import { DifficultyTierId } from '../data/pagadeData';
import { GameMode } from '../utils/pagadeEngine';
import {
  auth,
  signInWithGooglePopup,
  signInWithApplePopup,
  signOutFirebase,
  syncPlayerCloudProgress,
} from '../firebase';

export interface AccountProfile {
  uid?: string;
  provider: 'google' | 'apple';
  email: string;
  displayName: string;
  lastSyncedAt: string;
  isCloudSynced?: boolean;
}

export interface SyncableProgress {
  highestUnlockedLevel: number;
  totalWins: number;
  totalCaptures: number;
  gloryPoints: number;
  selectedDifficulty: DifficultyTierId | 'auto';
  gameMode: GameMode;
  autoMoveSingle: boolean;
  fastSpeed: boolean;
  accountProfile: AccountProfile | null;
}

interface GithubStatusResponse {
  repoName: string;
  connected: boolean;
  githubUser: { login: string; avatar_url?: string; html_url?: string } | null;
  hasOAuthCredentials: boolean;
  repoInfo: {
    exists: boolean;
    html_url?: string;
    default_branch?: string;
    branches?: string[];
  };
  servers: {
    development: { name: string; branch: string; url: string; status: string };
    production: { name: string; branch: string; url: string; status: string };
  };
  workspaceFilesCount: number;
  workspaceFiles: { relativePath: string; sizeBytes: number; isBinary: boolean }[];
}

interface ReleaseHistoryEntry {
  id: string;
  timestamp: string;
  commitSha: string;
  message: string;
  devSynced: boolean;
  prodSynced: boolean;
  repoUrl: string;
}

interface AccountSyncViewProps {
  progress: SyncableProgress;
  onUpdateProgress: (next: SyncableProgress) => void;
}

export const AccountSyncView: React.FC<AccountSyncViewProps> = ({
  progress,
  onUpdateProgress,
}) => {
  const [restoreCodeInput, setRestoreCodeInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [appleSetupNotice, setAppleSetupNotice] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // GitHub `pagade` Repository & 2-Server (Development / Production) Release Pipeline State
  const [githubStatus, setGithubStatus] = useState<GithubStatusResponse | null>(null);
  const [loadingGithub, setLoadingGithub] = useState<boolean>(false);
  const [approveDev, setApproveDev] = useState<boolean>(true);
  const [approveProd, setApproveProd] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>(
    'Sync latest Pagade game features & UI updates'
  );
  const [isPushingGithub, setIsPushingGithub] = useState<boolean>(false);
  const [githubNotice, setGithubNotice] = useState<string | null>(null);
  const [showFilesManifest, setShowFilesManifest] = useState<boolean>(false);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('pagade_github_releases_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchGithubStatus = useCallback(async () => {
    setLoadingGithub(true);
    try {
      const resp = await fetch('/api/github/status');
      if (resp.ok) {
        const data = (await resp.json()) as GithubStatusResponse;
        setGithubStatus(data);
      }
    } catch {
      // Ignore transient errors
    } finally {
      setLoadingGithub(false);
    }
  }, []);

  useEffect(() => {
    fetchGithubStatus();
  }, [fetchGithubStatus]);

  // Listen for OAuth popup completion message from `/auth/github/callback`
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setGithubNotice('GitHub connected! Ready to sync code to your "pagade" repository.');
        fetchGithubStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchGithubStatus]);

  const handleConnectGithubOAuth = async () => {
    setGithubNotice(null);
    try {
      const resp = await fetch('/api/github/auth-url');
      const data = await resp.json();
      if (!resp.ok || !data.url) {
        setGithubNotice(
          data.error ||
            'To connect GitHub, configure GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET or GITHUB_PERSONAL_ACCESS_TOKEN in AI Studio Secrets.'
        );
        return;
      }
      window.open(data.url, 'github_oauth_popup', 'width=600,height=720');
    } catch (err) {
      setGithubNotice(err instanceof Error ? err.message : 'Could not open GitHub OAuth.');
    }
  };

  const handleExecuteGithubSync = async () => {
    if (!approveDev && !approveProd) {
      setGithubNotice(
        'Both Development and Production are set to NO. Switch at least one server to YES to approve syncing.'
      );
      return;
    }

    setIsPushingGithub(true);
    setGithubNotice(null);
    try {
      const resp = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approveDevelopment: approveDev,
          approveProduction: approveProd,
          commitMessage,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setGithubNotice(data.error || 'GitHub sync failed.');
      } else {
        const entry: ReleaseHistoryEntry = {
          id: `${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          commitSha: data.commitSha,
          message: commitMessage,
          devSynced: approveDev,
          prodSynced: approveProd,
          repoUrl: data.repoUrl,
        };
        const updatedHistory = [entry, ...releaseHistory].slice(0, 8);
        setReleaseHistory(updatedHistory);
        try {
          localStorage.setItem('pagade_github_releases_v1', JSON.stringify(updatedHistory));
        } catch {
          // Ignore
        }
        setGithubNotice(
          `Pushed ${data.filesPushed} files (Commit #${data.commitSha}) to GitHub repository "pagade" on [${data.syncedBranches.join(
            ', '
          )}]!`
        );
        fetchGithubStatus();
      }
    } catch (err) {
      setGithubNotice(err instanceof Error ? err.message : 'Network error during GitHub sync.');
    } finally {
      setIsPushingGithub(false);
    }
  };

  const handleDownloadSourceBundle = async () => {
    try {
      const resp = await fetch('/api/github/export-bundle');
      if (!resp.ok) return;
      const data = await resp.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagade-repo-bundle-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setGithubNotice('Downloaded complete Pagade repository source bundle JSON.');
    } catch {
      setGithubNotice('Could not download source bundle.');
    }
  };

  const generatePassportCode = (): string => {
    const payload = {
      v: 2,
      lvl: progress.highestUnlockedLevel,
      w: progress.totalWins,
      c: progress.totalCaptures,
      g: progress.gloryPoints,
      d: progress.selectedDifficulty,
      m: progress.gameMode,
      acct: progress.accountProfile,
    };
    try {
      return 'PAGADE-' + btoa(encodeURIComponent(JSON.stringify(payload)));
    } catch {
      return '';
    }
  };

  const passportCode = generatePassportCode();

  const handleGoogleLogin = async () => {
    setIsSyncing(true);
    setFeedbackMsg(null);
    setAppleSetupNotice(false);
    try {
      const cred = await signInWithGooglePopup();
      const user = cred.user;
      const merged = await syncPlayerCloudProgress(
        user.uid,
        user.displayName || 'Royal Challenger',
        'google',
        progress
      );
      const profile: AccountProfile = {
        uid: user.uid,
        provider: 'google',
        email: user.email || 'Google Account',
        displayName: user.displayName || 'Royal Challenger',
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCloudSynced: true,
      };
      onUpdateProgress({
        ...progress,
        ...merged,
        accountProfile: profile,
      });
      setFeedbackMsg(
        `Signed in with Google (${profile.email})! Cloud progress synced to Firestore (Stage ${merged.highestUnlockedLevel}).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMsg(`Google sign-in notice: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsSyncing(true);
    setFeedbackMsg(null);
    try {
      const cred = await signInWithApplePopup();
      const user = cred.user;
      const merged = await syncPlayerCloudProgress(
        user.uid,
        user.displayName || 'Apple Challenger',
        'apple',
        progress
      );
      const profile: AccountProfile = {
        uid: user.uid,
        provider: 'apple',
        email: user.email || 'Apple ID',
        displayName: user.displayName || 'Apple Challenger',
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCloudSynced: true,
      };
      onUpdateProgress({
        ...progress,
        ...merged,
        accountProfile: profile,
      });
      setFeedbackMsg(
        `Signed in with Apple ID (${profile.email})! Cloud progress synced to Firestore.`
      );
    } catch {
      setAppleSetupNotice(true);
      setFeedbackMsg(
        'Apple Sign-In requires enabling the Apple provider in your Firebase Console, or use Google Sign-In / Royal Passport Code right away.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualCloudSync = async () => {
    if (!auth.currentUser || !progress.accountProfile) return;
    setIsSyncing(true);
    try {
      const merged = await syncPlayerCloudProgress(
        auth.currentUser.uid,
        progress.accountProfile.displayName,
        progress.accountProfile.provider,
        progress
      );
      onUpdateProgress({
        ...progress,
        ...merged,
        accountProfile: {
          ...progress.accountProfile,
          lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCloudSynced: true,
        },
      });
      setFeedbackMsg('Cloud database sync complete! Your progress is backed up in Firestore.');
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutFirebase();
    } catch {
      // Ignore
    }
    onUpdateProgress({
      ...progress,
      accountProfile: null,
    });
    setFeedbackMsg('Signed out of cloud account. Local stage progress remains safe on this device.');
  };

  const handleCopyPassport = async () => {
    try {
      await navigator.clipboard.writeText(passportCode);
      setCopiedCode(true);
      setFeedbackMsg('Royal Transfer Code copied! Paste it on any device to restore your account.');
      window.setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setFeedbackMsg('Select and copy the transfer code box manually.');
    }
  };

  const handleRestoreFromCode = async () => {
    const raw = restoreCodeInput.trim();
    if (!raw.startsWith('PAGADE-')) {
      setFeedbackMsg('Invalid code format. Make sure your code starts with PAGADE-.');
      return;
    }
    try {
      const base64Part = raw.replace(/^PAGADE-/, '');
      const decoded = JSON.parse(decodeURIComponent(atob(base64Part)));
      const restored: SyncableProgress = {
        ...progress,
        highestUnlockedLevel: Math.max(1, Number(decoded.lvl) || 1),
        totalWins: Math.max(0, Number(decoded.w) || 0),
        totalCaptures: Math.max(0, Number(decoded.c) || 0),
        gloryPoints: Math.max(0, Number(decoded.g) || 0),
        selectedDifficulty: decoded.d || 'auto',
        gameMode: decoded.m || 'classic',
        accountProfile: decoded.acct || progress.accountProfile,
      };
      onUpdateProgress(restored);
      setRestoreCodeInput('');

      if (auth.currentUser && restored.accountProfile) {
        await syncPlayerCloudProgress(
          auth.currentUser.uid,
          restored.accountProfile.displayName,
          restored.accountProfile.provider,
          restored
        );
      }

      setFeedbackMsg(
        `Account restored! Stage ${restored.highestUnlockedLevel} and ${restored.gloryPoints} Glory loaded.`
      );
    } catch {
      setFeedbackMsg('Could not decode transfer code. Please check that the entire code was pasted.');
    }
  };

  const devUrl =
    githubStatus?.servers.development.url ||
    'https://ais-dev-ibesgp6pbtqa2ru7kdzzyv-399442165368.asia-east1.run.app';
  const prodUrl =
    githubStatus?.servers.production.url ||
    'https://ais-pre-ibesgp6pbtqa2ru7kdzzyv-399442165368.asia-east1.run.app';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-5 pb-24 flex flex-col gap-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>GitHub Release Pipeline & Cloud Account Sync</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white mt-1">
            GitHub (`pagade`) & Cloud Control Center
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Manage your two live servers (Development & Production), approve syncing the latest Pagade code to your GitHub repository with explicit Yes/No gates, and sync player progress via Firebase.
          </p>
        </div>

        <div className="text-xs font-mono-num text-right shrink-0">
          <p className="text-slate-400">Current Progress</p>
          <p className="text-base font-bold text-amber-400 mt-0.5">
            Stage {progress.highestUnlockedLevel} · {progress.gloryPoints} Glory
          </p>
        </div>
      </div>

      {/* SECTION 1: GitHub Repository (`pagade`) & 2-Server (Dev / Prod) Approval Gate */}
      <div className="rounded-2xl border border-amber-500/30 bg-[#171F2C] p-5 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
              <GitBranch className="w-4 h-4" />
              <span>GitHub Repository:</span>
              <strong className="font-mono-num text-white">
                {githubStatus?.githubUser ? `${githubStatus.githubUser.login}/pagade` : 'pagade'}
              </strong>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-slate-300">
                {githubStatus?.workspaceFilesCount ?? 20} Tracked Files
              </span>
            </div>
            <h2 className="font-display text-lg font-bold text-white mt-1">
              Dual-Server GitHub Sync Gate (Development & Production)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Whenever you build new features, choose <strong>YES</strong> or <strong>NO</strong> below for each environment before syncing to your GitHub <code className="text-amber-300">pagade</code> repository.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {githubStatus?.connected && githubStatus.githubUser ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>@{githubStatus.githubUser.login}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGithubOAuth}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                <span>Connect GitHub Account</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchGithubStatus}
              disabled={loadingGithub}
              aria-label="Refresh GitHub status"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingGithub ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {githubNotice && (
          <div className="rounded-xl border border-amber-500/40 bg-slate-900/95 px-4 py-3 text-xs text-amber-200 flex items-center justify-between gap-3">
            <span>{githubNotice}</span>
            <button
              type="button"
              onClick={() => setGithubNotice(null)}
              className="text-amber-400 hover:underline font-medium shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Two Server Environment Cards with Explicit YES / NO Permission Gates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Server 1: Development Server */}
          <div
            className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-colors ${
              approveDev
                ? 'bg-slate-900/90 border-emerald-500/50'
                : 'bg-slate-900/40 border-slate-800'
            }`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Server className="w-4 h-4" />
                  <span>SERVER 1 · DEVELOPMENT</span>
                </div>
                <span className="font-mono-num text-xs text-slate-400">
                  Branch: <strong className="text-white">development</strong>
                </span>
              </div>

              <p className="text-xs text-slate-300">
                Active staging & feature testing server. Syncs new features to the <code className="text-emerald-300">development</code> branch of your <code className="text-white">pagade</code> repository.
              </p>

              <a
                href={devUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono-num text-amber-400 hover:underline flex items-center gap-1 truncate mt-1"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{devUrl}</span>
              </a>
            </div>

            {/* Explicit YES / NO Permission Selector */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-200">
                Sync to Development?
              </span>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setApproveDev(true)}
                  className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    approveDev
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setApproveDev(false)}
                  className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    !approveDev
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>
          </div>

          {/* Server 2: Production Server */}
          <div
            className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-colors ${
              approveProd
                ? 'bg-slate-900/90 border-amber-500/60'
                : 'bg-slate-900/40 border-slate-800'
            }`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <Server className="w-4 h-4" />
                  <span>SERVER 2 · PRODUCTION</span>
                </div>
                <span className="font-mono-num text-xs text-slate-400">
                  Branch: <strong className="text-white">production / main</strong>
                </span>
              </div>

              <p className="text-xs text-slate-300">
                Live player release server. Only pushes to <code className="text-amber-300">production</code> & <code className="text-amber-300">main</code> when you explicitly approve <strong>YES</strong>.
              </p>

              <a
                href={prodUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono-num text-amber-400 hover:underline flex items-center gap-1 truncate mt-1"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{prodUrl}</span>
              </a>
            </div>

            {/* Explicit YES / NO Permission Selector */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-200">
                Promote to Production?
              </span>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setApproveProd(true)}
                  className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    approveProd
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setApproveProd(false)}
                  className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    !approveProd
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Commit Message + Execute Approved Sync Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Describe the new feature or update being synced..."
            className="flex-1 h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
          />

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isPushingGithub || (!approveDev && !approveProd)}
              onClick={handleExecuteGithubSync}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                approveDev || approveProd
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-lg shadow-amber-500/15'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>
                {isPushingGithub
                  ? 'Pushing to GitHub...'
                  : `Sync Approved (Dev: ${approveDev ? 'YES' : 'NO'} · Prod: ${
                      approveProd ? 'YES' : 'NO'
                    })`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowFilesManifest((prev) => !prev)}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-4 h-4 text-amber-400" />
              <span>Files ({githubStatus?.workspaceFilesCount ?? 20})</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSourceBundle}
              title="Download full source bundle JSON"
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Bundle</span>
            </button>
          </div>
        </div>

        {/* Optional Expandable File Manifest */}
        {showFilesManifest && githubStatus && (
          <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Tracked Pagade Repository Files Ready to Sync:</span>
              <span className="font-mono-num">{githubStatus.workspaceFilesCount} files</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto text-[11px] font-mono-num text-slate-300">
              {githubStatus.workspaceFiles.map((f) => (
                <div
                  key={f.relativePath}
                  className="px-2 py-1 rounded bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-2 truncate"
                >
                  <span className="truncate">{f.relativePath}</span>
                  <span className="text-slate-500 shrink-0">
                    {(f.sizeBytes / 1024).toFixed(1)}KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sync Release Log */}
        {releaseHistory.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Recent Approved GitHub Releases (`pagade`)
            </span>
            <div className="flex flex-col gap-1.5">
              {releaseHistory.map((rel) => (
                <div
                  key={rel.id}
                  className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-num text-amber-400 font-semibold">
                      #{rel.commitSha}
                    </span>
                    <span className="text-slate-200 truncate">{rel.message}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-num text-[11px] shrink-0">
                    <span className={rel.devSynced ? 'text-emerald-400' : 'text-slate-500'}>
                      Dev: {rel.devSynced ? 'YES' : 'NO'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={rel.prodSynced ? 'text-amber-400' : 'text-slate-500'}>
                      Prod: {rel.prodSynced ? 'YES' : 'NO'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">{rel.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between gap-3">
          <span>{feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-400 hover:underline font-medium shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION 2: Player Account Cloud Sync (Google Gmail / Apple ID / Passport Code) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Card: Google Gmail & Apple ID Firebase Cloud Sign-In */}
        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">
                Player Cloud Login (Google & Apple)
              </h2>
              {progress.accountProfile ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cloud Connected</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400">Local Mode</span>
              )}
            </div>

            {progress.accountProfile ? (
              <div className="rounded-xl border border-amber-500/30 bg-slate-900/90 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                      {progress.accountProfile.provider === 'google' ? 'G' : ''}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {progress.accountProfile.displayName}
                      </p>
                      <p className="text-xs text-slate-300 truncate">
                        {progress.accountProfile.email} ·{' '}
                        {progress.accountProfile.provider === 'google' ? 'Google Gmail' : 'Apple ID'}
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-0.5">
                        Firestore Cloud Synced at {progress.accountProfile.lastSyncedAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {auth.currentUser && (
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={handleManualCloudSync}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                Click <strong className="text-white">Sign in with Google Gmail</strong> below to authenticate with your Google account via Firebase Popup Auth. Whenever you log in with the same account on another device, your highest unlocked stage and Glory points will automatically merge and restore.
              </p>
            )}

            {appleSetupNotice && (
              <div className="rounded-xl bg-slate-900/90 border border-amber-500/30 p-3.5 text-xs text-slate-300 flex flex-col gap-1">
                <p className="font-semibold text-amber-300">
                  How to enable Apple Sign-In in Firebase Console:
                </p>
                <p>
                  Google Login is pre-configured out of the box. To also use Apple Sign-In, open your Firebase Console → Authentication → Sign-in method → Add new provider → select <strong>Apple</strong>, enter your Apple Services ID & Team ID, and save.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleGoogleLogin}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserCheck className="w-4 h-4 text-rose-600" />
              <span>{isSyncing ? 'Connecting...' : 'Sign in with Google Gmail'}</span>
            </button>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleAppleLogin}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Sign in with Apple ID</span>
            </button>
          </div>
        </div>

        {/* Right Card: Cross-Device Passport Code Backup & Restore */}
        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">
                Instant Transfer Code (Any Device)
              </h2>
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Portable Backup</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              In addition to Firebase Cloud Sync, you can copy your <strong className="text-white">Royal Passport Code</strong> below to transfer Stage {progress.highestUnlockedLevel} and {progress.gloryPoints} Glory immediately between any two devices.
            </p>

            {/* Export Box */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={passportCode}
                aria-label="Your Royal Passport Transfer Code"
                className="flex-1 h-11 px-3 rounded-xl bg-slate-900 border border-slate-800 font-mono-num text-xs text-amber-300 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPassport}
                className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Import / Restore Box */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
              <label className="text-xs text-slate-300 font-medium">
                Have a Royal Passport Code from another device? Paste below to restore:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={restoreCodeInput}
                  onChange={(e) => setRestoreCodeInput(e.target.value)}
                  placeholder="Paste PAGADE-eyJ... code here"
                  className="flex-1 h-11 px-3 rounded-xl bg-slate-900 border border-slate-700 font-mono-num text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleRestoreFromCode}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Wins: {progress.totalWins} · Captures: {progress.totalCaptures}</span>
            </span>
            <span>Synced via Firestore & Passport Code</span>
          </div>
        </div>
      </div>
    </div>
  );
};
