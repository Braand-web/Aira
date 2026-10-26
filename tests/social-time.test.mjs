import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,localDateTime,scheduleCandidates,scheduleTimestamp} from '../lib/social-time.mjs';
test('nonexistent local times are rejected at the spring clock change',()=>{assert.equal(scheduleCandidates('2026-03-29T02:30','Europe/Paris').length,0);assert.throws(()=>scheduleTimestamp('2026-03-29T02:30','Europe/Paris'));});
test('repeated autumn hours require an explicit occurrence',()=>{const options=scheduleCandidates('2026-10-25T02:30','Europe/Paris');assert.equal(options.length,2);assert.equal(options[1]-options[0],3600000);assert.throws(()=>scheduleTimestamp('2026-10-25T02:30','Europe/Paris'));assert.equal(scheduleTimestamp('2026-10-25T02:30','Europe/Paris','earlier'),options[0]);assert.equal(scheduleTimestamp('2026-10-25T02:30','Europe/Paris','later'),options[1]);});
test('African and quarter-hour timezones preserve the intended wall clock',()=>{for(const zone of ['Africa/Douala','Africa/Abidjan','Asia/Kathmandu']){const value=scheduleTimestamp('2026-11-02T14:15',zone);assert.equal(localDateTime(value,zone),'2026-11-02T14:15');}});
test('calendar is six bounded weeks beginning on Monday',()=>{const days=calendarDays(2026,9);assert.equal(days.length,42);assert.equal(new Date(days[0].key+'T12:00:00Z').getUTCDay(),1);assert.equal(new Set(days.map(day=>day.key)).size,42);});
