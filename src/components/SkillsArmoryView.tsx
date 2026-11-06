import React from 'react';
import { Lock, CheckCircle2, Sparkles, Shield, Zap } from 'lucide-react';
import { PLAYER_SKILLS, PlayerSkill } from '../data/pagadeData';

interface SkillsArmoryViewProps {
  highestUnlockedLevel: number;
  onStartNextStage: () => void;
}

export const SkillsArmoryView: React.FC<SkillsArmoryViewProps> = ({
  highestUnlockedLevel,
  onStartNextStage,
}) => {
  const unlockedCount = PLAYER_SKILLS.filter(
    (s) => s.unlockLevel <= highestUnlockedLevel
  ).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-5 pb-24 flex flex-col gap-6">
      {/* Header Summary */}
      <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <span>Tactical Pasa Armory</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              {unlockedCount} of {PLAYER_SKILLS.length} Unlocked
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white mt-1 text-balance">
            Royal Pagade Skills & Mantras
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Complete campaign stages to unlock new tactical skills. Every unlocked skill recharges automatically at the start of each match against Shakuni.
          </p>
        </div>

        <button
          type="button"
          onClick={onStartNextStage}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          Play Stage {highestUnlockedLevel}
        </button>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLAYER_SKILLS.map((skill: PlayerSkill) => {
          const isUnlocked = skill.unlockLevel <= highestUnlockedLevel;
          return (
            <div
              key={skill.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                isUnlocked
                  ? 'bg-[#171F2C] border-slate-800'
                  : 'bg-slate-900/50 border-slate-800/60 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      isUnlocked
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-slate-800/80 border-slate-700 text-slate-500'
                    }`}
                  >
                    {skill.id === 'kavacha_shield' ? (
                      <Shield className="w-5 h-5" />
                    ) : isUnlocked ? (
                      <Sparkles className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {skill.name}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{skill.tacticalEffect}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {skill.maxChargesPerMatch} {skill.maxChargesPerMatch > 1 ? 'Uses' : 'Use'} / Match
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono-num shrink-0">
                  {isUnlocked ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Stage {skill.unlockLevel}</span>
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {skill.description}
              </p>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-amber-300/90">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Command: {skill.shortTag}</span>
                </span>
                <span>
                  {isUnlocked
                    ? `Unlocked at Stage ${skill.unlockLevel}`
                    : `Clear ${skill.unlockLevel - highestUnlockedLevel} more stage(s)`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
