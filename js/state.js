const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export const DAILY_HOUR_THRESHOLD = 6;
export const LIGHT_DAY_THRESHOLD = 3;

export function sumHours(tasks) {
  return tasks.reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0);
}

export function formatHours(h) {
  if (!h) return '';
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(2).replace(/\.?0+$/, '')}h`;
}

// Tasks the user could pull forward to today: due in the future, not locked to date,
// and within the next ~14 days (further-out stuff is too speculative to suggest).
export function getFlexibleSuggestions(tasks, maxDays = 14, max = 3) {
  const today = new Date().toISOString().split('T')[0];
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + maxDays);
  const horizonStr = horizon.toISOString().split('T')[0];

  return [...tasks]
    .filter(t =>
      t.due_date &&
      t.due_date > today &&
      t.due_date <= horizonStr &&
      !t.lock_to_date
    )
    .sort((a, b) => {
      // Soonest deadlines first, then highest priority.
      const dateCompare = a.due_date.localeCompare(b.due_date);
      if (dateCompare !== 0) return dateCompare;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    })
    .slice(0, max);
}

export function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function getTodayTasks(tasks) {
  const today = todayStr();
  return sortByPriority(tasks.filter(t => t.due_date && t.due_date <= today));
}

export function getTodayHours(data, isDueTodayFn) {
  const todayTasks = getTodayTasks(data.tasks);
  const recurringToday = (data.recurring || []).filter(isDueTodayFn);
  return sumHours([...todayTasks, ...recurringToday]);
}

export function getComingUpTasks(tasks) {
  const today = todayStr();
  const limit = daysFromNow(7);
  return [...tasks]
    .filter(t => t.due_date && t.due_date > today && t.due_date <= limit)
    .sort((a, b) => {
      const dateCompare = a.due_date.localeCompare(b.due_date);
      if (dateCompare !== 0) return dateCompare;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
}

export function getEverythingElse(tasks) {
  const limit = daysFromNow(7);
  return sortByPriority(tasks.filter(t => !t.due_date || t.due_date > limit));
}
