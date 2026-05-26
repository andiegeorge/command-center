// tests/state.test.js
import {
  getTodayTasks,
  getComingUpTasks,
  getEverythingElse,
  sortByPriority
} from '../js/state.js';

function makeTask(overrides = {}) {
  return {
    id: 'test-id',
    title: 'Test task',
    priority: 'medium',
    due_date: null,
    category: null,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

test('getTodayTasks returns tasks due today', () => {
  const tasks = [
    makeTask({ id: '1', due_date: today() }),
    makeTask({ id: '2', due_date: daysFromNow(3) }),
    makeTask({ id: '3', due_date: null })
  ];
  const result = getTodayTasks(tasks);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('1');
});

test('getTodayTasks includes overdue tasks', () => {
  const tasks = [
    makeTask({ id: '1', due_date: daysFromNow(-2) }),
    makeTask({ id: '2', due_date: today() })
  ];
  const result = getTodayTasks(tasks);
  expect(result).toHaveLength(2);
});

test('getTodayTasks sorts by priority: high before medium before low', () => {
  const tasks = [
    makeTask({ id: '1', due_date: today(), priority: 'low' }),
    makeTask({ id: '2', due_date: today(), priority: 'high' }),
    makeTask({ id: '3', due_date: today(), priority: 'medium' })
  ];
  const result = getTodayTasks(tasks);
  expect(result.map(t => t.priority)).toEqual(['high', 'medium', 'low']);
});

test('getComingUpTasks returns tasks due in next 7 days (not today)', () => {
  const tasks = [
    makeTask({ id: '1', due_date: today() }),
    makeTask({ id: '2', due_date: daysFromNow(3) }),
    makeTask({ id: '3', due_date: daysFromNow(8) }),
    makeTask({ id: '4', due_date: null })
  ];
  const result = getComingUpTasks(tasks);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('2');
});

test('getComingUpTasks sorts by due_date ascending then priority', () => {
  const tasks = [
    makeTask({ id: '1', due_date: daysFromNow(5), priority: 'low' }),
    makeTask({ id: '2', due_date: daysFromNow(2), priority: 'medium' }),
    makeTask({ id: '3', due_date: daysFromNow(2), priority: 'high' })
  ];
  const result = getComingUpTasks(tasks);
  expect(result.map(t => t.id)).toEqual(['3', '2', '1']);
});

test('getEverythingElse returns tasks with no due date or due > 7 days', () => {
  const tasks = [
    makeTask({ id: '1', due_date: null }),
    makeTask({ id: '2', due_date: daysFromNow(3) }),
    makeTask({ id: '3', due_date: daysFromNow(10) })
  ];
  const result = getEverythingElse(tasks);
  expect(result.map(t => t.id).sort()).toEqual(['1', '3']);
});

test('sortByPriority orders high → medium → low', () => {
  const tasks = [
    makeTask({ id: '1', priority: 'low' }),
    makeTask({ id: '2', priority: 'high' }),
    makeTask({ id: '3', priority: 'medium' })
  ];
  const result = sortByPriority(tasks);
  expect(result.map(t => t.priority)).toEqual(['high', 'medium', 'low']);
});
