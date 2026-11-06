import React from 'react';
import { Shield, Sparkles, Star, Crown, Lock } from 'lucide-react';
import {
  MAIN_TRACK_COORDS,
  PLAYER_HOME_COORDS,
  PLAYER_YARD_COORDS,
  SAFE_GLOBAL_INDICES,
  SHAKUNI_HOME_COORDS,
  SHAKUNI_YARD_COORDS,
} from '../data/pagadeData';
import { MoveCandidate, Token, getTokenBoardCoord, GameMode } from '../utils/pagadeEngine';

interface PagadeBoardProps {
  tokens: Token[];
  validMoves: MoveCandidate[];
  onSelectMove: (move: MoveCandidate) => void;
  isPlayerTurn: boolean;
  playerShieldActive: boolean;
  lastMovedTokenId: string | null;
  gameMode: GameMode;
  isLandscapeCompact?: boolean;
}

export const PagadeBoard: React.FC<PagadeBoardProps> = ({
  tokens,
  validMoves,
  onSelectMove,
  isPlayerTurn,
  playerShieldActive,
  lastMovedTokenId,
  gameMode,
  isLandscapeCompact = false,
}) => {
  const targetHomeGoalCount = gameMode === 'quick_blitz' ? 2 : 4;

  // Build lookup maps for quick rendering
  const safeCoordsSet = new Set<string>();
  SAFE_GLOBAL_INDICES.forEach((idx) => {
    const [r, c] = MAIN_TRACK_COORDS[idx];
    safeCoordsSet.add(`${r},${c}`);
  });

  const playerHomeSet = new Set(PLAYER_HOME_COORDS.slice(0, 5).map(([r, c]) => `${r},${c}`));
  const shakuniHomeSet = new Set(SHAKUNI_HOME_COORDS.slice(0, 5).map(([r, c]) => `${r},${c}`));

  // Group tokens by coordinate string "r,c"
  const tokensByCell = new Map<string, Token[]>();
  for (const token of tokens) {
    const [r, c] = getTokenBoardCoord(token);
    const key = `${r},${c}`;
    const list = tokensByCell.get(key) || [];
    list.push(token);
    tokensByCell.set(key, list);
  }

  // Map valid moves by tokenIndex and by destination cell
  const validMoveByToken = new Map<number, MoveCandidate>();
  const validMoveByDest = new Map<string, MoveCandidate>();
  if (isPlayerTurn) {
    for (const m of validMoves) {
      validMoveByToken.set(m.tokenIndex, m);
      const dummyToken: Token = { id: 'preview', owner: 'player', tokenIndex: m.tokenIndex, step: m.toStep };
      const [destR, destC] = getTokenBoardCoord(dummyToken);
      validMoveByDest.set(`${destR},${destC}`, m);
    }
  }

  const playerHomeCount = tokens.filter((t) => t.owner === 'player' && t.step === 56).length;
  const shakuniHomeCount = tokens.filter((t) => t.owner === 'shakuni' && t.step === 56).length;

  const renderTokensInCell = (r: number, c: number) => {
    const cellTokens = tokensByCell.get(`${r},${c}`);
    if (!cellTokens || cellTokens.length === 0) return null;

    // Check if there is a Jodi Pair Blockade (2+ tokens of same owner on a main track square)
    const playerCountHere = cellTokens.filter((t) => t.owner === 'player' && t.step >= 0 && t.step <= 50).length;
    const shakuniCountHere = cellTokens.filter((t) => t.owner === 'shakuni' && t.step >= 0 && t.step <= 50).length;
    const hasJodiFortress = playerCountHere >= 2 || shakuniCountHere >= 2;

    return (
      <div className="relative w-full h-full flex items-center justify-center z-20 pointer-events-none">
        {cellTokens.map((t, idx) => {
          const isPlayable = isPlayerTurn && t.owner === 'player' && validMoveByToken.has(t.tokenIndex);
          const moveCandidate = isPlayable ? validMoveByToken.get(t.tokenIndex)! : null;
          const isLastMoved = t.id === lastMovedTokenId;

          const offsetMap = [
            'translate-x-0 translate-y-0',
            '-translate-x-1 -translate-y-1',
            'translate-x-1 translate-y-1',
            '-translate-x-1 translate-y-1',
          ];
          const offsetClass = cellTokens.length > 1 ? offsetMap[idx % 4] : '';

          return (
            <button
              key={t.id}
              type="button"
              disabled={!isPlayable}
              onClick={(e) => {
                e.stopPropagation();
                if (moveCandidate) onSelectMove(moveCandidate);
              }}
              aria-label={`${t.owner === 'player' ? 'Your' : 'Shakuni'} token ${t.tokenIndex + 1}`}
              className={`pointer-events-auto absolute w-[80%] h-[80%] rounded-full flex items-center justify-center transition-transform duration-150 ${offsetClass} ${
                t.owner === 'player'
                  ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 border-2 border-amber-100 text-slate-950 shadow-md'
                  : 'bg-gradient-to-b from-rose-400 via-rose-600 to-rose-900 border-2 border-rose-200 text-white shadow-md'
              } ${
                isPlayable
                  ? 'ring-2 ring-emerald-400 scale-110 cursor-pointer hover:scale-125 z-30'
                  : 'cursor-default'
              } ${isLastMoved ? 'ring-2 ring-white/90' : ''}`}
            >
              {(t.owner === 'player' && playerShieldActive && t.step >= 0 && t.step <= 50) || hasJodiFortress ? (
                <Shield
                  className={`w-3 h-3 stroke-[2.5] ${
                    t.owner === 'player' ? 'text-slate-950' : 'text-white'
                  }`}
                />
              ) : (
                <span className="text-[9px] font-bold font-mono-num leading-none select-none">
                  {t.tokenIndex + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`relative w-full aspect-square mx-auto rounded-2xl p-2 bg-[#1B1614] border-2 border-amber-500/40 shadow-2xl select-none transition-all ${
        isLandscapeCompact
          ? 'max-w-[min(74vh,430px)]'
          : 'max-w-[min(92vw,450px)]'
      }`}
    >
      <div className="w-full h-full grid grid-cols-15 grid-rows-15 bg-[#2A1F1A] rounded-xl overflow-hidden border border-amber-500/30">
        {Array.from({ length: 15 }).map((_, r) =>
          Array.from({ length: 15 }).map((__, c) => {
            const coordKey = `${r},${c}`;

            const inTopLeftYard = r < 6 && c < 6;
            const inTopRightYard = r < 6 && c >= 9;
            const inBottomLeftYard = r >= 9 && c < 6;
            const inBottomRightYard = r >= 9 && c >= 9;
            const inCenterMandapa = r >= 6 && r <= 8 && c >= 6 && c <= 8;

            // Top-Left Decorative Royal Seal Yard (6x6 span at r=0, c=0)
            if (r === 0 && c === 0) {
              return (
                <div
                  key={coordKey}
                  className="col-span-6 row-span-6 bg-[#181311] border-r border-b border-amber-500/30 p-2 flex flex-col items-center justify-center text-center relative"
                >
                  <div className="w-full h-full rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-slate-950/80 flex flex-col items-center justify-center p-2">
                    <Sparkles className="w-4 h-4 text-amber-400/70 mb-1" />
                    <span className="font-display text-[9px] sm:text-[10px] tracking-widest text-amber-300/90 font-semibold">
                      JODI FORTRESS
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                      2 Friendly Tokens Form Safe Pair
                    </span>
                  </div>
                </div>
              );
            }

            // Top-Right Shakuni Yard (6x6 span at r=0, c=9)
            if (r === 0 && c === 9) {
              return (
                <div
                  key={coordKey}
                  className="col-span-6 row-span-6 bg-gradient-to-br from-[#3B1019] to-[#1F090E] border-l border-b border-rose-500/40 p-2 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="font-display text-[9px] sm:text-[10px] font-bold tracking-wider text-rose-300 truncate">
                      SHAKUNI
                    </span>
                    <span className="text-[10px] font-mono-num text-rose-200/80">
                      {shakuniHomeCount}/{targetHomeGoalCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 my-auto p-1.5 bg-black/35 rounded-xl border border-rose-400/25 aspect-square max-h-[78%] mx-auto w-[78%] items-center justify-items-center">
                    {SHAKUNI_YARD_COORDS.map(([yr, yc], idx) => (
                      <div
                        key={`syard-${idx}`}
                        className="w-full h-full rounded-full bg-rose-950/80 border border-rose-500/40 flex items-center justify-center relative"
                      >
                        {renderTokensInCell(yr, yc)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Bottom-Left Player Yard (6x6 span at r=9, c=0)
            if (r === 9 && c === 0) {
              return (
                <div
                  key={coordKey}
                  className="col-span-6 row-span-6 bg-gradient-to-tr from-[#3B260B] to-[#1F1507] border-r border-t border-amber-500/50 p-2 flex flex-col justify-between"
                >
                  <div className="grid grid-cols-2 gap-2 my-auto p-1.5 bg-black/35 rounded-xl border border-amber-400/30 aspect-square max-h-[78%] mx-auto w-[78%] items-center justify-items-center">
                    {PLAYER_YARD_COORDS.map(([yr, yc], idx) => {
                      const canExit =
                        isPlayerTurn &&
                        validMoves.some(
                          (m) =>
                            m.exitsYard &&
                            getTokenBoardCoord({
                              id: '',
                              owner: 'player',
                              tokenIndex: m.tokenIndex,
                              step: -1,
                            })[0] === yr &&
                            getTokenBoardCoord({
                              id: '',
                              owner: 'player',
                              tokenIndex: m.tokenIndex,
                              step: -1,
                            })[1] === yc
                        );
                      return (
                        <div
                          key={`pyard-${idx}`}
                          className={`w-full h-full rounded-full bg-amber-950/80 border flex items-center justify-center relative ${
                            canExit ? 'border-emerald-400 bg-emerald-950/40' : 'border-amber-500/40'
                          }`}
                        >
                          {renderTokensInCell(yr, yc)}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="font-display text-[9px] sm:text-[10px] font-bold tracking-wider text-amber-300 truncate">
                      CHALLENGER
                    </span>
                    <span className="text-[10px] font-mono-num text-amber-200/90">
                      {playerHomeCount}/{targetHomeGoalCount}
                    </span>
                  </div>
                </div>
              );
            }

            // Bottom-Right Sanctuary Legend Yard (6x6 span at r=9, c=9)
            if (r === 9 && c === 9) {
              return (
                <div
                  key={coordKey}
                  className="col-span-6 row-span-6 bg-[#181311] border-l border-t border-amber-500/30 p-2 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-full h-full rounded-xl border border-amber-500/20 bg-gradient-to-tl from-emerald-950/30 to-slate-950/80 flex flex-col items-center justify-center p-2">
                    <Crown className="w-4 h-4 text-emerald-400/80 mb-1" />
                    <span className="font-display text-[9px] sm:text-[10px] tracking-widest text-emerald-300/90 font-semibold">
                      {gameMode === 'quick_blitz' ? 'BLITZ 2-HOME' : 'CLASSIC 4-HOME'}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                      Lead {targetHomeGoalCount} Tokens Home to Win
                    </span>
                  </div>
                </div>
              );
            }

            // Center 3x3 Royal Mandapa Goal (at r=6, c=6)
            if (r === 6 && c === 6) {
              const destMove = validMoveByDest.get('8,7');
              return (
                <div
                  key={coordKey}
                  onClick={() => {
                    if (destMove) onSelectMove(destMove);
                  }}
                  className={`col-span-3 row-span-3 bg-gradient-to-b from-rose-950/90 via-[#2B1F17] to-amber-950/90 border border-amber-400/60 flex flex-col items-center justify-between p-1 relative ${
                    destMove ? 'ring-2 ring-emerald-400 cursor-pointer' : ''
                  }`}
                >
                  {/* Shakuni Home Slot Top */}
                  <div className="w-full flex items-center justify-center gap-0.5 h-3.5">
                    {Array.from({ length: shakuniHomeCount }).map((_, i) => (
                      <span
                        key={`shome-${i}`}
                        className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-200 shadow-sm"
                      />
                    ))}
                  </div>

                  {/* Center Crown Emblem */}
                  <div className="flex flex-col items-center justify-center">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-display text-[8px] tracking-widest text-amber-200 font-bold">
                      HOME
                    </span>
                  </div>

                  {/* Player Home Slot Bottom */}
                  <div className="w-full flex items-center justify-center gap-0.5 h-3.5">
                    {Array.from({ length: playerHomeCount }).map((_, i) => (
                      <span
                        key={`phome-${i}`}
                        className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-100 shadow-sm"
                      />
                    ))}
                  </div>
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
            const isPlayerStart = r === 13 && c === 6;
            const isShakuniStart = r === 1 && c === 8;
            const isPlayerHomeStretch = playerHomeSet.has(coordKey);
            const isShakuniHomeStretch = shakuniHomeSet.has(coordKey);
            const destCandidate = validMoveByDest.get(coordKey);

            let cellBg = 'bg-[#F5EFE6] text-slate-800';
            if (isPlayerStart) {
              cellBg = 'bg-amber-500/90 text-slate-950';
            } else if (isShakuniStart) {
              cellBg = 'bg-rose-600/90 text-white';
            } else if (isPlayerHomeStretch) {
              cellBg = 'bg-amber-500/35 text-amber-200';
            } else if (isShakuniHomeStretch) {
              cellBg = 'bg-rose-600/35 text-rose-200';
            } else if (isSafe) {
              cellBg = 'bg-[#E5DEC9] text-amber-900';
            }

            return (
              <div
                key={coordKey}
                onClick={() => {
                  if (destCandidate) onSelectMove(destCandidate);
                }}
                className={`relative border-[0.5px] border-amber-900/30 flex items-center justify-center transition-colors ${cellBg} ${
                  destCandidate
                    ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-400/30 cursor-pointer'
                    : ''
                }`}
              >
                {isSafe && (
                  <Star
                    className={`w-3 h-3 pointer-events-none ${
                      isPlayerStart
                        ? 'text-slate-950 fill-slate-950/30'
                        : isShakuniStart
                        ? 'text-white fill-white/30'
                        : 'text-amber-700/70 fill-amber-700/20'
                    }`}
                  />
                )}

                {destCandidate && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm pointer-events-none z-10" />
                )}

                {renderTokensInCell(r, c)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
