function baseMessage(error: unknown, fallback: string): string {
  return (
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback
  ).trim();
}

/** User-facing copy for Account Kit auth modal failures (OTP, social, passkey). */
export function formatAccountKitAuthError(error: unknown): string {
  const msg = baseMessage(error, "Sign-in failed. Please try again.");
  const lower = msg.toLowerCase();

  if (
    lower.includes("popup") ||
    lower.includes("blocked") ||
    lower.includes("closed")
  ) {
    return "Sign-in popup was blocked or closed. Allow popups for this site and try again.";
  }
  if (lower.includes("otp") && (lower.includes("expired") || lower.includes("invalid"))) {
    return "That verification code expired or is invalid. Request a new code and try again.";
  }
  if (lower.includes("passkey") && lower.includes("cancel")) {
    return "Passkey sign-in was cancelled. Try again or use email instead.";
  }
  if (
    lower.includes("invalid origin") ||
    (lower.includes("origin") && lower.includes("passkey"))
  ) {
    return "This passkey was created on another site (e.g. production). On localhost, sign in with email instead, or create a new passkey here.";
  }
  if (lower.includes("turnkey") || lower.includes("iframe")) {
    return "Wallet sign-in could not initialize. Refresh the page and try again.";
  }
  if (lower.includes("api key") || lower.includes("unauthorized")) {
    return "Wallet service is misconfigured. Please contact support.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Network error during sign-in. Check your connection and try again.";
  }
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Sign-in was cancelled. Try again when you are ready.";
  }

  return msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;
}
