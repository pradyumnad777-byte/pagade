export type DifficultyTierId =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'semi-pro'
  | 'pro'
  | 'super-pro'
  | 'undisputed';

export interface DifficultyTier {
  id: DifficultyTierId;
  name: string;
  subtitle: string;
  minLevel: number;
  botSmartness: number; // 0.15 to 0.98
  sixBiasBonus: number; // Slight tactical aura for higher Shakuni tiers
  captureWeight: number;
  safetyWeight: number;
  homeWeight: number;
  shakuniTitle: string;
  shakuniQuote: string;
  badgeColor: string;
}

export const DIFFICULTY_TIERS: DifficultyTier[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    subtitle: 'Courtyard Initiate',
    minLevel: 1,
    botSmartness: 0.25,
    sixBiasBonus: 0.0,
    captureWeight: 45,
    safetyWeight: 20,
    homeWeight: 60,
    shakuniTitle: 'Shakuni · Casual Observer',
    shakuniQuote: 'Let us see if your hands know how to cast the ivory sticks, newcomer.',
    badgeColor: '#10B981',
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    subtitle: 'Palace Contender',
    minLevel: 4,
    botSmartness: 0.45,
    sixBiasBonus: 0.02,
    captureWeight: 85,
    safetyWeight: 45,
    homeWeight: 80,
    shakuniTitle: 'Shakuni · Crafty Envoy',
    shakuniQuote: 'You have learned the safe squares, yet every step leaves a shadow.',
    badgeColor: '#38BDF8',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    subtitle: 'Sabha Tactician',
    minLevel: 8,
    botSmartness: 0.62,
    sixBiasBonus: 0.04,
    captureWeight: 130,
    safetyWeight: 75,
    homeWeight: 100,
    shakuniTitle: 'Shakuni · Sabha Tactician',
    shakuniQuote: 'Notice how my tokens wait behind yours? A single roll turns the tide.',
    badgeColor: '#818CF8',
  },
  {
    id: 'semi-pro',
    name: 'Semi-Pro',
    subtitle: 'Royal Strategist',
    minLevel: 13,
    botSmartness: 0.76,
    sixBiasBonus: 0.06,
    captureWeight: 175,
    safetyWeight: 110,
    homeWeight: 125,
    shakuniTitle: 'Shakuni · Gandhara Vizier',
    shakuniQuote: 'Fortune favors those who count every square before the dice even settle.',
    badgeColor: '#F59E0B',
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'Dice Sovereign',
    minLevel: 20,
    botSmartness: 0.86,
    sixBiasBonus: 0.08,
    captureWeight: 220,
    safetyWeight: 145,
    homeWeight: 150,
    shakuniTitle: 'Shakuni · Master of Pasa',
    shakuniQuote: 'The ivory listens when I whisper. Guard your tokens well, challenger!',
    badgeColor: '#EC4899',
  },
  {
    id: 'super-pro',
    name: 'Super-Pro',
    subtitle: 'Imperial Grandmaster',
    minLevel: 30,
    botSmartness: 0.93,
    sixBiasBonus: 0.1,
    captureWeight: 270,
    safetyWeight: 185,
    homeWeight: 180,
    shakuniTitle: 'Shakuni · Imperial Grandmaster',
    shakuniQuote: 'Few mortals have reached this chamber. One slip and your lead vanishes!',
    badgeColor: '#F97316',
  },
  {
    id: 'undisputed',
    name: 'Undisputed',
    subtitle: 'Immortal Legend of Pagade',
    minLevel: 45,
    botSmartness: 0.99,
    sixBiasBonus: 0.12,
    captureWeight: 340,
    safetyWeight: 230,
    homeWeight: 220,
    shakuniTitle: 'Shakuni · Undisputed Lord of Dice',
    shakuniQuote: 'No throne remains unshaken in my hall. Prove your mastery is truly undisputed!',
    badgeColor: '#E11D48',
  },
];

