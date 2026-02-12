
export const LEVELING_CONFIG = {
  BASE_XP: 100,
  EXPONENT: 1.5,
  
  XP_RATES: {
    COINFLIP: 1.0,
    CRASH: 0.8,
    MINES: 1.2,
  },
  
  MILESTONE_REWARDS: {
    10: { balanceBonus: 100, multiplierIncrease: 0.1 },
    25: { balanceBonus: 300, multiplierIncrease: 0.15 },
    50: { balanceBonus: 750, multiplierIncrease: 0.25 },
    100: { balanceBonus: 2000, multiplierIncrease: 0.5 },
  },
} as const;

export const XP_PER_DOLLAR = 1.0;