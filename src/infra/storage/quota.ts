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
