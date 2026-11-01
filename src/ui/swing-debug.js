// D-key panel: shows WHY the swing detector did or did not fire. Pure formatter, main.js owns the element.
const bar = (v, need, width = 14) => {
  const filled = Math.max(0, Math.min(width, Math.round((v / (need * 1.5)) * width)));
  const mark = Math.min(width - 1, Math.round(width / 1.5));
  return Array.from({ length: width }, (_, i) => (i === mark ? '|' : i < filled ? '#' : '.')).join('');
};

export function formatSwingDebug(d, tune, phase) {
  const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : '-');
  return [
    `SWING DETECTOR   setup: ${phase}`,
    `state: ${d.state}   hand: ${d.side}   fired: ${d.fired}`,
    `speed ${f1(d.speed).padStart(4)}  ${bar(d.speed, tune.V_PEAK)}  need ${tune.V_PEAK}  ( | = need )`,
    `travel ${Number.isFinite(d.disp) ? d.disp.toFixed(2) : '-'}  need ${tune.MIN_DISP} torso lengths`,
    `elbow ${d.elbow == null ? '-' : Math.round(d.elbow) + ' deg'}  min ${tune.ELBOW_MIN}`,
    `wrist visibility ${f1(d.vis * 10) === '-' ? '-' : d.vis.toFixed(2)}  min ${tune.MIN_VIS}`,
    `last: ${d.reason}`,
    `tune in console: PLARP_SWING.V_PEAK, MIN_DISP, ELBOW_MIN`
  ].join('\n');
}