export type SkillId =
  | 'loaded_ivory'
  | 'reroll_mantra'
  | 'kavacha_shield'
  | 'royal_stride'
  | 'shakuni_mirror'
  | 'garuda_leap'
  | 'golden_pasa'
  | 'sovereign_decree';

export interface PlayerSkill {
  id: SkillId;
  name: string;
  unlockLevel: number;
  maxChargesPerMatch: number;
  shortTag: string;
  description: string;
  tacticalEffect: string;
}

export const PLAYER_SKILLS: PlayerSkill[] = [
  {
    id: 'loaded_ivory',
    name: 'Loaded Ivory',
    unlockLevel: 1,
    maxChargesPerMatch: 1,
    shortTag: 'Force 6',
    description: 'Guarantees your next Pagade dice cast lands on a 6 to deploy or strike.',
    tacticalEffect: 'Next Roll = 6',
  },
  {
    id: 'reroll_mantra',
    name: 'Second Cast',
    unlockLevel: 2,
    maxChargesPerMatch: 2,
    shortTag: 'Reroll Dice',
    description: 'Cancel an unfavorable roll before moving and cast the ivory dice anew.',
    tacticalEffect: 'Instant Reroll',
  },
  {
    id: 'kavacha_shield',
    name: 'Kavacha Aegis',
    unlockLevel: 3,
    maxChargesPerMatch: 1,
    shortTag: 'Shield All',
    description: 'Grants temporary sanctuary to all your active tokens on the track for 1 full round.',
    tacticalEffect: '1-Round Immunity',
  },
  {
    id: 'royal_stride',
    name: 'Royal Stride',
    unlockLevel: 5,
    maxChargesPerMatch: 2,
    shortTag: '+2 Pips',
    description: 'Adds +2 bonus steps to your current dice value (up to 6) for precision captures.',
    tacticalEffect: '+2 Dice Value',
  },
  {
    id: 'shakuni_mirror',
    name: 'Illusion Gaze',
    unlockLevel: 7,
    maxChargesPerMatch: 1,
    shortTag: 'Cap Shakuni',
    description: 'Hexes Shakuni’s next turn so his ivory dice cannot roll higher than 3.',
    tacticalEffect: 'Bot Max Roll 3',
  },
  {
    id: 'garuda_leap',
    name: 'Garuda Surge',
    unlockLevel: 10,
    maxChargesPerMatch: 1,
    shortTag: 'Double Step',
    description: 'Doubles the movement distance of your next rolled die (e.g., 4 moves 8 steps).',
    tacticalEffect: '2x Move Steps',
  },
  {
    id: 'golden_pasa',
    name: 'Precision Pasa',
    unlockLevel: 14,
    maxChargesPerMatch: 1,
    shortTag: 'Exact Pick',
    description: 'Choose any exact dice value (1, 2, 3, 4, 5, or 6) on your turn.',
    tacticalEffect: 'Choose 1–6',
  },
  {
    id: 'sovereign_decree',
    name: 'Sovereign Recall',
    unlockLevel: 18,
    maxChargesPerMatch: 1,
    shortTag: 'Instant Deploy',
    description: 'Immediately deploys one locked token from your royal yard onto your starting square.',
    tacticalEffect: 'Free Yard Exit',
  },
];

// 15x15 Ludo Board Coordinates
// 52-cell main loop starting from Player's start square (Bottom-Left of bottom arm: row 13, col 6)
export const MAIN_TRACK_COORDS: [number, number][] = [
  // Bottom arm going up (left column of bottom vertical arm: col 6, rows 13..9)
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // Left arm going left (bottom row of left horizontal arm: row 8, cols 5..0)
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  // Left arm turn up (col 0, row 7)
  [7, 0],
  // Left arm going right (top row of left horizontal arm: row 6, cols 0..5)
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // Top arm going up (left column of top vertical arm: col 6, rows 5..0)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  // Top arm turn right (row 0, col 7)
  [0, 7],
  // Top arm going down (right column of top vertical arm: col 8, rows 0..5) -> 26 is [1,8] Shakuni Start
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // Right arm going right (top row of right horizontal arm: row 6, cols 9..14)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  // Right arm turn down (row 7, col 14)
  [7, 14],
  // Right arm going left (bottom row of right horizontal arm: row 8, cols 14..9)
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // Bottom arm going down (right column of bottom vertical arm: col 8, rows 9..14)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  // Bottom arm turn left (row 14, col 7)
  [14, 7],
  // Final square before player's home stretch entry or [14, 6]
  [14, 6],
];

