

// ── Window Helpers ────────────────────────────────────────────────────────────

/**
 * Weekly window: Saturday 17:00 UTC → Sunday 17:00 UTC
 * Returns the current open window if we're inside one,
 * otherwise returns the next upcoming window.
 */
export function getWeeklyClaimWindow(now: Date): { unlocksAt: Date; expiresAt: Date } {
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat

  // Days elapsed since the most recent Saturday
  // Sun(0)→1, Mon(1)→2, Tue(2)→3, Wed(3)→4, Thu(4)→5, Fri(5)→6, Sat(6)→0
  const daysToLastSat = (day + 1) % 7;

  const lastSat17 = new Date(now);
  lastSat17.setUTCDate(now.getUTCDate() - daysToLastSat);
  lastSat17.setUTCHours(17, 0, 0, 0);

  const lastSun17 = new Date(lastSat17.getTime() + 24 * 60 * 60 * 1000);

  // Are we currently inside the window?
  if (now >= lastSat17 && now < lastSun17) {
    return { unlocksAt: lastSat17, expiresAt: lastSun17 };
  }

  // Not in window — compute next Saturday 17:00 UTC
  const daysUntilNextSat = (6 - day + 7) % 7 || 7;
  const nextSat17 = new Date(now);
  nextSat17.setUTCDate(now.getUTCDate() + daysUntilNextSat);
  nextSat17.setUTCHours(17, 0, 0, 0);

  return {
    unlocksAt: nextSat17,
    expiresAt: new Date(nextSat17.getTime() + 24 * 60 * 60 * 1000),
  };
}

/**
 * Monthly window: 1st of month 17:00 UTC → 2nd of month 17:00 UTC (24 h)
 * Returns the current open window if we're inside one,
 * otherwise returns the next upcoming window.
 */
export function getMonthlyClaimWindow(now: Date): { unlocksAt: Date; expiresAt: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  const thisOpen  = new Date(Date.UTC(y, m,     1, 17, 0, 0, 0));
  const thisClose = new Date(Date.UTC(y, m,     2, 17, 0, 0, 0));

  if (now >= thisOpen && now < thisClose) {
    return { unlocksAt: thisOpen, expiresAt: thisClose };
  }

  const nextOpen  = new Date(Date.UTC(y, m + 1, 1, 17, 0, 0, 0));
  const nextClose = new Date(Date.UTC(y, m + 1, 2, 17, 0, 0, 0));

  return { unlocksAt: nextOpen, expiresAt: nextClose };
}
