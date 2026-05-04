/**
 * A simple asynchronous lock to ensure only one task can execute a piece of code at a time.
 */
export class AsyncLock {
  private queue: Promise<void> = Promise.resolve();

  /**
   * Acquire the lock. Returns a function that must be called to release it.
   * @returns A release function.
   */
  public async acquire(): Promise<() => void> {
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    const current = this.queue;
    this.queue = current.then(() => next);

    await current;
    return release;
  }

  /**
   * Run a task exclusively.
   * @param task - The task to run.
   * @returns The result of the task.
   */
  public async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }
}

// Global instance for session merging
export const sessionMergeLock = new AsyncLock();
