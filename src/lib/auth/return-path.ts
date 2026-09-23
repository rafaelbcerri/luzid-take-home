/** Prevents an auth redirect from leaving this app. */
export function safeReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || /[\r\n\t]/.test(value)) return "/";
  return value;
}
