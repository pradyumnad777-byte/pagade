import {
  DifficultyTier,
  MAIN_TRACK_COORDS,
  PLAYER_HOME_COORDS,
  PLAYER_YARD_COORDS,
  SAFE_GLOBAL_INDICES,
  SHAKUNI_HOME_COORDS,
  SHAKUNI_YARD_COORDS,
} from '../data/pagadeData';

export type Owner = 'player' | 'shakuni';

export type GameMode = 'classic' | 'quick_blitz';

export interface Token {
  id: string;
  owner: Owner;
  tokenIndex: number; // 0..3
  step: number; // -1 = in yard, 0..50 = main track, 51..55 = home column, 56 = finished home
}

export interface MoveCandidate {
  tokenIndex: number;
  fromStep: number;
  toStep: number;
  capturesTokens: Token[];
  reachesHome: boolean;
  landsOnSafe: boolean;
  formsJodiBlock: boolean;
  exitsYard: boolean;
}

export interface DiceAuditStats {
  playerRolls: number[];
  shakuniRolls: number[];
  playerDryStreak: number; // How many rolls without a 6 while tokens are in yard
}

/**
 * Converts a relative step (0..50) for 'player' or 'shakuni' into a global track index (0..51).
 */
export function getGlobalTrackIndex(owner: Owner, step: number): number | null {
  if (step < 0 || step > 50) return null;
  const offset = owner === 'player' ? 0 : 26;
  return (step + offset) % 52;
}

/**
 * Returns [row, col] on the 15x15 grid for a given token.
 */
export function getTokenBoardCoord(token: Token): [number, number] {
  if (token.step === -1) {
    return token.owner === 'player'
      ? PLAYER_YARD_COORDS[token.tokenIndex]
      : SHAKUNI_YARD_COORDS[token.tokenIndex];
  }
  if (token.step >= 51 && token.step <= 56) {
    const homeIdx = token.step - 51;
    return token.owner === 'player'
      ? PLAYER_HOME_COORDS[homeIdx]
      : SHAKUNI_HOME_COORDS[homeIdx];
  }
  const globalIdx = getGlobalTrackIndex(token.owner, token.step)!;
  return MAIN_TRACK_COORDS[globalIdx];
}

/**
 * Checks if a global square (0..51) has a Jodi (Pair) Blockade owned by `owner`.
 * Based on Play Store & App Store Ludo reviews, when 2 or more friendly tokens stand on the same square,
 * they form a protective Jodi Fortress that single opponent tokens cannot capture!
 */
export function hasJodiBlockadeAt(tokens: Token[], owner: Owner, globalIdx: number): boolean {
  const count = tokens.filter(
    (t) => t.owner === owner && getGlobalTrackIndex(t.owner, t.step) === globalIdx
  ).length;
  return count >= 2;
}

/**
 * Computes all valid moves for `owner` given `diceValue` and optional `moveMultiplier` (e.g. Garuda Surge = 2x).
 */
