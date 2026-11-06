import React from 'react';
import { Lock, CheckCircle2, Crown, Sparkles, Swords, Play } from 'lucide-react';
import {
  DIFFICULTY_TIERS,
  DifficultyTierId,
  PLAYER_SKILLS,
  getLevelNodeInfo,
} from '../data/pagadeData';

interface CampaignPathViewProps {
  highestUnlockedLevel: number;
  selectedLevel: number;
  selectedDifficulty: DifficultyTierId | 'auto';
  onSelectDifficulty: (tierId: DifficultyTierId | 'auto') => void;
  onSelectLevel: (level: number) => void;
  onStartMatch: (level: number) => void;
  palaceBannerUrl: string;
  shakuniAvatarUrl: string;
}

export const CampaignPathView: React.FC<CampaignPathViewProps> = ({
  highestUnlockedLevel,
  selectedLevel,
  selectedDifficulty,
  onSelectDifficulty,
  onSelectLevel,
  onStartMatch,
  palaceBannerUrl,
  shakuniAvatarUrl,
}) => {
  // Endless window: show from Level 1 up to highestUnlockedLevel + 18 (and dynamically expand as player progresses)
  const totalVisibleNodes = Math.max(30, highestUnlockedLevel + 18);
  const levels = Array.from({ length: totalVisibleNodes }, (_, i) => i + 1);

  const activeNodeInfo = getLevelNodeInfo(selectedLevel, selectedDifficulty);
  const unlockedSkillsCount = PLAYER_SKILLS.filter(
    (s) => s.unlockLevel <= highestUnlockedLevel
  ).length;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-4 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Campaign Hero, Difficulty Selector, and Selected Stage Details */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        {/* Royal Campaign Card */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#171F2C]">
          <div className="relative h-44 w-full bg-slate-900">
            <img
              src={palaceBannerUrl}
              alt="Royal Pagade Sabha Table"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#171F2C] via-black/50 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-amber-300/90 font-medium">
                  Endless Royal Saga · Stage <span className="font-mono-num">{highestUnlockedLevel}</span> Reached
                </p>
                <h1 className="font-display text-2xl font-bold text-white tracking-tight text-balance">
                  The Dice of Gandhara
                </h1>
              </div>
            </div>
          </div>

          {/* Clean unboxed campaign metrics with typographic separators */}
          <div className="p-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 border-t border-slate-800/80">
            <span>
              Unlocked Stage: <strong className="font-mono-num text-white">{highestUnlockedLevel}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Skills Mastered: <strong className="font-mono-num text-amber-400">{unlockedSkillsCount}/{PLAYER_SKILLS.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Mode: <strong className="text-emerald-400">{ activeNodeInfo.tier.name }</strong>
            </span>
          </div>
        </div>

        {/* 7-Rank Difficulty Tier Selector (Beginner -> Undisputed) */}
        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Select Shakuni’s Mastery Rank
            </h2>
            <span className="text-xs text-slate-400">
              {selectedDifficulty === 'auto' ? 'Scales with Stage' : 'Custom Rank'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => onSelectDifficulty('auto')}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedDifficulty === 'auto'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Auto Scale
            </button>
            {DIFFICULTY_TIERS.map((tier) => {
              const isActive = selectedDifficulty === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => onSelectDifficulty(tier.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  {tier.name}
                </button>
              );
            })}
          </div>

          {/* Shakuni Opponent Intelligence Brief */}
          <div className="mt-1 pt-3 border-t border-slate-800/80 flex items-center gap-3.5">
            <img
              src={shakuniAvatarUrl}
              alt="Shakuni Portrait"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-xl object-cover border border-rose-500/40 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
                <span className="truncate">{activeNodeInfo.tier.shakuniTitle}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-amber-300 shrink-0">
                  AI IQ {Math.round(activeNodeInfo.tier.botSmartness * 100)}%
                </span>
              </div>
              <p className="text-xs text-slate-300 italic mt-1 line-clamp-2">
                “{activeNodeInfo.tier.shakuniQuote}”
              </p>
            </div>
          </div>
        </div>

        {/* Selected Stage Briefing & Launch Button */}
        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono-num text-amber-400 font-semibold">
                  STAGE {activeNodeInfo.level}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeNodeInfo.tier.name} Rank</span>
                {activeNodeInfo.isBossGate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-rose-400 font-medium">Royal Sabha Trial</span>
                  </>
                )}
              </div>
              <h3 className="font-display text-lg font-bold text-white mt-0.5">
                {activeNodeInfo.title}
              </h3>
            </div>
            <span className="text-xs font-mono-num text-slate-400 whitespace-nowrap shrink-0">
              +{activeNodeInfo.xpReward} Glory
            </span>
          </div>

          {activeNodeInfo.skillReward && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-amber-200">
                  Stage Completion Skill Unlock: {activeNodeInfo.skillReward.name}
                </p>
                <p className="text-slate-300 mt-0.5">
                  {activeNodeInfo.skillReward.description}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={selectedLevel > highestUnlockedLevel}
            onClick={() => onStartMatch(selectedLevel)}
            className={`w-full min-h-[48px] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-transform cursor-pointer whitespace-nowrap shrink-0 ${
              selectedLevel <= highestUnlockedLevel
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {selectedLevel <= highestUnlockedLevel ? (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play Stage {selectedLevel} vs Shakuni</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Complete Stage {selectedLevel - 1} to Unlock</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Column: Winding Endless Saga Map (Candy Crush Style Path) */}
      <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Endless Royal Saga Path
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Advance through palace chambers, unlock divine Pagade skills, and outwit Shakuni
            </p>
          </div>
          <span className="text-xs font-mono-num text-amber-400 whitespace-nowrap shrink-0">
            Stages 1 – {totalVisibleNodes}+
          </span>
        </div>

        {/* Winding Saga Nodes List */}
        <div className="relative py-4 flex flex-col gap-5 max-h-[560px] overflow-y-auto pr-1">
          {levels.map((lvl, index) => {
            const info = getLevelNodeInfo(lvl, selectedDifficulty);
            const isUnlocked = lvl <= highestUnlockedLevel;
            const isCompleted = lvl < highestUnlockedLevel;
            const isCurrent = lvl === highestUnlockedLevel;
            const isSelected = lvl === selectedLevel;

            // Create a smooth sinusoidal winding path offset across mobile & desktop
            const waveOffsets = [
              'self-center',
              'self-center translate-x-8 sm:translate-x-14',
              'self-center translate-x-12 sm:translate-x-24',
              'self-center translate-x-8 sm:translate-x-14',
              'self-center',
              'self-center -translate-x-8 sm:-translate-x-14',
              'self-center -translate-x-12 sm:-translate-x-24',
              'self-center -translate-x-8 sm:-translate-x-14',
            ];
            const offsetClass = waveOffsets[index % waveOffsets.length];

            return (
              <div key={lvl} className={`flex items-center gap-3.5 ${offsetClass}`}>
                <button
                  type="button"
                  onClick={() => onSelectLevel(lvl)}
                  aria-label={`Select Stage ${lvl}`}
                  className={`relative min-w-[56px] min-h-[56px] rounded-2xl flex flex-col items-center justify-center transition-transform cursor-pointer border-2 ${
                    isSelected
                      ? 'scale-110 ring-2 ring-amber-400 border-white bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25'
                      : isCurrent
                      ? 'border-amber-300 bg-gradient-to-b from-amber-500 to-amber-700 text-slate-950 shadow-md'
                      : isCompleted
                      ? 'border-emerald-500/60 bg-emerald-950/70 text-emerald-200 hover:border-emerald-400'
                      : 'border-slate-800 bg-slate-900/90 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  {info.isBossGate && (
                    <Crown
                      className={`w-3.5 h-3.5 mb-0.5 ${
                        isSelected || isCurrent ? 'text-slate-950' : 'text-rose-400'
                      }`}
                    />
                  )}
                  <span className="font-mono-num text-sm font-bold leading-none">
                    {lvl}
                  </span>
                  {isCompleted && !info.isBossGate && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5" />
                  )}
                  {!isUnlocked && !info.isBossGate && (
                    <Lock className="w-3 h-3 text-slate-600 mt-0.5" />
                  )}
                </button>

                {/* Node Metadata Label */}
                <div
                  onClick={() => onSelectLevel(lvl)}
                  className="cursor-pointer flex flex-col min-w-[155px] max-w-[220px]"
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={`font-semibold truncate ${
                        isSelected
                          ? 'text-amber-300'
                          : isUnlocked
                          ? 'text-slate-200'
                          : 'text-slate-500'
                      }`}
                    >
                      {info.isBossGate ? `Sabha Boss · Stage ${lvl}` : `Stage ${lvl}`}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                      {info.tier.name}
                    </span>
                  </div>

                  {info.skillReward ? (
                    <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span className="truncate">Unlocks {info.skillReward.name}</span>
                    </span>
                  ) : info.isBossGate ? (
                    <span className="text-[11px] text-rose-400/90 flex items-center gap-1 mt-0.5">
                      <Swords className="w-3 h-3 shrink-0" />
                      <span>High-Stakes Shakuni Duel</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 truncate mt-0.5">
                      {info.title.split('·')[0].trim()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
