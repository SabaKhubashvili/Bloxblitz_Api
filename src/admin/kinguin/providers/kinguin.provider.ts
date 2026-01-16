import { generateNewKinguinCodesResult } from "../contracts/generate-new-kinguin-codes-result";

export interface KinguinProvider{
    createCodes(codes: { raw: string; hashed: string, balanceAmount: number }[],): Promise<generateNewKinguinCodesResult>;
}