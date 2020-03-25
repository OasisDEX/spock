import { captureException, flush } from '@sentry/node';

export function runAndHandleErrors(fn: () => Promise<any>): void {
  fn().catch(async (e) => {
    console.error(e);

    captureException(e);
    try {
      // need for sentry to send async requests
      await flush();
    } finally {
      process.exit(1);
    }
  });
}
