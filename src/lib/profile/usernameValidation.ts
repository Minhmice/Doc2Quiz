const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string") return "Username is required.";
  const normalized = normalizeUsername(username);
  if (normalized.length < 3 || normalized.length > 30) {
    return "Username must be 3–30 characters.";
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return "Username must use letters, numbers, or underscores.";
  }
  return null;
}
