// An injectable clock. Production reads the real time, but a test or a demo can
// pin "now" to a fixed instant so the Thanksgiving Rule release can be exercised
// deterministically. Only the time source is injectable, never the rule logic.

let override: Date | null = null;

export function now(): Date {
  return override ? new Date(override) : new Date();
}

export function setClock(iso: string | null): void {
  override = iso ? new Date(iso) : null;
}

export function isPinned(): boolean {
  return override != null;
}
