const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

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
