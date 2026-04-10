/**
 * Reads roulette admin hash (`roulette:admin:config`) so wager games can align with
 * roulette kill switches (same semantics as BloxBlitz_Amp/ws).
 */
export type RouletteAdminWagerGateState = {
  gameEnabled: boolean;
  bettingEnabled: boolean;
};

export interface RouletteAdminWagerGateProvider {
  getWagerGateState(): Promise<RouletteAdminWagerGateState>;
}