export function getValidMoves(
  tokens: Token[],
  owner: Owner,
  diceValue: number,
  moveMultiplier: number = 1,
  opponentShielded: boolean = false
): MoveCandidate[] {
  const myTokens = tokens.filter((t) => t.owner === owner);
  const oppOwner: Owner = owner === 'player' ? 'shakuni' : 'player';
  const oppTokens = tokens.filter((t) => t.owner === oppOwner);
  const candidates: MoveCandidate[] = [];

  for (const token of myTokens) {
    if (token.step === 56) continue; // Already home

    // Exiting the yard requires rolling a 6
    if (token.step === -1) {
      if (diceValue === 6) {
        const toStep = 0;
        const targetGlobal = getGlobalTrackIndex(owner, toStep)!;
        const landsOnSafe = SAFE_GLOBAL_INDICES.has(targetGlobal);
        const oppHasJodi = hasJodiBlockadeAt(tokens, oppOwner, targetGlobal);
        const capturesTokens =
          landsOnSafe || opponentShielded || oppHasJodi
            ? []
            : oppTokens.filter((opp) => getGlobalTrackIndex(opp.owner, opp.step) === targetGlobal);

        const friendlyAtDest = myTokens.some(
          (m) => m.tokenIndex !== token.tokenIndex && getGlobalTrackIndex(m.owner, m.step) === targetGlobal
        );

        candidates.push({
          tokenIndex: token.tokenIndex,
          fromStep: -1,
          toStep,
          capturesTokens,
          reachesHome: false,
          landsOnSafe: landsOnSafe || friendlyAtDest,
          formsJodiBlock: friendlyAtDest,
          exitsYard: true,
        });
      }
      continue;
    }

    // Moving on board or home stretch
    const effectiveSteps = diceValue * moveMultiplier;
    const toStep = token.step + effectiveSteps;
    if (toStep > 56) continue; // Must roll exact steps to enter Home Goal (56)

    const reachesHome = toStep === 56;
    const targetGlobal = getGlobalTrackIndex(owner, toStep);
    const friendlyAtDest =
      targetGlobal !== null &&
      myTokens.some(
        (m) => m.tokenIndex !== token.tokenIndex && getGlobalTrackIndex(m.owner, m.step) === targetGlobal
      );

    const landsOnSafe =
      reachesHome ||
      toStep >= 51 ||
      friendlyAtDest ||
      (targetGlobal !== null && SAFE_GLOBAL_INDICES.has(targetGlobal));

    let capturesTokens: Token[] = [];
    if (targetGlobal !== null && !landsOnSafe && !opponentShielded) {
      const oppHasJodi = hasJodiBlockadeAt(tokens, oppOwner, targetGlobal);
      if (!oppHasJodi) {
        capturesTokens = oppTokens.filter(
          (opp) => getGlobalTrackIndex(opp.owner, opp.step) === targetGlobal
        );
      }
    }

    candidates.push({
      tokenIndex: token.tokenIndex,
      fromStep: token.step,
      toStep,
      capturesTokens,
      reachesHome,
      landsOnSafe,
      formsJodiBlock: friendlyAtDest,
      exitsYard: false,
    });
  }

  return candidates;
}

/**
 * Evaluates how dangerous a global square (0..51) is for `owner` based on opponent tokens 1..6 steps behind.
 */
function evaluateSquareDanger(globalIdx: number, opponentTokens: Token[]): number {
  let threatCount = 0;
  for (const opp of opponentTokens) {
    if (opp.step < 0 || opp.step > 50) continue;
    const oppGlobal = getGlobalTrackIndex(opp.owner, opp.step)!;
    const dist = (globalIdx - oppGlobal + 52) % 52;
    if (dist >= 1 && dist <= 6) {
      threatCount += 1;
    }
  }
  return threatCount;
}

/**
 * Shakuni AI Move Selector — scales with selected DifficultyTier and Player Campaign Level.
 */
