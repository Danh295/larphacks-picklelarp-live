// LIVE-phase help logic. Pure: time is passed in, no DOM (main.js owns the card element and the hint).
// - the controls card is visible while LIVE, and `?` hides / restores it
// - `nudge` is a one-shot true after `nudgeAfterMs` in LIVE with no swing (reset by each swing and by
//   re-entering LIVE), repeating at most once per `nudgeEveryMs`
export function createLiveHelp({ nudgeAfterMs = 8000, nudgeEveryMs = 20000 } = {}) {
  let liveSince = null, lastSwing = null, lastNudge = null, hidden = false;
  return {
    toggle() { hidden = !hidden; },
    swung(tMs) { lastSwing = tMs; },
    update({ phase, tMs }) {
      if (phase !== 'LIVE') { liveSince = null; lastSwing = null; lastNudge = null; return { showCard: false, nudge: false }; }
      if (liveSince == null) { liveSince = tMs; lastNudge = null; }
      const ref = Math.max(liveSince, lastSwing ?? -Infinity);
      let nudge = false;
      if (tMs - ref >= nudgeAfterMs && (lastNudge == null || tMs - lastNudge >= nudgeEveryMs)) {
        nudge = true; lastNudge = tMs;
      }
      return { showCard: !hidden, nudge };
    }
  };
}

export const NUDGE_TEXT = 'Try it: arm out wide to the side, then whip it across your body';
