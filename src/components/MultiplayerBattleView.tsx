import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Copy,
  CheckCircle2,
  Play,
  Crown,
  Shield,
  Star,
  Swords,
  LogOut,
  Edit3,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  MAIN_TRACK_COORDS,
  MULTIPLAYER_SEATS,
  SAFE_GLOBAL_INDICES,
  SeatIndex,
} from '../data/pagadeData';
import { GameMode } from '../utils/pagadeEngine';
import { sound } from '../utils/sound';
import { IvoryDice } from './IvoryDice';

interface MpPlayer {
  playerId: string;
  playerName: string;
  playerTag: string;
  seat: SeatIndex;
  isHost: boolean;
  dryStreak: number;
  consecutiveSixes: number;
  joinedAt: number;
}

interface MpToken {
  id: string;
  seat: SeatIndex;
  tokenIndex: number;
  step: number;
}

interface MpMoveCandidate {
  tokenIndex: number;
  fromStep: number;
  toStep: number;
  exitsYard: boolean;
  reachesHome: boolean;
  landsOnSafe: boolean;
  formsJodiBlock: boolean;
  capturesTokens: { seat: SeatIndex; tokenIndex: number }[];
}

interface MpRoom {
  code: string;
  hostPlayerId: string;
  status: 'waiting' | 'playing' | 'finished';
  gameMode: GameMode;
  players: MpPlayer[];
  tokens: MpToken[];
  turnSeat: SeatIndex;
  diceValue: number | null;
  lastRolledValue: number | null;
  lastRolledSeat: SeatIndex | null;
  lastMovedTokenId: string | null;
  validMoves: MpMoveCandidate[];
  winnerSeat: SeatIndex | null;
  statusBanner: string;
  updatedAt: number;
}

interface MultiplayerBattleViewProps {
  customPlayerName: string;
  customPlayerTag: string;
  gameMode: GameMode;
  onUpdateIdentity: (newName: string, newTag: string) => void;
  isLandscapeCompact?: boolean;
}

