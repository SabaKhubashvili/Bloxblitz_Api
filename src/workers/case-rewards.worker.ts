import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class CaseRewardsWorker {
  constructor() {}

  @Cron('0 17 * * 6')
  async handleCaseRewards() {
    try{
        
    }catch(err){

    }
  }
}