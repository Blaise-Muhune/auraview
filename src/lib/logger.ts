/**
 * Logger that only outputs sensitive/debug info in development.
 * In production, debug logs are no-ops; errors log generic messages only.
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) {
      console.log(...args);
    }
  },

  error(message: string, err?: unknown): void {
    if (isDev) {
      console.error(message, err);
    } else {
      console.error(message);
    }
  },

  warn(...args: unknown[]): void {
    if (isDev) {
      console.warn(...args);
    }
  },
};
