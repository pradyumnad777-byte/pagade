import React from 'react';

interface IvoryDiceProps {
  value: number | null;
  lastRolledValue: number | null;
  lastRolledOwner: 'player' | 'shakuni' | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  ownerLabel: string;
  bonusSteps: number;
  multiplier: number;
}

/**
 * Renders traditional elongated ivory Pagade (Pasa) rectangular dice sticks alongside a large,
 * unmistakable numerical badge showing the exact rolled count and an ergonomic mobile touch button.
 */
export const IvoryDice: React.FC<IvoryDiceProps> = ({
  value,
  lastRolledValue,
  lastRolledOwner,
  isRolling,
  onRoll,
  disabled,
  ownerLabel,
  bonusSteps,
  multiplier,
}) => {
  // Show active roll if waiting for move, otherwise show the last rolled value so it never vanishes immediately
  const shownRoll = value ?? lastRolledValue;
  const stickVal = shownRoll ?? 6;
  const stickA = Math.ceil(stickVal / 2);
  const stickB = Math.floor(stickVal / 2);

  const renderPips = (count: number) => {
    return (
      <div className="flex items-center justify-center gap-1">
        {Array.from({ length: count }).map((_, idx) => (
          <span
            key={idx}
            className="w-2 h-2 rounded-full bg-rose-900 border border-amber-900 shadow-inner"
          />
        ))}
      </div>
    );
  };

  const effectiveTotal =
    value !== null ? Math.min(6, value + bonusSteps) * multiplier : null;

  return (
    <div className="w-full flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-2">
      {/* Dedicated Dice Roll Count Display (Left side of Dice Bar, never overlaps player info) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-13 h-13 rounded-xl border-2 flex flex-col items-center justify-center shrink-0 transition-colors ${
            isRolling
              ? 'bg-amber-500/20 border-amber-400 animate-pulse'
              : value !== null
              ? 'bg-emerald-500/25 border-emerald-400 shadow-md shadow-emerald-500/15'
              : shownRoll !== null
              ? 'bg-slate-950 border-amber-500/40'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-300 leading-none">
            {isRolling ? 'Roll' : 'Count'}
          </span>
          <span
            className={`font-mono-num text-xl font-bold leading-tight mt-0.5 ${
              value !== null
                ? 'text-emerald-300'
                : shownRoll !== null
                ? 'text-amber-300'
                : 'text-slate-500'
            }`}
          >
            {isRolling ? '...' : shownRoll !== null ? shownRoll : '—'}
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-white truncate">
            {isRolling
              ? 'Casting Ivory...'
              : value !== null
              ? `Rolled ${value}!`
              : shownRoll !== null
              ? `${lastRolledOwner === 'player' ? 'Your' : 'Opponent'} Last: ${shownRoll}`
              : 'Ready to Cast'}
          </span>
          <span className="text-[11px] text-slate-300 truncate mt-0.5">
            {effectiveTotal !== null
              ? `Tap glowing pawn (+${effectiveTotal} steps)`
              : disabled
              ? ownerLabel
              : 'Tap Roll Dice to cast'}
          </span>
        </div>
      </div>

      {/* Carved Ivory Long Dice Pair Button (Right side of Dice Bar) */}
      <button
        type="button"
        onClick={onRoll}
        disabled={disabled}
        aria-label="Cast Ivory Pagade Dice"
        className={`group relative flex items-center gap-2.5 px-3.5 py-2 min-h-[52px] rounded-xl border shrink-0 transition-all duration-150 ${
          disabled
            ? value !== null
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200 cursor-default'
              : 'bg-slate-950/90 border-slate-800 opacity-75 cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 border-amber-200 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer'
        }`}
      >
        <div
          className={`flex flex-col gap-1.5 transition-transform duration-150 shrink-0 ${
            isRolling ? 'scale-105 -rotate-3' : 'group-hover:scale-105'
          }`}
        >
          {/* Ivory Stick 1 */}
          <div className="w-11 sm:w-12 h-3.5 rounded-sm bg-[#FAF3E0] border border-amber-900/50 shadow-inner flex items-center justify-center px-1">
            {renderPips(stickA)}
          </div>
          {/* Ivory Stick 2 */}
          <div className="w-11 sm:w-12 h-3.5 rounded-sm bg-[#FAF3E0] border border-amber-900/50 shadow-inner flex items-center justify-center px-1">
            {renderPips(stickB)}
          </div>
        </div>

        <span
          className={`text-xs font-bold tracking-tight whitespace-nowrap shrink-0 ${
            value !== null
              ? 'text-emerald-300'
              : disabled
              ? 'text-slate-400'
              : 'text-slate-950'
          }`}
        >
          {isRolling
            ? 'Rolling...'
            : value !== null
            ? 'Move Pawn'
            : disabled
            ? 'Wait'
            : 'Roll Dice'}
        </span>
      </button>
    </div>
  );
};

