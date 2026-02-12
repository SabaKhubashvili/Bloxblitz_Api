import { generateNewKinguinCodesResult } from "../contracts/generate-new-kinguin-codes-result";

export interface KinguinProvider{
    createCodes(offerId:string,codes: { raw: string; hashed: string, balanceAmount: number }[],): Promise<generateNewKinguinCodesResult>;
}