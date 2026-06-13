// src/sync/retryPolicy.ts

export function calculateNextAttemptAt(attemptCount: number): string {
  const now = new Date();

  const delaySeconds = getRetryDelaySeconds(attemptCount);

  now.setSeconds(now.getSeconds() + delaySeconds);

  return now.toISOString();
}

export function getRetryDelaySeconds(attemptCount: number): number {
  if (attemptCount <= 0) {
    return 30;
  }

  if (attemptCount === 1) {
    return 60;
  }

  if (attemptCount === 2) {
    return 120;
  }

  if (attemptCount === 3) {
    return 300;
  }

  if (attemptCount === 4) {
    return 900;
  }

  return 1800;
}

export function shouldStopRetrying(params: {
  attemptCount: number;
  maxAttempts: number;
}): boolean {
  return params.attemptCount >= params.maxAttempts;
}