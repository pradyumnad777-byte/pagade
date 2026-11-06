/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crown,
  Map,
  Sparkles,
  BookOpen,
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowLeft,
  Shield,
  Zap,
  Trophy,
  Swords,
  Music,
  UserCheck,
  Gauge,
  BarChart3,
  Users,
  Edit3,
  Shuffle,
  ImagePlus,
} from 'lucide-react';
import {
  DIFFICULTY_TIERS,
  PLAYER_SKILLS,
  PlayerSkill,
  SkillId,
  getLevelNodeInfo,
} from './data/pagadeData';
import {
  ANIMATED_AVATAR_PRESETS,
  compressImageFileToDataUrl,
  resolvePlayerAvatar,
} from './data/avatars';
import {
  GameMode,
  MoveCandidate,
  Owner,
  Token,
  chooseShakuniMove,
  getValidMoves,
  rollPagadeDice,
} from './utils/pagadeEngine';
import { sound } from './utils/sound';
import { PagadeBoard } from './components/PagadeBoard';
import { IvoryDice } from './components/IvoryDice';
import { CampaignPathView } from './components/CampaignPathView';
import { SkillsArmoryView } from './components/SkillsArmoryView';
import { RulesGuideView } from './components/RulesGuideView';
import { AccountSyncView, SyncableProgress } from './components/AccountSyncView';
import { MultiplayerBattleView } from './components/MultiplayerBattleView';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, syncPlayerCloudProgress } from './firebase';

// Generated asset paths
const SHAKUNI_AVATAR = '/src/assets/images/shakuni_avatar_portrait_1793947874829.jpg';
const PLAYER_AVATAR = '/src/assets/images/player_avatar_portrait_1793947877320.jpg';
const PALACE_BANNER = '/src/assets/images/pagade_palace_banner_1793947876375.jpg';

type NavTab = 'campaign' | 'match' | 'multiplayer' | 'armory' | 'rules' | 'account';

const STORAGE_KEY = 'pagade_royal_campaign_v2';

function createInitialTokens(): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < 4; i++) {
    // Deploy Pawn #1 (index 0) onto the starting square (step 0) at match start so players can move on the board right away!
    tokens.push({ id: `p-${i}`, owner: 'player', tokenIndex: i, step: i === 0 ? 0 : -1 });
    tokens.push({ id: `s-${i}`, owner: 'shakuni', tokenIndex: i, step: i === 0 ? 0 : -1 });
  }
  return tokens;
}