export function chooseShakuniMove(
  candidates: MoveCandidate[],
  allTokens: Token[],
  tier: DifficultyTier,
  campaignLevel: number
): MoveCandidate {
  if (candidates.length === 1) return candidates[0];

  const levelBonus = Math.min(0.15, campaignLevel * 0.004);
  const smartProbability = Math.min(0.99, tier.botSmartness + levelBonus);

  if (Math.random() > smartProbability) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const playerTokens = allTokens.filter((t) => t.owner === 'player');

  let bestMove = candidates[0];
  let bestScore = -Infinity;

  for (const move of candidates) {
    let score = 0;

    // 1. Capturing a player token
    if (move.capturesTokens.length > 0) {
      const capturedProgress = move.capturesTokens.reduce((acc, t) => acc + Math.max(10, t.step), 0);
      score += tier.captureWeight + capturedProgress * 3.5;
    }

    // 2. Reaching Home Goal
    if (move.reachesHome) {
      score += tier.homeWeight;
    }

    // 3. Exiting the yard
    if (move.exitsYard) {
      const activeShakuniCount = allTokens.filter(
        (t) => t.owner === 'shakuni' && t.step >= 0 && t.step < 56
      ).length;
      score += activeShakuniCount < 2 ? 155 : 95;
    }

    // 4. Entering safe home stretch (steps 51..55)
    if (move.fromStep <= 50 && move.toStep >= 51) {
      score += tier.safetyWeight * 1.1;
    }

    // 5. Landing on a Chira safe star square or forming a Jodi Pair Blockade
    if (move.landsOnSafe && move.toStep <= 50) {
      score += tier.safetyWeight * 0.75;
    }
    if (move.formsJodiBlock) {
      score += tier.safetyWeight * 0.6;
    }

    // 6. Escaping danger vs stepping into danger
    const fromGlobal = getGlobalTrackIndex('shakuni', move.fromStep);
    const toGlobal = getGlobalTrackIndex('shakuni', move.toStep);

    if (fromGlobal !== null && !SAFE_GLOBAL_INDICES.has(fromGlobal)) {
      const currentDanger = evaluateSquareDanger(fromGlobal, playerTokens);
      if (currentDanger > 0) {
        score += currentDanger * (tier.safetyWeight * 0.65);
      }
    }

    if (toGlobal !== null && !move.landsOnSafe) {
      const newDanger = evaluateSquareDanger(toGlobal, playerTokens);
      score -= newDanger * (tier.safetyWeight * 0.8);
    }

    // 7. Stalking player tokens
    if (toGlobal !== null) {
      for (const pt of playerTokens) {
        const ptGlobal = getGlobalTrackIndex('player', pt.step);
        if (ptGlobal !== null && !SAFE_GLOBAL_INDICES.has(ptGlobal)) {
          const stalkDist = (ptGlobal - toGlobal + 52) % 52;
          if (stalkDist >= 1 && stalkDist <= 6) {
            score += tier.captureWeight * 0.25;
          }
        }
      }
    }

    // 8. General forward progression
    score += move.toStep * 1.4;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

/**
 * Generates a Pagade dice roll (1..6) with Play Store / App Store review anti-frustration rules:
 * - Pity-6 Guarantee: If the player has tokens locked in the yard and has gone 5 consecutive rolls without a 6,
 *   the 6th roll is guaranteed to be a 6 (fixes the #1 Ludo complaint of being stuck in the yard for 15+ turns).
 * - Triple-6 Limit: Prevents endless 6-streaks for the bot.
 */
export function rollPagadeDice(
  owner: Owner,
  tokens: Token[],
  tier: DifficultyTier,
  campaignLevel: number,
  shakuniCappedToThree: boolean,
  playerDryStreak: number = 0,
  consecutiveSixes: number = 0
): number {
  if (owner === 'shakuni' && shakuniCappedToThree) {
    return Math.floor(Math.random() * 3) + 1;
  }

  // Prevent a 3rd consecutive 6 in a single turn
  if (consecutiveSixes >= 2) {
    return Math.floor(Math.random() * 5) + 1; // 1..5
  }

  const fairRoll = Math.floor(Math.random() * 6) + 1;

  if (owner === 'player') {
    const lockedCount = tokens.filter((t) => t.owner === 'player' && t.step === -1).length;
    // Pity-6 Timer: Guarantee a 6 after 5 dry rolls while tokens remain in yard
    if (lockedCount > 0 && playerDryStreak >= 5) {
      return 6;
    }
    if (lockedCount === 4 && Math.random() < 0.22) {
      return 6;
    }
    return fairRoll;
  }

  // Shakuni tactical dice aura based on tier + level (strictly capped so RNG remains transparent and fair)
  const tacticalChance = Math.min(0.18, tier.sixBiasBonus + campaignLevel * 0.0015);
  if (Math.random() < tacticalChance) {
    for (let testRoll = 6; testRoll >= 1; testRoll--) {
      const moves = getValidMoves(tokens, 'shakuni', testRoll, 1, false);
      if (moves.some((m) => m.capturesTokens.length > 0 || m.reachesHome)) {
        return testRoll;
      }
    }
  }

  return fairRoll;
}