function getOrCreateDeviceId(): string {
  const key = 'pagade_mp_device_id_v1';
  try {
    const existing = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (existing) return existing;
    const generated = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return `dev_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getMpTokenBoardCoord(token: MpToken): [number, number] {
  const seatCfg = MULTIPLAYER_SEATS[token.seat] || MULTIPLAYER_SEATS[0];
  if (token.step === -1) {
    return seatCfg.yardCoords[token.tokenIndex] || seatCfg.yardCoords[0];
  }
  if (token.step >= 0 && token.step <= 50) {
    const globalIdx = (seatCfg.trackOffset + token.step) % 52;
    return MAIN_TRACK_COORDS[globalIdx];
  }
  const homeIdx = Math.min(5, Math.max(0, token.step - 51));
  return seatCfg.homeCoords[homeIdx];
}

export const MultiplayerBattleView: React.FC<MultiplayerBattleViewProps> = ({
  customPlayerName,
  customPlayerTag,
  gameMode,
  onUpdateIdentity,
  isLandscapeCompact = false,
}) => {
  const [deviceId] = useState<string>(() => getOrCreateDeviceId());
  const [nameDraft, setNameDraft] = useState<string>(customPlayerName);
  const [tagDraft, setTagDraft] = useState<string>(customPlayerTag);
  const [isEditingIdentity, setIsEditingIdentity] = useState<boolean>(false);

  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [room, setRoom] = useState<MpRoom | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode>(gameMode);
  const [isLoadingAction, setIsLoadingAction] = useState<boolean>(false);
  const [isRollingDice, setIsRollingDice] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedRoomCode, setCopiedRoomCode] = useState<boolean>(false);

  useEffect(() => {
    setNameDraft(customPlayerName);
    setTagDraft(customPlayerTag);
  }, [customPlayerName, customPlayerTag]);

  // Poll active room every 850ms so all connected devices stay synchronized in real time
  useEffect(() => {
    if (!room?.code) return;
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const resp = await fetch(`/api/multiplayer/room/${room.code}`);
        if (resp.ok && active) {
          const data = (await resp.json()) as { room: MpRoom };
          setRoom(data.room);
        }
      } catch {
        // Ignore transient network poll error
      }
    }, 850);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [room?.code]);

  const handleSaveCustomId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameDraft.trim().slice(0, 24) || 'Royal Challenger';
    const cleanTag =
      tagDraft
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-_]/g, '')
        .slice(0, 16) || 'PGD-777';

    onUpdateIdentity(cleanName, cleanTag);
    setIsEditingIdentity(false);
    sound.play('click');

    if (room?.code) {
      try {
        const resp = await fetch('/api/multiplayer/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: room.code,
            playerId: deviceId,
            playerName: cleanName,
            playerTag: cleanTag,
          }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as { room: MpRoom };
          setRoom(data.room);
        }
      } catch {
        // Ignore
      }
    }
  };

  const handleCreateRoom = async () => {
    setIsLoadingAction(true);
    setErrorMsg(null);
    sound.play('click');
    try {
      const resp = await fetch('/api/multiplayer/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: deviceId,
          playerName: customPlayerName,
          playerTag: customPlayerTag,
          gameMode: selectedMode,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not create room.');
      } else {
        setRoom(data.room);
      }
    } catch {
      setErrorMsg('Network error creating multiplayer room.');
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setErrorMsg('Enter a 6-character Room Code to join.');
      return;
    }
    setIsLoadingAction(true);
    setErrorMsg(null);
    sound.play('click');
    try {
      const resp = await fetch('/api/multiplayer/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          playerId: deviceId,
          playerName: customPlayerName,
          playerTag: customPlayerTag,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not join room.');
      } else {
        setRoom(data.room);
        setJoinCodeInput('');
      }
    } catch {
      setErrorMsg('Network error joining multiplayer room.');
    } finally {
      setIsLoadingAction(false);
    }
  };

  // Start Match: No minimum player validation! Starts immediately with 2, 3, or 4 players (or 1 for solo test).
  const handleStartMatch = async () => {
    if (!room) return;
    setIsLoadingAction(true);
    setErrorMsg(null);
    sound.play('click');
    try {
      const resp = await fetch('/api/multiplayer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: room.code,
          playerId: deviceId,
          gameMode: selectedMode,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not start match.');
      } else {
        setRoom(data.room);
      }
    } catch {
      setErrorMsg('Network error starting match.');
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleRollDice = useCallback(async () => {
    if (!room || isRollingDice) return;
    setIsRollingDice(true);
    setErrorMsg(null);
    sound.play('roll');
    try {
      const resp = await fetch('/api/multiplayer/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: room.code,
          playerId: deviceId,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not roll dice.');
      } else {
        setRoom(data.room);
      }
    } catch {
      setErrorMsg('Network error rolling dice.');
    } finally {
      window.setTimeout(() => setIsRollingDice(false), 180);
    }
  }, [room, isRollingDice, deviceId]);

  const handleSelectMove = useCallback(
    async (tokenIndex: number) => {
      if (!room) return;
      setErrorMsg(null);
      try {
        const resp = await fetch('/api/multiplayer/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: room.code,
            playerId: deviceId,
            tokenIndex,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          setErrorMsg(data.error || 'Move failed.');
        } else {
          sound.play('step');
          setRoom(data.room);
        }
      } catch {
        setErrorMsg('Network error moving pawn.');
      }
    },
    [room, deviceId]
  );

  const handleCopyCode = async () => {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedRoomCode(true);
      window.setTimeout(() => setCopiedRoomCode(false), 2200);
    } catch {
      // Ignore
    }
  };

  const myPlayer = room?.players.find((p) => p.playerId === deviceId) || null;
  const isMyTurn = Boolean(
    room &&
      room.status === 'playing' &&
      myPlayer &&
      room.turnSeat === myPlayer.seat &&
      !room.winnerSeat
  );

  const targetHomeGoalCount = (room?.gameMode || selectedMode) === 'quick_blitz' ? 2 : 4;

  // Build 4-corner board lookup structures when room is active
  const renderMultiplayerBoard = () => {
    if (!room) return null;

    const safeCoordsSet = new Set<string>();
    SAFE_GLOBAL_INDICES.forEach((idx) => {
      const [r, c] = MAIN_TRACK_COORDS[idx];
      safeCoordsSet.add(`${r},${c}`);
    });

    const homeStretchesBySeat = MULTIPLAYER_SEATS.map(
      (s) => new Set(s.homeCoords.slice(0, 5).map(([r, c]) => `${r},${c}`))
    );

    const tokensByCell = new Map<string, MpToken[]>();
    for (const t of room.tokens) {
      const [r, c] = getMpTokenBoardCoord(t);
      const key = `${r},${c}`;
      const list = tokensByCell.get(key) || [];
      list.push(t);
      tokensByCell.set(key, list);
    }

    const validMoveByToken = new Map<number, MpMoveCandidate>();
    const validMoveByOrigin = new Map<string, MpMoveCandidate>();
    const validMoveByDest = new Map<string, MpMoveCandidate>();

    if (isMyTurn && myPlayer && room.diceValue !== null) {
      for (const m of room.validMoves) {
        validMoveByToken.set(m.tokenIndex, m);

        const [origR, origC] = getMpTokenBoardCoord({
          id: 'orig',
          seat: myPlayer.seat,
          tokenIndex: m.tokenIndex,
          step: m.fromStep,
        });
        validMoveByOrigin.set(`${origR},${origC}`, m);

        const [destR, destC] = getMpTokenBoardCoord({
          id: 'dest',
          seat: myPlayer.seat,
          tokenIndex: m.tokenIndex,
          step: m.toStep,
        });
        validMoveByDest.set(`${destR},${destC}`, m);
      }
    }

    const renderTokensInCell = (r: number, c: number) => {
      const cellTokens = tokensByCell.get(`${r},${c}`);
      if (!cellTokens || cellTokens.length === 0) return null;

      const sorted = [...cellTokens].sort((a, b) => {
        const aPlayable =
          isMyTurn && myPlayer && a.seat === myPlayer.seat && validMoveByToken.has(a.tokenIndex)
            ? 1
            : 0;
        const bPlayable =
          isMyTurn && myPlayer && b.seat === myPlayer.seat && validMoveByToken.has(b.tokenIndex)
            ? 1
            : 0;
        return aPlayable - bPlayable;
      });

      const seatCounts = new Map<SeatIndex, number>();
      for (const ct of cellTokens) {
        if (ct.step >= 0 && ct.step <= 50) {
          seatCounts.set(ct.seat, (seatCounts.get(ct.seat) || 0) + 1);
        }
      }
      const hasJodiFortress = Array.from(seatCounts.values()).some((cnt) => cnt >= 2);

      const seatPawnClasses: Record<SeatIndex, string> = {
        0: 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 border-amber-100 text-slate-950',
        1: 'bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700 border-emerald-100 text-slate-950',
        2: 'bg-gradient-to-b from-rose-400 via-rose-600 to-rose-900 border-rose-200 text-white',
        3: 'bg-gradient-to-b from-sky-300 via-sky-500 to-sky-700 border-sky-100 text-slate-950',
      };

      const offsetMap = [
        'translate-x-0 translate-y-0',
        '-translate-x-1 -translate-y-1',
        'translate-x-1 translate-y-1',
        '-translate-x-1 translate-y-1',
      ];

      return (
        <div className="relative w-full h-full flex items-center justify-center z-20">
          {sorted.map((t, idx) => {
            const isPlayable =
              isMyTurn &&
              myPlayer &&
              t.seat === myPlayer.seat &&
              validMoveByToken.has(t.tokenIndex);
            const isLastMoved = t.id === room.lastMovedTokenId;
            const offsetClass = sorted.length > 1 ? offsetMap[idx % 4] : '';

            return (
              <button
                key={t.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPlayable) {
                    handleSelectMove(t.tokenIndex);
                  } else {
                    const destMove = validMoveByDest.get(`${r},${c}`);
                    const origMove = validMoveByOrigin.get(`${r},${c}`);
                    if (destMove) handleSelectMove(destMove.tokenIndex);
                    else if (origMove) handleSelectMove(origMove.tokenIndex);
                  }
                }}
                className={`absolute w-[88%] h-[88%] rounded-full border-2 shadow-md flex items-center justify-center transition-transform duration-150 ${offsetClass} ${
                  seatPawnClasses[t.seat]
                } ${
                  isPlayable
                    ? 'ring-3 ring-white scale-115 cursor-pointer hover:scale-125 z-30 animate-bounce'
                    : 'cursor-pointer'
                } ${isLastMoved ? 'ring-2 ring-white/90' : ''}`}
              >
                {hasJodiFortress ? (
                  <Shield className="w-3 h-3 stroke-[2.5]" />
                ) : (
                  <span className="text-[10px] font-bold font-mono-num leading-none select-none">
                    {t.tokenIndex + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      );
    };

    const renderCornerYard = (seatIdx: SeatIndex, borderClass: string, bgGradClass: string) => {
      const seatCfg = MULTIPLAYER_SEATS[seatIdx];
      const seatPlayer = room.players.find((p) => p.seat === seatIdx);
      const homeCount = room.tokens.filter(
        (t) => t.seat === seatIdx && t.step === 56
      ).length;
      const isTurn = room.status === 'playing' && room.turnSeat === seatIdx;

      return (
        <div
          key={`yard-seat-${seatIdx}`}
          className={`col-span-6 row-span-6 ${bgGradClass} ${borderClass} p-2 flex flex-col justify-between ${
            isTurn ? 'ring-2 ring-inset ring-white/80' : ''
          }`}
        >
          <div className="flex items-center justify-between px-1 gap-1">
            <span
              className={`font-display text-[9px] sm:text-[10px] font-bold tracking-wider truncate ${seatCfg.textClass}`}
            >
              {seatPlayer ? seatPlayer.playerName : `SEAT ${seatIdx + 1} (OPEN)`}
            </span>
            <span className="text-[10px] font-mono-num text-slate-200 shrink-0">
              {homeCount}/{targetHomeGoalCount}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-auto p-1.5 bg-black/35 rounded-xl border border-white/15 aspect-square max-h-[76%] mx-auto w-[76%] items-center justify-items-center">
            {seatCfg.yardCoords.map(([yr, yc], idx) => {
              const yardMove = validMoveByOrigin.get(`${yr},${yc}`);
              return (
                <div
                  key={`yard-${seatIdx}-${idx}`}
                  onClick={() => {
                    if (yardMove) handleSelectMove(yardMove.tokenIndex);
                  }}
                  className={`w-full h-full rounded-full bg-slate-950/75 border flex items-center justify-center relative ${
                    yardMove
                      ? 'border-2 border-white cursor-pointer ring-2 ring-emerald-400'
                      : 'border-white/25'
                  }`}
                >
                  {renderTokensInCell(yr, yc)}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-1 text-[9px] font-mono-num text-slate-300">
            <span className="truncate">
              {seatPlayer ? seatPlayer.playerTag : seatCfg.name}
            </span>
            {isTurn && <span className="text-white font-bold">TURN</span>}
          </div>
        </div>
      );
    };

    return (
      <div
        className={`w-full mx-auto flex flex-col gap-1.5 select-none ${
          isLandscapeCompact
            ? 'max-w-[min(74vh,430px)]'
            : 'max-w-[min(94vw,460px)]'
        }`}
      >
        {room.diceValue !== null && (
          <div className="w-full px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 font-mono-num font-bold text-xs flex items-center justify-between gap-2">
            <span>Dice Count: {room.diceValue}</span>
            <span className="text-amber-300 font-sans font-semibold truncate">
              {isMyTurn
                ? 'Tap your glowing pawn or target square to move'
                : 'Opponent is selecting pawn...'}
            </span>
          </div>
        )}

        <div className="relative w-full aspect-square rounded-2xl p-2 bg-[#1B1614] border-2 border-amber-500/40 shadow-2xl">
          <div className="w-full h-full grid grid-cols-15 grid-rows-15 bg-[#2A1F1A] rounded-xl overflow-hidden border border-amber-500/30">
            {Array.from({ length: 15 }).map((_, r) =>
              Array.from({ length: 15 }).map((__, c) => {
                const coordKey = `${r},${c}`;

                const inTopLeftYard = r < 6 && c < 6;
                const inTopRightYard = r < 6 && c >= 9;
                const inBottomLeftYard = r >= 9 && c < 6;
                const inBottomRightYard = r >= 9 && c >= 9;
                const inCenterMandapa = r >= 6 && r <= 8 && c >= 6 && c <= 8;

                // Top-Left Yard: Seat 1 (Emerald)
                if (r === 0 && c === 0) {
                  return renderCornerYard(
                    1,
                    'border-r border-b border-emerald-500/40',
                    'bg-gradient-to-br from-[#0B3B28] to-[#071F15]'
                  );
                }

                // Top-Right Yard: Seat 2 (Crimson)
                if (r === 0 && c === 9) {
                  return renderCornerYard(
                    2,
                    'border-l border-b border-rose-500/40',
                    'bg-gradient-to-br from-[#3B1019] to-[#1F090E]'
                  );
                }

                // Bottom-Left Yard: Seat 0 (Amber Gold)
                if (r === 9 && c === 0) {
                  return renderCornerYard(
                    0,
                    'border-r border-t border-amber-500/50',
                    'bg-gradient-to-tr from-[#3B260B] to-[#1F1507]'
                  );
                }

                // Bottom-Right Yard: Seat 3 (Sapphire Sky)
                if (r === 9 && c === 9) {
                  return renderCornerYard(
                    3,
                    'border-l border-t border-sky-500/40',
                    'bg-gradient-to-tl from-[#0B293B] to-[#07161F]'
                  );
                }

                // Center 3x3 Royal Mandapa Goal
                if (r === 6 && c === 6) {
                  return (
                    <div
                      key={coordKey}
                      className="col-span-3 row-span-3 bg-gradient-to-b from-slate-900 via-[#2B1F17] to-slate-950 border border-amber-400/60 flex flex-col items-center justify-center p-1 relative"
                    >
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span className="font-display text-[8px] tracking-widest text-amber-200 font-bold mt-0.5">
                        MANDAPA
                      </span>
                    </div>
                  );
                }

                if (
                  inTopLeftYard ||
                  inTopRightYard ||
                  inBottomLeftYard ||
                  inBottomRightYard ||
                  inCenterMandapa
                ) {
                  return null;
                }

                const isSafe = safeCoordsSet.has(coordKey);
                const isSeat0Start = r === 13 && c === 6;
                const isSeat1Start = r === 6 && c === 1;
                const isSeat2Start = r === 1 && c === 8;
                const isSeat3Start = r === 8 && c === 13;

                const originCandidate = validMoveByOrigin.get(coordKey);
                const destCandidate = validMoveByDest.get(coordKey);

                let cellBg = 'bg-[#F5EFE6] text-slate-800';
                if (isSeat0Start) cellBg = 'bg-amber-500/90 text-slate-950';
                else if (isSeat1Start) cellBg = 'bg-emerald-500/90 text-slate-950';
                else if (isSeat2Start) cellBg = 'bg-rose-600/90 text-white';
                else if (isSeat3Start) cellBg = 'bg-sky-500/90 text-slate-950';
                else if (homeStretchesBySeat[0].has(coordKey))
                  cellBg = 'bg-amber-500/35 text-amber-200';
                else if (homeStretchesBySeat[1].has(coordKey))
                  cellBg = 'bg-emerald-500/35 text-emerald-200';
                else if (homeStretchesBySeat[2].has(coordKey))
                  cellBg = 'bg-rose-600/35 text-rose-200';
                else if (homeStretchesBySeat[3].has(coordKey))
                  cellBg = 'bg-sky-500/35 text-sky-200';
                else if (isSafe) cellBg = 'bg-[#E5DEC9] text-amber-900';

                return (
                  <div
                    key={coordKey}
                    onClick={() => {
                      if (originCandidate) {
                        handleSelectMove(originCandidate.tokenIndex);
                      } else if (destCandidate) {
                        handleSelectMove(destCandidate.tokenIndex);
                      }
                    }}
                    className={`relative border-[0.5px] border-amber-900/30 flex items-center justify-center transition-colors ${cellBg} ${
                      originCandidate
                        ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-400/25 cursor-pointer'
                        : destCandidate
                        ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-400/35 cursor-pointer'
                        : ''
                    }`}
                  >
                    {isSafe && (
                      <Star className="w-3 h-3 pointer-events-none text-amber-800/70 fill-amber-700/20" />
                    )}
                    {destCandidate && (
                      <span className="w-3 h-3 rounded-full bg-emerald-400 border border-slate-950 animate-ping pointer-events-none z-10" />
                    )}
                    {renderTokensInCell(r, c)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-24 flex flex-col gap-5">
      {/* Top Player Identity & Custom ID Naming Bar */}
      <div className="rounded-2xl border border-amber-500/35 bg-[#171F2C] p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-display font-bold text-base shrink-0">
              ID
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{customPlayerName}</span>
                <span className="font-mono-num text-xs px-2 py-0.5 rounded-md bg-slate-900 border border-amber-500/40 text-amber-300">
                  {customPlayerTag}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Multiplayer Room Battle · Up to 4 Players Max · Start Anytime with 2, 3, or 4 Players
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingIdentity((prev) => !prev)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingIdentity ? 'Close ID Editor' : 'Edit Player Name / ID'}</span>
          </button>
        </div>

        {isEditingIdentity && (
          <form
            onSubmit={handleSaveCustomId}
            className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
          >
            <div className="sm:col-span-5 flex flex-col gap-1">
              <label className="text-xs text-slate-300 font-medium">
                Player Display Name
              </label>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={24}
                placeholder="Enter your name"
                className="h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-5 flex flex-col gap-1">
              <label className="text-xs text-slate-300 font-medium">
                Custom Player ID Code
              </label>
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value.toUpperCase())}
                maxLength={16}
                placeholder="e.g. PGD-777"
                className="h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 font-mono-num text-xs text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                Save ID
              </button>
            </div>
          </form>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-300 hover:underline font-semibold shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Lobby View when not in an active room */}
      {!room ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Create Room Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>HOST MULTI-DEVICE BATTLE</span>
                </span>
                <span className="text-xs font-mono-num text-slate-400">Max 4 Players</span>
              </div>

              <h2 className="font-display text-xl font-bold text-white">
                Create Room Code
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Generate a 6-character Room Code and share it with friends on other devices. Supports up to <strong className="text-white">4 players maximum</strong>, and you can start the match immediately with <strong className="text-emerald-300">2, 3, or 4 players</strong> with no waiting restrictions.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedMode('classic')}
                  className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    selectedMode === 'classic'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Classic (4 Pawns Home)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode('quick_blitz')}
                  className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    selectedMode === 'quick_blitz'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Quick Blitz (2 Pawns Home)
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isLoadingAction}
              onClick={handleCreateRoom}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>{isLoadingAction ? 'Creating Room...' : 'Create Multiplayer Room Code'}</span>
            </button>
          </div>

          {/* Join Room by Code Card */}
          <form
            onSubmit={handleJoinRoom}
            className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col justify-between gap-5"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Play className="w-4 h-4" />
                  <span>CONNECT DEVICE BY CODE</span>
                </span>
                <span className="text-xs font-mono-num text-slate-400">2–4 Players</span>
              </div>

              <h2 className="font-display text-xl font-bold text-white">
                Join Friend’s Room Code
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Enter the 6-character Room Code created on another device to connect your custom Player ID (<strong className="text-amber-300">{customPlayerName} · {customPlayerTag}</strong>) into the match.
              </p>

              <div className="pt-1">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="Enter Room Code (e.g. PG48K2)"
                  className="w-full h-12 px-4 rounded-xl bg-slate-900 border border-slate-700 font-mono-num text-base font-bold tracking-widest text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoadingAction}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>{isLoadingAction ? 'Joining...' : 'Join Battle Room'}</span>
            </button>
          </form>
        </div>
      ) : (
        /* Active Room Lobby + 4-Player Board View */
        <div
          className={`grid gap-4 items-start ${
            isLandscapeCompact ? 'grid-cols-12' : 'grid-cols-1 md:grid-cols-12'
          }`}
        >
          {/* Left Column: 4-Corner Pagade Board */}
          <div
            className={`${
              isLandscapeCompact ? 'col-span-6' : 'md:col-span-7'
            } flex flex-col gap-2.5`}
          >
            {/* Room Code & Status Header */}
            <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/50 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">ROOM CODE:</span>
                  <span className="font-mono-num text-base font-bold tracking-wider text-amber-400">
                    {room.code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedRoomCode ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-num text-emerald-400">
                  {room.players.length}/4 Players
                </span>
                <button
                  type="button"
                  onClick={() => setRoom(null)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave</span>
                </button>
              </div>
            </div>

            {/* 4-Player 15x15 Pagade Board */}
            {renderMultiplayerBoard()}

            {/* Live Room Status Banner */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-200 font-medium truncate">
                {room.statusBanner}
              </span>
              <span className="font-mono-num text-amber-400 shrink-0">
                {room.status === 'waiting'
                  ? 'LOBBY READY'
                  : isMyTurn
                  ? 'YOUR TURN'
                  : `SEAT ${room.turnSeat + 1} TURN`}
              </span>
            </div>
          </div>

          {/* Right Column: Seats Roster, Start Match Button (Zero Validation Blocking), & Dice Controller */}
          <div
            className={`${
              isLandscapeCompact ? 'col-span-6' : 'md:col-span-5'
            } flex flex-col gap-3.5`}
          >
            {/* Start Match Banner when in Lobby or Finished */}
            {room.status !== 'playing' && (
              <div className="rounded-2xl border border-emerald-500/40 bg-[#171F2C] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {room.status === 'finished' ? 'Match Complete' : 'Ready to Start Battle'}
                  </span>
                  <span className="text-xs font-mono-num text-slate-300">
                    {room.players.length} of 4 Connected
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Share Room Code <strong className="font-mono-num text-amber-300">{room.code}</strong> with up to 4 devices, or press <strong className="text-white">Start Match Now</strong> immediately with {room.players.length} player{room.players.length === 1 ? '' : 's'} (no minimum player wait required).
                </p>
                <button
                  type="button"
                  disabled={isLoadingAction}
                  onClick={handleStartMatch}
                  className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {room.status === 'finished' ? (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Start Rematch Now ({room.players.length} Players)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Start Match Now ({room.players.length}/4 Players)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Dice Controller & Quick Pawn Buttons when Playing */}
            {room.status === 'playing' && (
              <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    Your Seat:{' '}
                    <strong className="text-amber-300">
                      {myPlayer
                        ? `${MULTIPLAYER_SEATS[myPlayer.seat].name} (${myPlayer.playerName})`
                        : 'Spectator'}
                    </strong>
                  </span>
                  <span className="font-mono-num text-emerald-400">
                    {isMyTurn ? 'Your Turn to Cast' : 'Waiting for Turn'}
                  </span>
                </div>

                <IvoryDice
                  value={room.diceValue}
                  lastRolledValue={room.lastRolledValue}
                  lastRolledOwner={
                    room.lastRolledSeat !== null && myPlayer && room.lastRolledSeat === myPlayer.seat
                      ? 'player'
                      : room.lastRolledSeat !== null
                      ? 'shakuni'
                      : null
                  }
                  isRolling={isRollingDice}
                  onRoll={handleRollDice}
                  disabled={!isMyTurn || room.diceValue !== null || isRollingDice}
                  ownerLabel={
                    room.players.find((p) => p.seat === room.turnSeat)?.playerName || 'Opponent Turn'
                  }
                  bonusSteps={0}
                  multiplier={1}
                />

                {isMyTurn && room.validMoves.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                    <span className="text-xs text-amber-300 font-medium">
                      Select Pawn to Advance ({room.diceValue} steps):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {room.validMoves.map((m) => (
                        <button
                          key={m.tokenIndex}
                          type="button"
                          onClick={() => handleSelectMove(m.tokenIndex)}
                          className="min-h-[42px] px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                        >
                          <span>Pawn #{m.tokenIndex + 1}</span>
                          {m.capturesTokens.length > 0 && (
                            <Swords className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          {m.formsJodiBlock && (
                            <Shield className="w-3.5 h-3.5 text-sky-300" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4-Seat Connected Players Roster */}
            <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Sabha Battle Seats (Max 4 Players)
                </h3>
                {room.status === 'playing' && (
                  <button
                    type="button"
                    onClick={handleStartMatch}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restart Match</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MULTIPLAYER_SEATS.map((seatCfg) => {
                  const occupant = room.players.find((p) => p.seat === seatCfg.seat);
                  const isCurrentTurn =
                    room.status === 'playing' && room.turnSeat === seatCfg.seat;
                  const homeCnt = room.tokens.filter(
                    (t) => t.seat === seatCfg.seat && t.step === 56
                  ).length;

                  return (
                    <div
                      key={seatCfg.seat}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                        isCurrentTurn
                          ? 'bg-slate-900 border-amber-400 ring-1 ring-amber-400/40'
                          : occupant
                          ? 'bg-slate-900/90 border-slate-800'
                          : 'bg-slate-950/50 border-slate-800/60 opacity-65'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-3.5 h-3.5 rounded-full shrink-0 ${seatCfg.bgClass}`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {occupant ? occupant.playerName : `Seat ${seatCfg.seat + 1} · Open`}
                          </p>
                          <p className="text-[11px] font-mono-num text-slate-400 truncate">
                            {occupant ? occupant.playerTag : seatCfg.name}
                          </p>
                        </div>
                      </div>

                      {occupant && (
                        <span className="text-xs font-mono-num font-semibold text-amber-300 shrink-0">
                          {homeCnt}/{targetHomeGoalCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