export default function App() {
  // Persistent Campaign & Account Progression
  const [progress, setProgress] = useState<SyncableProgress>(() => {
    const defaultTag = `PGD-${Math.floor(100 + Math.random() * 899)}`;
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('pagade_royal_campaign_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          customPlayerName:
            parsed.customPlayerName ||
            parsed.accountProfile?.displayName ||
            'Royal Challenger',
          customPlayerTag: parsed.customPlayerTag || defaultTag,
          customPlayerAvatar: parsed.customPlayerAvatar || null,
          highestUnlockedLevel: Math.max(1, Number(parsed.highestUnlockedLevel) || 1),
          totalWins: Number(parsed.totalWins) || 0,
          totalCaptures: Number(parsed.totalCaptures) || 0,
          gloryPoints: Number(parsed.gloryPoints) || 0,
          selectedDifficulty: parsed.selectedDifficulty || 'auto',
          gameMode: parsed.gameMode === 'quick_blitz' ? 'quick_blitz' : 'classic',
          autoMoveSingle: parsed.autoMoveSingle !== undefined ? Boolean(parsed.autoMoveSingle) : false,
          fastSpeed: parsed.fastSpeed !== undefined ? Boolean(parsed.fastSpeed) : false,
          accountProfile: parsed.accountProfile || null,
        };
      }
    } catch {
      // Ignore storage errors
    }
    return {
      customPlayerName: 'Royal Challenger',
      customPlayerTag: defaultTag,
      customPlayerAvatar: null,
      highestUnlockedLevel: 1,
      totalWins: 0,
      totalCaptures: 0,
      gloryPoints: 0,
      selectedDifficulty: 'auto',
      gameMode: 'classic',
      autoMoveSingle: false,
      fastSpeed: false,
      accountProfile: null,
    };
  });

  const [isEditingHudId, setIsEditingHudId] = useState<boolean>(false);
  const [hudNameDraft, setHudNameDraft] = useState<string>(progress.customPlayerName);
  const [hudTagDraft, setHudTagDraft] = useState<string>(progress.customPlayerTag);

  useEffect(() => {
    setHudNameDraft(progress.customPlayerName);
    setHudTagDraft(progress.customPlayerTag);
  }, [progress.customPlayerName, progress.customPlayerTag]);

  const handleUpdatePlayerIdentity = useCallback((newName: string, newTag: string) => {
    const cleanName = newName.trim().slice(0, 24) || 'Royal Challenger';
    const cleanTag =
      newTag
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-_]/g, '')
        .slice(0, 16) || 'PGD-777';
    setProgress((prev) => ({
      ...prev,
      customPlayerName: cleanName,
      customPlayerTag: cleanTag,
      accountProfile: prev.accountProfile
        ? { ...prev.accountProfile, displayName: cleanName }
        : null,
    }));
  }, []);

  const handleUpdatePlayerAvatar = useCallback((newAvatar: string | null) => {
    setProgress((prev) => ({
      ...prev,
      customPlayerAvatar: newAvatar,
    }));
  }, []);

  const activePlayerAvatar = resolvePlayerAvatar(
    progress.customPlayerAvatar,
    progress.accountProfile?.photoUrl || auth.currentUser?.photoURL || null
  );

  // Listen for Firebase Auth state and automatically restore/merge cloud progress
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const isApple = user.providerData.some((p) => p.providerId.includes('apple'));
      const provider: 'google' | 'apple' = isApple ? 'apple' : 'google';
      try {
        const merged = await syncPlayerCloudProgress(
          user.uid,
          progress.customPlayerName || user.displayName || 'Royal Challenger',
          provider,
          progress
        );
        setProgress((prev) => ({
          ...prev,
          ...merged,
          customPlayerName:
            prev.customPlayerName && prev.customPlayerName !== 'Royal Challenger'
              ? prev.customPlayerName
              : user.displayName || 'Royal Challenger',
          accountProfile: {
            uid: user.uid,
            provider,
            email: user.email || 'Cloud Account',
            displayName:
              prev.customPlayerName && prev.customPlayerName !== 'Royal Challenger'
                ? prev.customPlayerName
                : user.displayName || 'Royal Challenger',
            photoUrl: user.photoURL || prev.accountProfile?.photoUrl || null,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isCloudSynced: true,
          },
        }));
      } catch {
        // Handled by structured Firestore error logger
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      if (auth.currentUser && progress.accountProfile) {
        syncPlayerCloudProgress(
          auth.currentUser.uid,
          progress.customPlayerName || progress.accountProfile.displayName,
          progress.accountProfile.provider,
          progress
        ).catch(() => {});
      }
    } catch {
      // Ignore storage errors
    }
  }, [
    progress.customPlayerName,
    progress.customPlayerTag,
    progress.customPlayerAvatar,
    progress.highestUnlockedLevel,
    progress.totalWins,
    progress.totalCaptures,
    progress.gloryPoints,
    progress.selectedDifficulty,
    progress.gameMode,
    progress.autoMoveSingle,
    progress.fastSpeed,
  ]);

  // Orientation detection for flexible Portrait & Landscape layout
  const [isMobileLandscape, setIsMobileLandscape] = useState<boolean>(false);
  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobileLandscape(w > h && h < 620);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const [activeTab, setActiveTab] = useState<NavTab>('campaign');
  const [selectedLevel, setSelectedLevel] = useState<number>(progress.highestUnlockedLevel);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [bgmPlaying, setBgmPlaying] = useState<boolean>(false);

  // Active Match State
  const [matchLevel, setMatchLevel] = useState<number>(progress.highestUnlockedLevel);
  const [tokens, setTokens] = useState<Token[]>(() => createInitialTokens());
  const [turn, setTurn] = useState<Owner>('player');
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [lastRolledValue, setLastRolledValue] = useState<number | null>(null);
  const [lastRolledOwner, setLastRolledOwner] = useState<Owner | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>('Cast the ivory dice to begin your turn.');
  const [shakuniLine, setShakuniLine] = useState<string>('Let us see what fate the ivory sticks hold!');
  const [winner, setWinner] = useState<Owner | null>(null);
  const [newlyUnlockedSkill, setNewlyUnlockedSkill] = useState<PlayerSkill | null>(null);
  const [lastMovedTokenId, setLastMovedTokenId] = useState<string | null>(null);

  // Store-Review Transparency & Anti-Frustration Counters
  const [playerDryStreak, setPlayerDryStreak] = useState<number>(0);
  const [consecutiveSixes, setConsecutiveSixes] = useState<number>(0);
  const [playerRollHistory, setPlayerRollHistory] = useState<number[]>([]);
  const [shakuniRollHistory, setShakuniRollHistory] = useState<number[]>([]);
  const [showFairnessLog, setShowFairnessLog] = useState<boolean>(false);

  // Active Skill States in Match
  const [skillCharges, setSkillCharges] = useState<Record<SkillId, number>>({
    loaded_ivory: 0,
    reroll_mantra: 0,
    kavacha_shield: 0,
    royal_stride: 0,
    shakuni_mirror: 0,
    garuda_leap: 0,
    golden_pasa: 0,
    sovereign_decree: 0,
  });
  const [forceNextSix, setForceNextSix] = useState<boolean>(false);
  const [playerShieldRounds, setPlayerShieldRounds] = useState<number>(0);
  const [bonusDiceSteps, setBonusDiceSteps] = useState<number>(0);
  const [moveMultiplier, setMoveMultiplier] = useState<number>(1);
  const [shakuniCappedToThree, setShakuniCappedToThree] = useState<boolean>(false);
  const [showExactPicker, setShowExactPicker] = useState<boolean>(false);

  const botTimerRef = useRef<number | null>(null);
  const autoMoveTimerRef = useRef<number | null>(null);

  const currentMatchNode = getLevelNodeInfo(matchLevel, progress.selectedDifficulty);
  const unlockedSkills = PLAYER_SKILLS.filter(
    (s) => s.unlockLevel <= progress.highestUnlockedLevel
  );
  const targetHomeCount = progress.gameMode === 'quick_blitz' ? 2 : 4;

  // Increment turnCounter whenever a turn or bonus turn begins so Shakuni's bot loop always fires cleanly
  const [turnCounter, setTurnCounter] = useState<number>(0);

  // Initialize or Reset a Match for a given Stage Level
  const startMatchAtLevel = useCallback(
    (lvl: number) => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
      if (autoMoveTimerRef.current) window.clearTimeout(autoMoveTimerRef.current);

      const node = getLevelNodeInfo(lvl, progress.selectedDifficulty);
      setMatchLevel(lvl);
      setSelectedLevel(lvl);
      setTokens(createInitialTokens());
      setTurn('player');
      setTurnCounter((c) => c + 1);
      setDiceValue(null);
      setLastRolledValue(null);
      setLastRolledOwner(null);
      setIsRolling(false);
      setWinner(null);
      setNewlyUnlockedSkill(null);
      setLastMovedTokenId(null);
      setForceNextSix(false);
      setPlayerShieldRounds(0);
      setBonusDiceSteps(0);
      setMoveMultiplier(1);
      setShakuniCappedToThree(false);
      setShowExactPicker(false);
      setPlayerDryStreak(0);
      setConsecutiveSixes(0);
      setPlayerRollHistory([]);
      setShakuniRollHistory([]);

      const initialCharges: Record<SkillId, number> = {
        loaded_ivory: 0,
        reroll_mantra: 0,
        kavacha_shield: 0,
        royal_stride: 0,
        shakuni_mirror: 0,
        garuda_leap: 0,
        golden_pasa: 0,
        sovereign_decree: 0,
      };
      for (const sk of PLAYER_SKILLS) {
        if (sk.unlockLevel <= progress.highestUnlockedLevel) {
          initialCharges[sk.id] = sk.maxChargesPerMatch;
        }
      }
      setSkillCharges(initialCharges);

      setStatusBanner(`Stage ${lvl} (${node.tier.name}) · Cast the ivory dice.`);
      setShakuniLine(node.tier.shakuniQuote);
      setActiveTab('match');
      sound.play('click');
    },
    [progress.highestUnlockedLevel, progress.selectedDifficulty]
  );

  const effectivePlayerDice =
    diceValue !== null ? Math.min(6, diceValue + bonusDiceSteps) : null;

  const validPlayerMoves: MoveCandidate[] =
    turn === 'player' && effectivePlayerDice !== null && !winner
      ? getValidMoves(tokens, 'player', effectivePlayerDice, moveMultiplier, false)
      : [];

  // Execute a chosen move (for either Player or Shakuni)
  const executeMove = useCallback(
    (move: MoveCandidate, actingOwner: Owner, rolledVal: number) => {
      let capturedCount = 0;
      const updatedTokens = tokens.map((t) => {
        if (t.owner === actingOwner && t.tokenIndex === move.tokenIndex) {
          return { ...t, step: move.toStep };
        }
        if (
          move.capturesTokens.some(
            (cap) => cap.owner === t.owner && cap.tokenIndex === t.tokenIndex
          )
        ) {
          capturedCount++;
          return { ...t, step: -1 };
        }
        return t;
      });

      const movedId = `${actingOwner === 'player' ? 'p' : 's'}-${move.tokenIndex}`;
      setLastMovedTokenId(movedId);
      setTokens(updatedTokens);
      setDiceValue(null);
      setBonusDiceSteps(0);
      setMoveMultiplier(1);

      if (capturedCount > 0) {
        sound.play('capture');
      } else if (move.reachesHome) {
        sound.play('home');
      } else if (move.formsJodiBlock) {
        sound.play('safe_block');
      } else {
        sound.play('step');
      }

      // Check if actingOwner has reached targetHomeCount (4 in Classic, 2 in Quick Blitz)
      const finishedCount = updatedTokens.filter(
        (t) => t.owner === actingOwner && t.step === 56
      ).length;

      if (finishedCount >= targetHomeCount) {
        setWinner(actingOwner);
        if (actingOwner === 'player') {
          sound.play('victory');
          const nextLevel = Math.max(progress.highestUnlockedLevel, matchLevel + 1);
          const unlockedNow =
            matchLevel === progress.highestUnlockedLevel
              ? PLAYER_SKILLS.find((s) => s.unlockLevel === nextLevel) || null
              : null;
          setNewlyUnlockedSkill(unlockedNow);

          setProgress((prev) => ({
            ...prev,
            highestUnlockedLevel: Math.max(prev.highestUnlockedLevel, matchLevel + 1),
            totalWins: prev.totalWins + 1,
            totalCaptures: prev.totalCaptures + capturedCount,
            gloryPoints: prev.gloryPoints + currentMatchNode.xpReward,
          }));
          setStatusBanner(`Victory! You conquered Stage ${matchLevel}!`);
          setShakuniLine('Impossible! You read the ivory dice better than the masters of Gandhara!');
        } else {
          sound.play('defeat');
          setStatusBanner(`Shakuni led ${targetHomeCount} tokens into the Royal Mandapa.`);
          setShakuniLine('Did I not warn you? My ivory dice never miss their mark!');
        }
        return;
      }

      if (actingOwner === 'player' && capturedCount > 0) {
        setProgress((prev) => ({
          ...prev,
          totalCaptures: prev.totalCaptures + capturedCount,
        }));
      }

      const grantsBonusTurn =
        rolledVal === 6 || capturedCount > 0 || move.reachesHome;

      if (grantsBonusTurn) {
        setConsecutiveSixes((prev) => (rolledVal === 6 ? prev + 1 : 0));
        if (actingOwner === 'player') {
          const reason =
            capturedCount > 0
              ? 'Captured Shakuni’s pawn!'
              : move.reachesHome
              ? 'Pawn entered the Royal Mandapa!'
              : 'Rolled a 6!';
          setStatusBanner(`${reason} Bonus roll granted—cast again.`);
        } else {
          const reason =
            capturedCount > 0
              ? 'Shakuni captured your pawn!'
              : move.reachesHome
              ? 'Shakuni’s pawn reached Home!'
              : 'Shakuni rolled a 6!';
          setStatusBanner(`${reason} Shakuni casts again...`);
        }
        setTurnCounter((c) => c + 1);
      } else {
        setConsecutiveSixes(0);
        if (actingOwner === 'player') {
          setTurn('shakuni');
          setTurnCounter((c) => c + 1);
          setStatusBanner(`You moved Pawn #${move.tokenIndex + 1} (${rolledVal} steps) · Shakuni's turn...`);
        } else {
          setTurn('player');
          setTurnCounter((c) => c + 1);
          setPlayerShieldRounds((prev) => Math.max(0, prev - 1));
          setStatusBanner(`Shakuni rolled ${rolledVal} and moved Pawn #${move.tokenIndex + 1} · Your turn!`);
        }
      }
    },
    [
      tokens,
      targetHomeCount,
      progress.highestUnlockedLevel,
      matchLevel,
      currentMatchNode.xpReward,
    ]
  );

  // Handle Player Dice Cast
  const handlePlayerRoll = useCallback(
    (forcedExactValue?: number) => {
      if (turn !== 'player' || diceValue !== null || isRolling || winner) return;

      setIsRolling(true);
      setShowExactPicker(false);
      sound.play('roll');

      const animDelay = progress.fastSpeed ? 120 : 220;

      window.setTimeout(() => {
        let rolled = forcedExactValue;
        if (!rolled) {
          if (forceNextSix) {
            rolled = 6;
            setForceNextSix(false);
          } else {
            rolled = rollPagadeDice(
              'player',
              tokens,
              currentMatchNode.tier,
              matchLevel,
              false,
              playerDryStreak,
              consecutiveSixes
            );
          }
        }

        // Update Pity-6 dry streak counter
        const lockedInYard = tokens.filter((t) => t.owner === 'player' && t.step === -1).length;
        if (rolled === 6) {
          setPlayerDryStreak(0);
        } else if (lockedInYard > 0) {
          setPlayerDryStreak((prev) => prev + 1);
        }

        setPlayerRollHistory((prev) => [...prev.slice(-19), rolled!]);
        setIsRolling(false);
        setDiceValue(rolled!);
        setLastRolledValue(rolled!);
        setLastRolledOwner('player');

        const effVal = Math.min(6, rolled! + bonusDiceSteps);
        const moves = getValidMoves(tokens, 'player', effVal, moveMultiplier, false);

        if (moves.length === 0) {
          setStatusBanner(`You rolled ${rolled} · No legal move available. Passing turn to Shakuni...`);
          window.setTimeout(
            () => {
              setDiceValue(null);
              setBonusDiceSteps(0);
              setMoveMultiplier(1);
              setConsecutiveSixes(0);
              setTurn('shakuni');
              setTurnCounter((c) => c + 1);
              setStatusBanner(`You rolled ${rolled} (no legal move) · Shakuni is casting...`);
            },
            progress.fastSpeed ? 800 : 1200
          );
        } else if (
          progress.autoMoveSingle &&
          (moves.length === 1 || moves.every((m) => m.fromStep === moves[0].fromStep))
        ) {
          setStatusBanner(`You rolled ${rolled} · Auto-advancing Pawn #${moves[0].tokenIndex + 1}...`);
          autoMoveTimerRef.current = window.setTimeout(
            () => {
              executeMove(moves[0], 'player', effVal);
            },
            progress.fastSpeed ? 450 : 750
          );
        } else {
          setStatusBanner(
            `You got ${rolled}! Tap your glowing Pawn on the board (or its green button below) to move ${effVal * moveMultiplier} steps.`
          );
        }
      }, animDelay);
    },
    [
      turn,
      diceValue,
      isRolling,
      winner,
      progress.fastSpeed,
      progress.autoMoveSingle,
      forceNextSix,
      tokens,
      currentMatchNode.tier,
      matchLevel,
      playerDryStreak,
      consecutiveSixes,
      bonusDiceSteps,
      moveMultiplier,
      executeMove,
    ]
  );

  // Keep latest mutable references for Shakuni's turn timer so state transitions inside the timer never cancel it
  const latestBotContextRef = useRef({
    tokens,
    tier: currentMatchNode.tier,
    matchLevel,
    shakuniCappedToThree,
    consecutiveSixes,
    playerShieldRounds,
    fastSpeed: progress.fastSpeed,
    executeMove,
  });

  useEffect(() => {
    latestBotContextRef.current = {
      tokens,
      tier: currentMatchNode.tier,
      matchLevel,
      shakuniCappedToThree,
      consecutiveSixes,
      playerShieldRounds,
      fastSpeed: progress.fastSpeed,
      executeMove,
    };
  });

  // Shakuni Automated Bot Turn Loop — depends ONLY on [activeTab, turn, turnCounter, winner]
  // so calling setIsRolling(true) or setDiceValue(botRoll) inside the timer NEVER cancels the timer!
  useEffect(() => {
    if (activeTab !== 'match' || turn !== 'shakuni' || winner) return;

    let t1: number | null = null;
    let t2: number | null = null;
    let t3: number | null = null;

    const { fastSpeed } = latestBotContextRef.current;
    const thinkDelay = fastSpeed ? 320 : 550;
    const rollAnimDelay = fastSpeed ? 180 : 300;

    t1 = window.setTimeout(() => {
      setIsRolling(true);
      sound.play('roll');

      t2 = window.setTimeout(() => {
        const ctx = latestBotContextRef.current;
        const botRoll = rollPagadeDice(
          'shakuni',
          ctx.tokens,
          ctx.tier,
          ctx.matchLevel,
          ctx.shakuniCappedToThree,
          0,
          ctx.consecutiveSixes
        );
        if (ctx.shakuniCappedToThree) {
          setShakuniCappedToThree(false);
        }

        setShakuniRollHistory((prev) => [...prev.slice(-19), botRoll]);
        setIsRolling(false);
        setDiceValue(botRoll);
        setLastRolledValue(botRoll);
        setLastRolledOwner('shakuni');

        const botMoves = getValidMoves(
          ctx.tokens,
          'shakuni',
          botRoll,
          1,
          ctx.playerShieldRounds > 0
        );

        if (botMoves.length === 0) {
          setStatusBanner(`Shakuni rolled ${botRoll} · No legal moves.`);
          t3 = window.setTimeout(
            () => {
              setDiceValue(null);
              setConsecutiveSixes(0);
              setTurn('player');
              setTurnCounter((c) => c + 1);
              setPlayerShieldRounds((prev) => Math.max(0, prev - 1));
              setStatusBanner(`Shakuni rolled ${botRoll} (no move) · Your turn to cast!`);
            },
            ctx.fastSpeed ? 550 : 900
          );
        } else {
          const chosen = chooseShakuniMove(
            botMoves,
            ctx.tokens,
            ctx.tier,
            ctx.matchLevel
          );
          setStatusBanner(`Shakuni rolled ${botRoll} · Moving Pawn #${chosen.tokenIndex + 1}...`);
          t3 = window.setTimeout(
            () => {
              latestBotContextRef.current.executeMove(chosen, 'shakuni', botRoll);
            },
            ctx.fastSpeed ? 420 : 700
          );
        }
      }, rollAnimDelay);
    }, thinkDelay);

    return () => {
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      if (t3) window.clearTimeout(t3);
    };
  }, [activeTab, turn, turnCounter, winner]);

  // Activate a Player Tactical Skill during Match
  const handleUseSkill = (skill: PlayerSkill) => {
    if (turn !== 'player' || winner) return;
    const remaining = skillCharges[skill.id] || 0;
    if (remaining <= 0) return;

    switch (skill.id) {
      case 'loaded_ivory': {
        if (diceValue !== null || forceNextSix) return;
        setForceNextSix(true);
        setSkillCharges((prev) => ({ ...prev, loaded_ivory: prev.loaded_ivory - 1 }));
        setStatusBanner('Loaded Ivory active! Your next cast is guaranteed to be 6.');
        sound.play('skill');
        break;
      }
      case 'reroll_mantra': {
        if (diceValue === null) return;
        if (autoMoveTimerRef.current) window.clearTimeout(autoMoveTimerRef.current);
        setDiceValue(null);
        setSkillCharges((prev) => ({ ...prev, reroll_mantra: prev.reroll_mantra - 1 }));
        setStatusBanner('Second Cast invoked! Cast your ivory dice again.');
        sound.play('skill');
        break;
      }
      case 'kavacha_shield': {
        if (playerShieldRounds > 0) return;
        setPlayerShieldRounds(1);
        setSkillCharges((prev) => ({ ...prev, kavacha_shield: prev.kavacha_shield - 1 }));
        setStatusBanner('Kavacha Aegis active! All your tokens on the track are shielded for 1 round.');
        sound.play('skill');
        break;
      }
      case 'royal_stride': {
        if (diceValue === null || bonusDiceSteps > 0) return;
        setBonusDiceSteps(2);
        setSkillCharges((prev) => ({ ...prev, royal_stride: prev.royal_stride - 1 }));
        setStatusBanner(`Royal Stride active! Dice value boosted to ${Math.min(6, diceValue + 2)}.`);
        sound.play('skill');
        break;
      }
      case 'shakuni_mirror': {
        if (shakuniCappedToThree) return;
        setShakuniCappedToThree(true);
        setSkillCharges((prev) => ({ ...prev, shakuni_mirror: prev.shakuni_mirror - 1 }));
        setStatusBanner('Illusion Gaze cast! Shakuni’s next dice roll cannot exceed 3.');
        setShakuniLine('What trickery is this? A cloud dims my ivory dice!');
        sound.play('skill');
        break;
      }
      case 'garuda_leap': {
        if (moveMultiplier > 1) return;
        setMoveMultiplier(2);
        setSkillCharges((prev) => ({ ...prev, garuda_leap: prev.garuda_leap - 1 }));
        setStatusBanner('Garuda Surge active! Your movement steps are doubled this turn.');
        sound.play('skill');
        break;
      }
      case 'golden_pasa': {
        if (diceValue !== null) return;
        setShowExactPicker((prev) => !prev);
        sound.play('click');
        break;
      }
      case 'sovereign_decree': {
        const lockedToken = tokens.find((t) => t.owner === 'player' && t.step === -1);
        if (!lockedToken) return;
        setTokens((prev) =>
          prev.map((t) => (t.id === lockedToken.id ? { ...t, step: 0 } : t))
        );
        setLastMovedTokenId(lockedToken.id);
        setSkillCharges((prev) => ({
          ...prev,
          sovereign_decree: prev.sovereign_decree - 1,
        }));
        setStatusBanner(`Sovereign Recall deployed Token #${lockedToken.tokenIndex + 1} onto your start square!`);
        sound.play('skill');
        break;
      }
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
    if (next) sound.play('click');
  };

  const toggleSoothingBgm = () => {
    if (bgmPlaying) {
      sound.stopSoothingBgm();
      setBgmPlaying(false);
    } else {
      sound.startSoothingBgm();
      setBgmPlaying(true);
    }
  };

  const playerAvgRoll =
    playerRollHistory.length > 0
      ? (playerRollHistory.reduce((a, b) => a + b, 0) / playerRollHistory.length).toFixed(2)
      : '—';
  const shakuniAvgRoll =
    shakuniRollHistory.length > 0
      ? (shakuniRollHistory.reduce((a, b) => a + b, 0) / shakuniRollHistory.length).toFixed(2)
      : '—';

  return (
    <div className="min-h-screen bg-[#0F141C] text-[#F8FAFC] flex flex-col">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (5 Single-Line Nav Links) — Zone 3 (1 Primary Action) */}
      <header className="sticky top-0 z-30 h-12 sm:h-14 flex items-center justify-between gap-8 px-4 sm:px-6 bg-[#0F141C]/90 backdrop-blur-md border-b border-slate-800/80">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#campaign"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('campaign');
            sound.play('click');
          }}
          className="font-display text-lg font-bold tracking-wider text-amber-400 whitespace-nowrap shrink-0"
        >
          PAGADE
        </a>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#campaign"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('campaign');
              sound.play('click');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'campaign' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Saga Map
          </a>
          <a
            href="#match"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('match');
              sound.play('click');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'match' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Sabha Board
          </a>
          <a
            href="#multiplayer"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('multiplayer');
              sound.play('click');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'multiplayer' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Multiplayer
          </a>
          <a
            href="#armory"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('armory');
              sound.play('click');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'armory' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Skills Armory
          </a>
          <a
            href="#account"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('account');
              sound.play('click');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'account' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Account Sync
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => startMatchAtLevel(progress.highestUnlockedLevel)}
            className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Play Stage {progress.highestUnlockedLevel}
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 w-full">
        {activeTab === 'campaign' && (
          <CampaignPathView
            highestUnlockedLevel={progress.highestUnlockedLevel}
            selectedLevel={selectedLevel}
            selectedDifficulty={progress.selectedDifficulty}
            onSelectDifficulty={(tierId) => {
              setProgress((prev) => ({ ...prev, selectedDifficulty: tierId }));
              sound.play('click');
            }}
            onSelectLevel={(lvl) => {
              setSelectedLevel(lvl);
              sound.play('click');
            }}
            onStartMatch={(lvl) => startMatchAtLevel(lvl)}
            palaceBannerUrl={PALACE_BANNER}
            shakuniAvatarUrl={SHAKUNI_AVATAR}
          />
        )}

        {activeTab === 'multiplayer' && (
          <MultiplayerBattleView
            customPlayerName={progress.customPlayerName}
            customPlayerTag={progress.customPlayerTag}
            playerAvatar={activePlayerAvatar}
            customPlayerAvatar={progress.customPlayerAvatar}
            gameMode={progress.gameMode}
            onUpdateIdentity={handleUpdatePlayerIdentity}
            onUpdateAvatar={handleUpdatePlayerAvatar}
            isLandscapeCompact={isMobileLandscape}
          />
        )}

        {activeTab === 'armory' && (
          <SkillsArmoryView
            highestUnlockedLevel={progress.highestUnlockedLevel}
            onStartNextStage={() => startMatchAtLevel(progress.highestUnlockedLevel)}
          />
        )}

        {activeTab === 'rules' && <RulesGuideView />}

        {activeTab === 'account' && (
          <AccountSyncView progress={progress} onUpdateProgress={setProgress} />
        )}

        {activeTab === 'match' && (
          <div
            className={`w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-20 grid gap-4 items-start ${
              isMobileLandscape
                ? 'grid-cols-12 pb-16'
                : 'grid-cols-1 md:grid-cols-12'
            }`}
          >
            {/* Left / Board Column (Flexible in both Portrait and Landscape) */}
            <div
              className={`${
                isMobileLandscape ? 'col-span-6' : 'md:col-span-7'
              } flex flex-col gap-2.5`}
            >
              {/* Shakuni Opponent HUD + Audio & Speed Controls */}
              <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-2.5 sm:p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={SHAKUNI_AVATAR}
                    alt="Shakuni"
                    referrerPolicy="no-referrer"
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border-2 shrink-0 ${
                      turn === 'shakuni'
                        ? 'border-rose-400 ring-2 ring-rose-500/40'
                        : 'border-slate-700'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-bold text-white truncate">
                        {currentMatchNode.tier.shakuniTitle}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono-num text-amber-400 shrink-0">
                        Stage {matchLevel}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-200/90 truncate mt-0.5 italic">
                      “{shakuniLine}”
                    </p>
                  </div>
                </div>

                {/* Audio, Soothing Music, Speed, and Reset Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={toggleSoothingBgm}
                    title="Toggle Soothing Palace Music"
                    aria-label="Toggle Soothing Palace Background Music"
                    className={`min-w-[42px] min-h-[42px] px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                      bgmPlaying
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Music className="w-4 h-4" />
                    <span className="hidden sm:inline whitespace-nowrap">
                      {bgmPlaying ? 'Music On' : 'Music'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => startMatchAtLevel(matchLevel)}
                    aria-label="Restart Stage"
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 15x15 Interactive Pagade Board */}
              <PagadeBoard
                tokens={tokens}
                validMoves={validPlayerMoves}
                onSelectMove={(move) => {
                  if (turn === 'player' && effectivePlayerDice !== null) {
                    if (autoMoveTimerRef.current) window.clearTimeout(autoMoveTimerRef.current);
                    executeMove(move, 'player', effectivePlayerDice);
                  }
                }}
                isPlayerTurn={turn === 'player'}
                playerShieldActive={playerShieldRounds > 0}
                lastMovedTokenId={lastMovedTokenId}
                gameMode={progress.gameMode}
                isLandscapeCompact={isMobileLandscape}
                currentDiceCount={
                  turn === 'player' && effectivePlayerDice !== null
                    ? effectivePlayerDice * moveMultiplier
                    : null
                }
              />

              {/* Turn Status Banner & Pity-6 Progress Meter */}
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-200 font-medium truncate">
                  {statusBanner}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {playerDryStreak > 0 && (
                    <span className="font-mono-num text-[11px] text-emerald-400">
                      Pity-6: {playerDryStreak}/5
                    </span>
                  )}
                  <span className="font-mono-num text-amber-400">
                    {turn === 'player' ? 'YOUR TURN' : 'SHAKUNI'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right / Controls Column (Adapts seamlessly in Portrait & Landscape) */}
            <div
              className={`${
                isMobileLandscape ? 'col-span-6' : 'md:col-span-5'
              } flex flex-col gap-3.5`}
            >
              {/* Player Controller & Ivory Dice Card (Stacked cleanly so Dice Count never overlaps Player Info) */}
              <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-3.5 sm:p-4 flex flex-col gap-3">
                {/* Row 1: Player Avatar, Custom Name & ID Tag, and Edit ID Trigger */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={activePlayerAvatar}
                      alt={progress.customPlayerName}
                      referrerPolicy="no-referrer"
                      className={`w-11 h-11 rounded-xl object-cover border-2 shrink-0 bg-slate-900 ${
                        turn === 'player'
                          ? 'border-amber-400 ring-2 ring-amber-400/30'
                          : 'border-slate-700'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="font-bold text-white truncate">
                          {progress.customPlayerName ||
                            progress.accountProfile?.displayName ||
                            'Royal Challenger'}
                        </span>
                        <span className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300 shrink-0">
                          {progress.customPlayerTag}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>
                          Home:{' '}
                          <strong className="font-mono-num text-amber-300">
                            {tokens.filter((t) => t.owner === 'player' && t.step === 56).length}/
                            {targetHomeCount}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Glory: <strong className="font-mono-num text-white">{progress.gloryPoints}</strong>
                        </span>
                        {playerShieldRounds > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
                              <Shield className="w-3 h-3" /> Shield
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditingHudId((prev) => !prev)}
                      title="Edit Player Name, Photo & ID"
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-amber-300 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingHudId ? 'Close' : 'Edit ID'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('multiplayer');
                        sound.play('click');
                      }}
                      title="Open 4-Player Multiplayer Room Battle"
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-[11px] font-semibold text-emerald-300 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Users className="w-3 h-3" />
                      <span>Multiplayer</span>
                    </button>
                  </div>
                </div>

                {/* Inline Player Name / Custom ID & Profile Picture Editor */}
                {isEditingHudId && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300 font-medium">
                        Profile Picture:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const others = ANIMATED_AVATAR_PRESETS.filter(
                              (p) => p.dataUrl !== progress.customPlayerAvatar
                            );
                            const pool = others.length > 0 ? others : ANIMATED_AVATAR_PRESETS;
                            const chosen = pool[Math.floor(Math.random() * pool.length)];
                            handleUpdatePlayerAvatar(chosen.dataUrl);
                            sound.play('click');
                          }}
                          className="h-8 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[11px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Shuffle className="w-3 h-3" />
                          <span>Random Animated</span>
                        </button>

                        <label className="h-8 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-[11px] font-semibold text-emerald-300 flex items-center gap-1 cursor-pointer">
                          <ImagePlus className="w-3 h-3" />
                          <span>Import Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const dataUrl = await compressImageFileToDataUrl(file);
                                handleUpdatePlayerAvatar(dataUrl);
                                sound.play('click');
                              } catch {
                                // Ignore
                              } finally {
                                e.target.value = '';
                              }
                            }}
                            className="hidden"
                          />
                        </label>

                        {progress.customPlayerAvatar && (
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdatePlayerAvatar(null);
                              sound.play('click');
                            }}
                            className="h-8 px-2 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-300 cursor-pointer"
                          >
                            Default Photo
                          </button>
                        )}
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleUpdatePlayerIdentity(hudNameDraft, hudTagDraft);
                        setIsEditingHudId(false);
                        sound.play('click');
                      }}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                    >
                      <div className="sm:col-span-5 flex flex-col gap-1">
                        <label className="text-[11px] text-slate-300">Player Name</label>
                        <input
                          type="text"
                          value={hudNameDraft}
                          onChange={(e) => setHudNameDraft(e.target.value)}
                          maxLength={24}
                          placeholder="Your Name"
                          className="h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="sm:col-span-4 flex flex-col gap-1">
                        <label className="text-[11px] text-slate-300">Custom ID</label>
                        <input
                          type="text"
                          value={hudTagDraft}
                          onChange={(e) => setHudTagDraft(e.target.value.toUpperCase())}
                          maxLength={16}
                          placeholder="PGD-777"
                          className="h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-700 font-mono-num text-xs text-amber-300 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <button
                          type="submit"
                          className="w-full h-9 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer"
                        >
                          Save ID
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Row 2: Dedicated Full-Width Ivory Dice + Count Bar (Zero Overlap with Left UI) */}
                <IvoryDice
                  value={diceValue}
                  lastRolledValue={lastRolledValue}
                  lastRolledOwner={lastRolledOwner}
                  isRolling={isRolling}
                  onRoll={() => handlePlayerRoll()}
                  disabled={turn !== 'player' || diceValue !== null || isRolling || !!winner}
                  ownerLabel="Shakuni's Roll"
                  bonusSteps={bonusDiceSteps}
                  multiplier={moveMultiplier}
                />

                {/* Store-Review QoL Bar: Mode (Classic 4 vs Quick Blitz 2), Manual/Auto Move, Fast Speed, & Fair Dice Log */}
                <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        setProgress((prev) => ({ ...prev, gameMode: 'classic' }))
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        progress.gameMode === 'classic'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Classic (4)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProgress((prev) => ({ ...prev, gameMode: 'quick_blitz' }))
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        progress.gameMode === 'quick_blitz'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Quick Blitz (2)
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setProgress((prev) => ({
                          ...prev,
                          autoMoveSingle: !prev.autoMoveSingle,
                        }))
                      }
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                        progress.autoMoveSingle
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{progress.autoMoveSingle ? 'Auto-Move: ON' : 'Manual Tap'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setProgress((prev) => ({ ...prev, fastSpeed: !prev.fastSpeed }))
                      }
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                        progress.fastSpeed
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Gauge className="w-3 h-3" />
                      <span>2x Speed</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowFairnessLog((prev) => !prev)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                        showFairnessLog
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <BarChart3 className="w-3 h-3" />
                      <span>Fair Log</span>
                    </button>
                  </div>
                </div>

                {/* Transparent Dice Audit Log (Addresses #1 Store Review Complaint about Rigged Dice) */}
                {showFairnessLog && (
                  <div className="rounded-xl bg-slate-900/95 border border-slate-800 p-3 text-xs flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Verified Dice Audit (Last 20 Casts)</span>
                      <span className="font-mono-num text-emerald-400">
                        Pity-6 Active ({playerDryStreak}/5)
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-mono-num">
                      <span className="text-amber-300">
                        You Avg: {playerAvgRoll} [{playerRollHistory.slice(-8).join(', ') || '—'}]
                      </span>
                      <span className="text-rose-300">
                        Shakuni Avg: {shakuniAvgRoll} [{shakuniRollHistory.slice(-8).join(', ') || '—'}]
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Token Move Selector Buttons */}
                {turn === 'player' && validPlayerMoves.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-800/80 flex flex-col gap-2">
                    <span className="text-xs text-amber-300 font-medium">
                      Tap a Token to Advance ({effectivePlayerDice! * moveMultiplier} steps):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {validPlayerMoves.map((m) => (
                        <button
                          key={m.tokenIndex}
                          type="button"
                          onClick={() => {
                            if (autoMoveTimerRef.current) window.clearTimeout(autoMoveTimerRef.current);
                            executeMove(m, 'player', effectivePlayerDice!);
                          }}
                          className="min-h-[42px] px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform whitespace-nowrap shrink-0"
                        >
                          <span>Token #{m.tokenIndex + 1}</span>
                          {m.exitsYard && <span className="text-[10px] text-amber-300">(Exit)</span>}
                          {m.capturesTokens.length > 0 && (
                            <Swords className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          {m.formsJodiBlock && (
                            <Shield className="w-3.5 h-3.5 text-sky-300" />
                          )}
                          {m.reachesHome && <Crown className="w-3.5 h-3.5 text-amber-300" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Precision Pasa Exact Number Picker (1..6) */}
                {showExactPicker && turn === 'player' && diceValue === null && (
                  <div className="pt-2.5 border-t border-slate-800/80 flex flex-col gap-2">
                    <span className="text-xs text-amber-300 font-medium">
                      Precision Pasa · Choose exact ivory dice roll:
                    </span>
                    <div className="grid grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setSkillCharges((prev) => ({
                              ...prev,
                              golden_pasa: Math.max(0, prev.golden_pasa - 1),
                            }));
                            sound.play('skill');
                            handlePlayerRoll(num);
                          }}
                          className="min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono-num font-bold text-sm flex items-center justify-center cursor-pointer"
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tactical Pasa Skills Dock */}
              <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-3.5 sm:p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Unlocked Pasa Skills</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono-num">
                    {unlockedSkills.length}/{PLAYER_SKILLS.length} Unlocked
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {unlockedSkills.map((sk) => {
                    const charges = skillCharges[sk.id] || 0;
                    const canTrigger =
                      turn === 'player' &&
                      !winner &&
                      charges > 0 &&
                      ((sk.id === 'loaded_ivory' && diceValue === null && !forceNextSix) ||
                        (sk.id === 'reroll_mantra' && diceValue !== null) ||
                        (sk.id === 'kavacha_shield' && playerShieldRounds === 0) ||
                        (sk.id === 'royal_stride' && diceValue !== null && bonusDiceSteps === 0) ||
                        (sk.id === 'shakuni_mirror' && !shakuniCappedToThree) ||
                        (sk.id === 'garuda_leap' && moveMultiplier === 1) ||
                        (sk.id === 'golden_pasa' && diceValue === null) ||
                        (sk.id === 'sovereign_decree' &&
                          tokens.some((t) => t.owner === 'player' && t.step === -1)));

                    return (
                      <button
                        key={sk.id}
                        type="button"
                        disabled={!canTrigger}
                        onClick={() => handleUseSkill(sk)}
                        className={`min-h-[50px] p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          canTrigger
                            ? 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/40 text-white cursor-pointer active:scale-95'
                            : 'bg-slate-900/40 border-slate-800/70 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="text-xs font-bold truncate">
                            {sk.name}
                          </span>
                          <span className="text-[11px] font-mono-num text-amber-400 shrink-0">
                            {charges}x
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate mt-0.5">
                          {sk.shortTag} · {sk.tacticalEffect}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Difficulty Switcher, Ranks & Rules, & Back to Saga Map */}
              <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    Difficulty Rank Override
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('rules')}
                      className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ranks & Rules</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('campaign')}
                      className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Saga Map</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() =>
                      setProgress((prev) => ({ ...prev, selectedDifficulty: 'auto' }))
                    }
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                      progress.selectedDifficulty === 'auto'
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Auto
                  </button>
                  {DIFFICULTY_TIERS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setProgress((prev) => ({ ...prev, selectedDifficulty: t.id }))
                      }
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        progress.selectedDifficulty === t.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* End-of-Match Victory / Defeat Modal */}
      {winner && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-[#171F2C] p-6 flex flex-col items-center text-center gap-4 shadow-2xl">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
                winner === 'player'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                  : 'bg-rose-500/20 border-rose-400 text-rose-400'
              }`}
            >
              {winner === 'player' ? (
                <Trophy className="w-8 h-8" />
              ) : (
                <Swords className="w-8 h-8" />
              )}
            </div>

            <div>
              <p className="text-xs font-mono-num text-amber-400 uppercase tracking-wider">
                Stage {matchLevel} · {currentMatchNode.tier.name} Rank
              </p>
              <h2 className="font-display text-2xl font-bold text-white mt-1">
                {winner === 'player' ? 'Royal Sabha Victory!' : 'Outmaneuvered by Shakuni'}
              </h2>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {winner === 'player'
                  ? `You guided ${targetHomeCount} gemstone tokens into the Royal Mandapa and earned +${currentMatchNode.xpReward} Glory!`
                  : 'Shakuni’s cunning dice claimed the Mandapa first. Recharge your Pasa skills and challenge him again.'}
              </p>
            </div>

            {winner === 'player' && newlyUnlockedSkill && (
              <div className="w-full rounded-2xl bg-amber-500/15 border border-amber-400/40 p-4 text-left flex items-start gap-3">
                <Zap className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-300">
                    New Tactical Skill Unlocked: {newlyUnlockedSkill.name}
                  </p>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {newlyUnlockedSkill.description}
                  </p>
                </div>
              </div>
            )}

            <div className="w-full flex flex-col sm:flex-row gap-2.5 mt-2">
              {winner === 'player' ? (
                <button
                  type="button"
                  onClick={() => startMatchAtLevel(matchLevel + 1)}
                  className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  Next Stage ({matchLevel + 1})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startMatchAtLevel(matchLevel)}
                  className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  Play Again
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setWinner(null);
                  setActiveTab('campaign');
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                Saga Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Tab Bar (5 tabs, Compact height in Landscape) */}
      <nav
        aria-label="Mobile Navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F141C]/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 items-center ${
          isMobileLandscape ? 'h-12' : 'h-16'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('campaign');
            sound.play('click');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
            activeTab === 'campaign' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Map className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap shrink-0">
            Saga Map
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('match');
            sound.play('click');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
            activeTab === 'match' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap shrink-0">
            Sabha Play
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('multiplayer');
            sound.play('click');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
            activeTab === 'multiplayer' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap shrink-0">
            Multiplayer
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('armory');
            sound.play('click');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
            activeTab === 'armory' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap shrink-0">
            Skills ({unlockedSkills.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('account');
            sound.play('click');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
            activeTab === 'account' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap shrink-0">
            {progress.accountProfile ? 'Synced' : 'Account'}
          </span>
        </button>
      </nav>
    </div>
  );
}
