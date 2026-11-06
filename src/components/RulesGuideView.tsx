import React from 'react';
import { Award, Shield, Star, Swords, CheckCircle2, Sparkles } from 'lucide-react';
import { DIFFICULTY_TIERS } from '../data/pagadeData';

export const RulesGuideView: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-5 pb-24 flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5">
        <p className="text-xs text-amber-400 font-medium">
          Royal Rules, Store Review Upgrades & Strategy Codex
        </p>
        <h1 className="font-display text-2xl font-bold text-white mt-1">
          How to Master Pagade
        </h1>
        <p className="text-sm text-slate-300 mt-1 leading-relaxed">
          Pagade combines the ancient Indian royal dice game with top player-requested quality-of-life upgrades from App Store and Play Store Ludo community reviews.
        </p>
      </div>

      {/* App Store & Play Store Community Review Upgrades Built Into Pagade */}
      <div className="rounded-2xl border border-amber-500/30 bg-[#171F2C] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Built on App Store & Play Store Ludo Review Insights</span>
          </div>
          <span className="text-xs text-slate-400">Player-First Design</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Pity-6 Anti-Stuck Guarantee</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Top store complaint: <em>“Stuck in the yard for 15 turns without rolling a 6.”</em> Pagade tracks your yard drought and guarantees a 6 on your 6th cast if tokens are waiting to deploy.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Quick Blitz (2-Token) & Auto-Move</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Top mobile request: <em>“Matches take too long on mobile commutes.”</em> Toggle between Classic (4 tokens home) and Quick Blitz (first to 2 tokens home), plus automatic single-token movement.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Jodi Pair Blockade & Fair Dice Log</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Top fairness request: <em>“Bot kills me right before home & dice feel rigged.”</em> Stacking 2 friendly tokens forms an unbreakable Jodi Pair Fortress, and a live Dice Audit Log proves roll fairness.
            </p>
          </div>
        </div>
      </div>

      {/* Core Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <Award className="w-4 h-4" />
            <span>01. Deploying & Advancing Tokens</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Roll a <strong className="text-white font-mono-num">6</strong> on the carved ivory dice (or trigger your <strong className="text-amber-300">Sovereign Recall</strong> or <strong className="text-amber-300">Loaded Ivory</strong> skill) to bring a token out of your royal yard onto your starting square. Rolling a 6 or capturing an enemy token awards an immediate bonus roll.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <Swords className="w-4 h-4" />
            <span>02. Capturing & Jodi Pair Fortresses</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Landing on an unprotected square occupied by a single Shakuni token sends his token back to his yard and grants you an extra turn. However, when 2 friendly tokens stand together on any square, they form a <strong className="text-white">Jodi Fortress</strong> that cannot be captured!
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <Star className="w-4 h-4" />
            <span>03. Chira Safe Sanctuary Squares</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The 8 star-marked <strong className="text-white">Chira</strong> squares around the board provide complete sanctuary. No token resting on a star square can be captured. You can also activate <strong className="text-amber-300">Kavacha Aegis</strong> to shield your tokens anywhere on the track for 1 full round.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
            <Shield className="w-4 h-4" />
            <span>04. Classic (4-Token) vs Quick Blitz (2-Token)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            After completing a full circuit of 51 steps around the Sabha board, your tokens enter your private golden home column. Lead all 4 tokens (or 2 tokens in <strong className="text-white">Quick Blitz</strong> mode) into the central Royal Mandapa by exact dice count to win the stage.
          </p>
        </div>
      </div>

      {/* 7 Mastery Tiers Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#171F2C] p-5 flex flex-col gap-3">
        <h2 className="font-display text-base font-bold text-white">
          Shakuni’s 7 Mastery Ranks
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Rank</th>
                <th className="py-2.5 px-4 font-medium">Title</th>
                <th className="py-2.5 px-4 font-medium">Campaign Stage</th>
                <th className="py-2.5 pl-4 font-medium text-right">Tactical IQ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {DIFFICULTY_TIERS.map((tier) => (
                <tr key={tier.id}>
                  <td className="py-2.5 pr-4 font-semibold text-white">
                    {tier.name}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300">
                    {tier.shakuniTitle}
                  </td>
                  <td className="py-2.5 px-4 font-mono-num text-amber-400">
                    Stage {tier.minLevel}+
                  </td>
                  <td className="py-2.5 pl-4 font-mono-num text-right text-emerald-400">
                    {Math.round(tier.botSmartness * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
