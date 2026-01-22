import { BannedData } from "../interface/BannedData.interface";
import { TimedOutDataInterface } from "../interface/TimedOut.interface";

export interface GetUserInfoResult {
  canChat: boolean;
  statusMessage: string;
  timedOutData: TimedOutDataInterface | null;
  bannedData: BannedData | null;
  statistics: {
    totalWagered:number,
    coinflipsWon:number,
    biggestWin:number
  };
  possibleAlts:{username:string}[]
}