// Player Home Stretch (steps 51..55 -> row 13..9, col 7; step 56 is Home Goal [8, 7])
export const PLAYER_HOME_COORDS: [number, number][] = [
  [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7],
];

// Shakuni Home Stretch (steps 51..55 -> row 1..5, col 7; step 56 is Home Goal [6, 7])
export const SHAKUNI_HOME_COORDS: [number, number][] = [
  [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
];

// Yard positions for Player (Bottom-Left 6x6 yard: rows 9..14, cols 0..5)
export const PLAYER_YARD_COORDS: [number, number][] = [
  [10, 1], [10, 4], [13, 1], [13, 4],
];

// Yard positions for Shakuni (Top-Right 6x6 yard: rows 0..5, cols 9..14)
export const SHAKUNI_YARD_COORDS: [number, number][] = [
  [1, 10], [1, 13], [4, 10], [4, 13],
];

// 8 Classic Pagade Chira (Safe Sanctuary) Squares on the 52-step loop (relative to global index 0..51)
// 0: Player Start [13,6], 8: Left Star [6,2], 13: Top-Left Start [1,6], 21: Top Star [2,8] wait:
// Let's check exact coordinates of indices:
// 0 -> [13, 6] (Bottom-Left Start)
// 8 -> [8, 2] (Left Arm Bottom Star)
// 13 -> [6, 1] (Left Arm Top Start)
// 21 -> [2, 6] (Top Arm Left Star)
// 26 -> [1, 8] (Top-Right Shakuni Start)
// 34 -> [6, 12] (Right Arm Top Star)
// 39 -> [8, 13] (Right Arm Bottom Start)
// 47 -> [12, 8] (Bottom Arm Right Star)
export const SAFE_GLOBAL_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

export interface LevelNodeInfo {
  level: number;
  title: string;
  tier: DifficultyTier;
  skillReward?: PlayerSkill;
  isBossGate: boolean;
  xpReward: number;
}

export function getTierForLevel(level: number): DifficultyTier {
  let matched = DIFFICULTY_TIERS[0];
  for (const tier of DIFFICULTY_TIERS) {
    if (level >= tier.minLevel) {
      matched = tier;
    }
  }
  return matched;
}

export function getLevelNodeInfo(level: number, overrideTierId?: DifficultyTierId | 'auto'): LevelNodeInfo {
  const autoTier = getTierForLevel(level);
  const tier =
    overrideTierId && overrideTierId !== 'auto'
      ? DIFFICULTY_TIERS.find((t) => t.id === overrideTierId) || autoTier
      : autoTier;

  const skillReward = PLAYER_SKILLS.find((s) => s.unlockLevel === level);
  const isBossGate = level % 5 === 0;

  const palaceNames = [
    'Lotus Courtyard',
    'Ivory Pavilion',
    'Sabha Pillars',
    'Crimson Veranda',
    'Gandhara Hall',
    'Sapphire Sanctum',
    'Emerald Terrace',
    'Obsidian Throne',
    'Sunlit Mandapa',
    'Royal Treasury',
  ];
  const baseName = palaceNames[(level - 1) % palaceNames.length];
  const title = isBossGate ? `Grand Sabha Trial ${level}` : `${baseName} · Stage ${level}`;

  return {
    level,
    title,
    tier,
    skillReward,
    isBossGate,
    xpReward: 100 + level * 25 + (isBossGate ? 150 : 0),
  };
}
