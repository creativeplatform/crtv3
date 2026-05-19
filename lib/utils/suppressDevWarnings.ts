
import { logger } from '@/lib/utils/logger';
/**
 * Suppress development-mode console warnings that are safe to ignore
 * Only runs in development mode
 */

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;

  // List of warning patterns to suppress
  const suppressedPatterns = [
    /signal is aborted without reason/i,
    /aria-hidden on an element because its descendant retained focus/i,
    /Blocked aria-hidden/i,
    // next-themes ThemeProvider injects a blocking inline script (no FOUC). React 19 warns; behavior is intentional.
    /Encountered a script tag while rendering React component/i,
    // Webpack + viem/ox Tempo dynamic import (harmless; narrowed by avoiding `viem/chains` where possible).
    /Critical dependency: the request of a dependency is an expression/i,
  ];

  /**
   * Check if a message should be suppressed
   */
  function shouldSuppress(message: string): boolean {
    return suppressedPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Custom console.error that filters known dev warnings
   */
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (shouldSuppress(message)) {
      // Optionally log to a different level for debugging
      // logger.debug('[Suppressed Error]:', ...args);
      return;
    }
    originalError.apply(console, args);
  };

  /**
   * Custom console.warn that filters known dev warnings
   */
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    if (shouldSuppress(message)) {
      // Optionally log to a different level for debugging
      // logger.debug('[Suppressed Warning]:', ...args);
      return;
    }
    originalWarn.apply(console, args);
  };

  // Log that suppressions are active
  logger.debug(
    '%c[Dev Mode] Warning suppression active',
    'color: #888; font-style: italic;'
  );
}

export {};

