export class UserSeed {
  constructor(
    readonly username: string,
    readonly serverSeed: string,
    readonly serverSeedHash: string,
    readonly clientSeed: string,
    readonly nonce: number,
  ) {}
}
