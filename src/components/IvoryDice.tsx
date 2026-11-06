import React from 'react';

interface IvoryDiceProps {
  value: number | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  ownerLabel: string;
  bonusSteps: number;
  multiplier: number;
}

/**
 * Renders traditional elongated ivory Pagade (Pasa) rectangular dice sticks alongside clear pip count
 * and an ergonomic mobile touch roll button (>= 48x48px).
 */
export const IvoryDice: React.FC<IvoryDiceProps> = ({
  value,
  isRolling,
  onRoll,
  disabled,
  ownerLabel,
  bonusSteps,
  multiplier,
}) => {
  const displayVal = value ?? 6;
  // Split displayVal across two carved ivory long sticks for authentic Pagade visual flavor
  const stickA = Math.ceil(displayVal / 2);
  const stickB = Math.floor(displayVal / 2);

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
    <div className="flex items-center gap-3">
      {/* Carved Ivory Long Dice Pair */}
      <button
        type="button"
        onClick={onRoll}
        disabled={disabled}
        aria-label="Cast Ivory Pagade Dice"
        className={`group relative flex items-center gap-2 px-4 py-2.5 min-h-[52px] rounded-xl border transition-all duration-150 ${
          disabled
            ? 'bg-slate-900/90 border-slate-800 opacity-75 cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 border-amber-200 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer'
        }`}
      >
        <div
          className={`flex flex-col gap-1.5 transition-transform duration-150 ${
            isRolling ? 'scale-110 -rotate-6' : 'group-hover:scale-105'
          }`}
        >
          {/* Ivory Stick 1 */}
          <div className="w-14 h-4 rounded-sm bg-[#FAF3E0] border border-amber-900/50 shadow-inner flex items-center justify-center px-1.5">
            {renderPips(stickA)}
          </div>
          {/* Ivory Stick 2 */}
          <div className="w-14 h-4 rounded-sm bg-[#FAF3E0] border border-amber-900/50 shadow-inner flex items-center justify-center px-1.5">
            {renderPips(stickB)}
          </div>
        </div>

        <div className="flex flex-col items-start pl-1">
          <span
            className={`text-xs font-bold tracking-tight whitespace-nowrap shrink-0 ${
              disabled ? 'text-slate-300' : 'text-slate-950'
            }`}
          >
            {isRolling
              ? 'Casting...'
              : value === null
              ? disabled
                ? ownerLabel
                : 'Cast Dice'
              : `Rolled ${value}`}
          </span>
          {effectiveTotal !== null && (bonusSteps > 0 || multiplier > 1) ? (
            <span className="text-[11px] font-mono-num font-semibold text-emerald-950 whitespace-nowrap shrink-0">
              Move {effectiveTotal} steps
            </span>
          ) : (
            <span
              className={`text-[10px] font-mono-num whitespace-nowrap shrink-0 ${
                disabled ? 'text-slate-400' : 'text-slate-900/80'
              }`}
            >
              {value !== null ? `${effectiveTotal} steps` : 'Tap Ivory'}
            </span>
          )}
        </div>
      </button>
    </div>
  );
};
