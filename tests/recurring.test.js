// tests/recurring.test.js
import {
  getLastScheduledDate,
  wasMissed,
  isDueToday,
  isDueWithinDays,
  getNextDueDate
} from '../js/recurring.js';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function makeRecurring(overrides = {}) {
  return {
    id: 'rec-1',
    title: 'Weekly task',
    priority: 'high',
    category: null,
    missed_count: 0,
    last_completed_at: null,
    recurrence: {
      frequency: 'weekly',
      day_of_week: 'monday',
      due_time: '09:00',
      timezone: 'America/Denver'
    },
    ...overrides
  };
}

test('isDueToday returns true when today matches day_of_week', () => {
  const today = DAY_NAMES[new Date().getDay()];
  const rec = makeRecurring({ recurrence: { frequency: 'weekly', day_of_week: today, due_time: '09:00', timezone: 'America/Denver' } });
  expect(isDueToday(rec)).toBe(true);
});

test('isDueToday returns false when today does not match day_of_week', () => {
  const todayIdx = new Date().getDay();
  const otherDay = DAY_NAMES[(todayIdx + 1) % 7];
  const rec = makeRecurring({ recurrence: { frequency: 'weekly', day_of_week: otherDay, due_time: '09:00', timezone: 'America/Denver' } });
  expect(isDueToday(rec)).toBe(false);
});

test('isDueWithinDays returns true for weekly task due in 3 days when asking for 7', () => {
  const todayIdx = new Date().getDay();
  const targetDay = DAY_NAMES[(todayIdx + 3) % 7];
  const rec = makeRecurring({ recurrence: { frequency: 'weekly', day_of_week: targetDay, due_time: '09:00', timezone: 'America/Denver' } });
  expect(isDueWithinDays(rec, 7)).toBe(true);
});

test('isDueWithinDays returns false for weekly task due in 5 days when asking for 3', () => {
  const todayIdx = new Date().getDay();
  const targetDay = DAY_NAMES[(todayIdx + 5) % 7];
  const rec = makeRecurring({ recurrence: { frequency: 'weekly', day_of_week: targetDay, due_time: '09:00', timezone: 'America/Denver' } });
  expect(isDueWithinDays(rec, 3)).toBe(false);
});

test('wasMissed returns true when last_completed_at is before last scheduled date', () => {
  const todayIdx = new Date().getDay();
  const todayName = DAY_NAMES[todayIdx];
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 8);
  const rec = makeRecurring({
    last_completed_at: lastWeek.toISOString(),
    recurrence: { frequency: 'weekly', day_of_week: todayName, due_time: '00:01', timezone: 'America/Denver' }
  });
  expect(wasMissed(rec)).toBe(true);
});

test('wasMissed returns false when completed today for a task due today', () => {
  const todayIdx = new Date().getDay();
  const todayName = DAY_NAMES[todayIdx];
  const completedRec = makeRecurring({
    last_completed_at: new Date().toISOString(),
    recurrence: { frequency: 'weekly', day_of_week: todayName, due_time: '00:01', timezone: 'America/Denver' }
  });
  expect(wasMissed(completedRec)).toBe(false);
});

test('getNextDueDate returns a future date', () => {
  const todayIdx = new Date().getDay();
  const tomorrow = DAY_NAMES[(todayIdx + 1) % 7];
  const rec = makeRecurring({
    recurrence: { frequency: 'weekly', day_of_week: tomorrow, due_time: '09:00', timezone: 'America/Denver' }
  });
  const next = getNextDueDate(rec);
  expect(next).toBeInstanceOf(Date);
  expect(next > new Date()).toBe(true);
});
