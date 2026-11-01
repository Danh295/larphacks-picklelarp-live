import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSwingDebug } from '../src/ui/swing-debug.js';
import { createSwing, SWING_TUNE } from '../src/cv/swing.js';

test('the panel text shows the reason, the numbers and the thresholds', () => {
  const d = { state: 'IDLE', side: 'r', fired: 2, speed: 1.2, disp: 0.31, elbow: 95, vis: 0.83, reason: 'peak too slow (2.1 < 3.5)' };
  const t = formatSwingDebug(d, SWING_TUNE, 'LIVE');
  assert.match(t, /peak too slow/);
  assert.match(t, /fired: 2/);
  assert.match(t, /need 3\.5/);
  assert.match(t, /95 deg/);
  assert.match(t, /setup: LIVE/);
});

test('the panel never throws on a fresh detector (no NaN, no nulls)', () => {
  const det = createSwing();
  const t = formatSwingDebug(det.debug, SWING_TUNE, 'WAITING');
  assert.ok(t.includes('waiting'));
  assert.ok(!t.includes('NaN'));
});
