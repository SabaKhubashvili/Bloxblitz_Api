export interface VerifyMinesGameOutputDto {
  verified: boolean;
  message: string;
  data: {
    minePositions: number[];
    gridSize: number;
    mines: number;
    nonce: number;
  };
}
