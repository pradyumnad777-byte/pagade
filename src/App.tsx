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
} from 'lucide-react';
import {
  DIFFICULTY_TIERS,
  PLAYER_SKILLS,
  PlayerSkill,
  SkillId,
  getLevelNodeInfo,
} from './data/pagadeData';
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
import { onAuthStateChanged } from 'firebase/auth';
import { auth, syncPlayerCloudProgress } from './firebase';

// Generated asset paths
const SHAKUNI_AVATAR = '/src/assets/images/shakuni_avatar_portrait_1793947874829.jpg';
const PLAYER_AVATAR = '/src/assets/images/player_avatar_portrait_1793947877320.jpg';
const PALACE_BANNER = '/src/assets/images/pagade_palace_banner_1793947876375.jpg';

type NavTab = 'campaign' | 'match' | 'armory' | 'rules' | 'account';

const STORAGE_KEY = 'pagade_royal_campaign_v2';

function createInitialTokens(): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < 4; i++) {
    tokens.push({ id: `p-${i}`, owner: 'player', tokenIndex: i, step: -1 });
    tokens.push({ id: `s-${i}`, owner: 'shakuni', tokenIndex: i, step: -1 });
  }
  return tokens;
}

export default function App() {
  // Persistent Campaign & Account Progression
  const [progress, setProgress] = useState<SyncableProgress>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('pagade_royal_campaign_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          highestUnlockedLevel: Math.max(1, Number(parsed.highestUnlockedLevel) || 1),
          totalWins: Number(parsed.totalWins) || 0,
          totalCaptures: Number(parsed.totalCaptures) || 0,
          gloryPoints: Number(parsed.gloryPoints) || 0,
          selectedDifficulty: parsed.selectedDifficulty || 'auto',
          gameMode: parsed.gameMode === 'quick_blitz' ? 'quick_blitz' : 'classic',
          autoMoveSingle: parsed.autoMoveSingle !== undefined ? Boolean(parsed.autoMoveSingle) : true,
          fastSpeed: parsed.fastSpeed !== undefined ? Boolean(parsed.fastSpeed) : false,
          accountProfile: parsed.accountProfile || null,
        };
      }
    } catch {
      // Ignore storage errors
    }
    return {
      highestUnlockedLevel: 1,
      totalWins: 0,
      totalCaptures: 0,
      gloryPoints: 0,
      selectedDifficulty: 'auto',
      gameMode: 'classic',
      autoMoveSingle: true,
      fastSpeed: false,
      accountProfile: null,
    };
  });

  // Listen for Firebase Auth state and automatically restore/merge cloud progress
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const isApple = user.providerData.some((p) => p.providerId.includes('apple'));
      const provider: 'google' | 'apple' = isApple ? 'apple' : 'google';
      try {
        const merged = await syncPlayerCloudProgress(
          user.uid,
          user.displayName || 'Royal Challenger',
          provider,
          progress
        );
        setProgress((prev) => ({
          ...prev,
          ...merged,
          accountProfile: {
            uid: user.uid,
            provider,
            email: user.email || 'Cloud Account',
            displayName: user.displayName || 'Royal Challenger',
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
          progress.accountProfile.displayName,
          progress.accountProfile.provider,
          progress
        ).catch(() => {});
      }
    } catch {
      // Ignore storage errors
    }
  }, [
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
      setDiceValue(null);
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
              ? 'Captured Shakuni’s token!'
              : move.reachesHome
              ? 'Token entered the Royal Mandapa!'
              : 'Rolled a 6!';
          setStatusBanner(`${reason} Bonus roll granted—cast again.`);
        } else {
          const reason =
            capturedCount > 0
              ? 'Shakuni captured your token!'
              : move.reachesHome
              ? 'Shakuni’s token reached Home!'
              : 'Shakuni rolled a 6!';
          setStatusBanner(`${reason} Shakuni casts again...`);
        }
      } else {
        setConsecutiveSixes(0);
        if (actingOwner === 'player') {
          setTurn('shakuni');
          setStatusBanner('Shakuni is contemplating his cast...');
        } else {
          setTurn('player');
          setPlayerShieldRounds((prev) => Math.max(0, prev - 1));
          setStatusBanner('Your turn · Cast the ivory dice or trigger a Pasa skill.');
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

      const animDelay = progress.fastSpeed ? 110 : 210;

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

        const effVal = Math.min(6, rolled! + bonusDiceSteps);
        const moves = getValidMoves(tokens, 'player', effVal, moveMultiplier, false);

        if (moves.length === 0) {
          setStatusBanner(`Rolled ${rolled} · No legal moves available.`);
          window.setTimeout(
            () => {
              setDiceValue(null);
              setBonusDiceSteps(0);
              setMoveMultiplier(1);
              setConsecutiveSixes(0);
              setTurn('shakuni');
              setStatusBanner('Shakuni is preparing his ivory dice...');
            },
            progress.fastSpeed ? 500 : 850
          );
        } else if (
          progress.autoMoveSingle &&
          (moves.length === 1 || moves.every((m) => m.fromStep === moves[0].fromStep))
        ) {
          // Store-review favorite QoL: Auto-move when only 1 distinct move exists
          setStatusBanner(`Rolled ${rolled} · Auto-advancing Token #${moves[0].tokenIndex + 1}...`);
          autoMoveTimerRef.current = window.setTimeout(
            () => {
              executeMove(moves[0], 'player', effVal);
            },
            progress.fastSpeed ? 260 : 440
          );
        } else {
          setStatusBanner(`Rolled ${rolled} · Select a highlighted token to move.`);
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

  // Shakuni Automated Bot Turn Loop
  useEffect(() => {
    if (activeTab !== 'match' || turn !== 'shakuni' || winner || isRolling) return;

    const thinkDelay = progress.fastSpeed ? 320 : 580;
    const rollAnimDelay = progress.fastSpeed ? 160 : 280;

    botTimerRef.current = window.setTimeout(() => {
      setIsRolling(true);
      sound.play('roll');

      botTimerRef.current = window.setTimeout(() => {
        const botRoll = rollPagadeDice(
          'shakuni',
          tokens,
          currentMatchNode.tier,
          matchLevel,
          shakuniCappedToThree,
          0,
          consecutiveSixes
        );
        if (shakuniCappedToThree) {
          setShakuniCappedToThree(false);
        }

        setShakuniRollHistory((prev) => [...prev.slice(-19), botRoll]);
        setIsRolling(false);
        setDiceValue(botRoll);

        const botMoves = getValidMoves(
          tokens,
          'shakuni',
          botRoll,
          1,
          playerShieldRounds > 0
        );

        if (botMoves.length === 0) {
          setStatusBanner(`Shakuni rolled ${botRoll} · No legal moves.`);
          botTimerRef.current = window.setTimeout(
            () => {
              setDiceValue(null);
              setConsecutiveSixes(0);
              setTurn('player');
              setPlayerShieldRounds((prev) => Math.max(0, prev - 1));
              setStatusBanner('Your turn · Cast the ivory dice.');
            },
            progress.fastSpeed ? 450 : 750
          );
        } else {
          const chosen = chooseShakuniMove(
            botMoves,
            tokens,
            currentMatchNode.tier,
            matchLevel
          );
          setStatusBanner(`Shakuni rolled ${botRoll} and advances token #${chosen.tokenIndex + 1}.`);
          botTimerRef.current = window.setTimeout(
            () => {
              executeMove(chosen, 'shakuni', botRoll);
            },
            progress.fastSpeed ? 340 : 580
          );
        }
      }, rollAnimDelay);
    }, thinkDelay);

    return () => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
    };
  }, [
    activeTab,
    turn,
    winner,
    isRolling,
    progress.fastSpeed,
    tokens,
    currentMatchNode.tier,
    matchLevel,
    shakuniCappedToThree,
    consecutiveSixes,
    playerShieldRounds,
    executeMove,
  ]);

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
            href="#rules"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('rules');
              sound.play('click');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'rules' ? 'text-amber-400 underline underline-offset-8' : ''
            }`}
          >
            Ranks & Rules
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
              {/* Player Controller & Ivory Dice Card */}
              <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-3.5 sm:p-4 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={PLAYER_AVATAR}
                      alt="Royal Challenger"
                      referrerPolicy="no-referrer"
                      className={`w-11 h-11 rounded-xl object-cover border-2 shrink-0 ${
                        turn === 'player'
                          ? 'border-amber-400 ring-2 ring-amber-400/30'
                          : 'border-slate-700'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="font-bold text-white truncate">
                          {progress.accountProfile?.displayName || 'Challenger'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400 font-medium shrink-0">
                          {currentMatchNode.tier.name}
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

                  {/* Interactive Carved Ivory Long Dice */}
                  <IvoryDice
                    value={diceValue}
                    isRolling={isRolling}
                    onRoll={() => handlePlayerRoll()}
                    disabled={turn !== 'player' || diceValue !== null || isRolling || !!winner}
                    ownerLabel="Shakuni's Roll"
                    bonusSteps={bonusDiceSteps}
                    multiplier={moveMultiplier}
                  />
                </div>

                {/* Store-Review QoL Bar: Mode (Classic 4 vs Quick Blitz 2), Fast Speed, Auto-Move, & Fair Dice Log */}
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

              {/* Quick Difficulty Switcher & Back to Saga Map */}
              <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    Difficulty Rank Override
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('campaign')}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Saga Map</span>
                  </button>
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
            setActiveTab('rules');
            sound.play('click');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
            activeTab === 'rules' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap shrink-0">
            Ranks
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
