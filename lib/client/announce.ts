/** Announces a message to screen readers via the polite live region in the root layout. */
export function announce(message: string): void {
  if (typeof document === "undefined") return;
  const region = document.getElementById("status");
  if (!region) return;
  region.textContent = "";
  // A second tick makes screen readers re-announce identical consecutive messages.
  setTimeout(() => {
    region.textContent = message;
  }, 50);
}
