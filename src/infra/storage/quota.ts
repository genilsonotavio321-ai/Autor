/** Warn when storage usage crosses 90% of the quota (plan: quota detection). */
export const QUOTA_WARNING_THRESHOLD = 0.9;

export interface StorageEstimateInfo {
  usage: number;
  quota: number;
  percentUsed: number;
  nearLimit: boolean;
}

export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  const estimate = (await navigator.storage?.estimate?.()) ?? {};
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  const percentUsed = quota > 0 ? usage / quota : 0;

  return {
    usage,
    quota,
    percentUsed,
    nearLimit: percentUsed >= QUOTA_WARNING_THRESHOLD,
  };
}

/** Recognizes IndexedDB/localStorage quota errors across browsers. */
export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    if (typeof error !== "object" || error === null) return false;
    const code = (error as { code?: unknown }).code;
    const name = (error as { name?: unknown }).name;
    return (
      name === "QuotaExceededError" ||
      name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      code === 22
    );
  }
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22
  );
}
