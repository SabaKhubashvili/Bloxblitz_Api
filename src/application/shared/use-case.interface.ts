export interface IUseCase<TIn, TOut> {
  execute(input: TIn): Promise<TOut>;
}
