export interface VerifyMinesGameCommand {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  gridSize: number;
  mines: number;
}
