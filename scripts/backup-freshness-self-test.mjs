import assert from 'node:assert/strict';import {evaluateBackupFreshness,normalizeBackupMaxAgeHours} from '../lib/backup-freshness.ts';
const now=new Date('2026-09-09T18:00:00Z');
assert.equal(normalizeBackupMaxAgeHours(undefined),36);assert.equal(normalizeBackupMaxAgeHours(24),24);assert.equal(normalizeBackupMaxAgeHours(720),720);assert.equal(normalizeBackupMaxAgeHours(10),36);
let r=evaluateBackupFreshness('2026-09-09T06:00:00Z',36,now);assert.equal(r.ok,true);assert.equal(r.state,'ok');assert.equal(r.age_hours,12);
r=evaluateBackupFreshness('2026-09-07T18:00:00Z',36,now);assert.equal(r.ok,false);assert.equal(r.state,'stale');
r=evaluateBackupFreshness(null,36,now);assert.equal(r.state,'missing');
r=evaluateBackupFreshness('not-a-date',36,now);assert.equal(r.state,'unavailable');
r=evaluateBackupFreshness('2026-09-10T01:00:00Z',36,now);assert.equal(r.age_hours,0);assert.equal(r.ok,true);
console.log('Backup Freshness Self-Test: OK');
