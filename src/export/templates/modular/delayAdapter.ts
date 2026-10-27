export const delayAdapterSource = `export class MockDelayAdapter {
  constructor(fast = false) {
    this.fast = fast;
  }
  async execute(durationMs, signal) {
    if (signal?.aborted) throw new Error("Operação cancelada antes do delay.");
    if (this.fast || durationMs <= 0) {
      await Promise.resolve();
      return;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, durationMs);
      const onAbort = () => {
        cleanup();
        reject(new Error("Execução cancelada durante delay."));
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      signal?.addEventListener("abort", onAbort);
    });
  }
}

`;
