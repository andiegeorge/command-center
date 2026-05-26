import { getTodayTasks, getComingUpTasks, getEverythingElse, DAILY_HOUR_THRESHOLD, LIGHT_DAY_THRESHOLD, sumHours, formatHours, getFlexibleSuggestions } from './state.js';
import { isDueToday, isDueWithinDays } from './recurring.js';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function makeTaskCard({ task, onComplete, onDelete, onToggleCritical, isOverdue = false, isMissed = false, missedCount = 0, deletable = true }) {
  const li = document.createElement('li');
  li.className = 'task-card' + (isOverdue ? ' overdue' : '') + (task.critical ? ' critical' : '');
  li.dataset.id = task.id;
  li.dataset.priority = task.priority;

  if (isMissed && missedCount >= 2) {
    li.classList.add('missed-indicator');
    li.dataset.missed = `Missed ${missedCount} in a row`;
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.addEventListener('change', () => {
    li.classList.add('completing');
    setTimeout(() => onComplete(task.id), 300);
  });

  const body = document.createElement('div');
  body.className = 'task-body';

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  if (task.critical) {
    const crit = document.createElement('span');
    crit.className = 'task-critical-badge';
    crit.textContent = '!';
    crit.title = 'Critical';
    meta.appendChild(crit);
  }

  if (task.category) {
    const cat = document.createElement('span');
    cat.className = 'task-category';
    cat.textContent = task.category;
    meta.appendChild(cat);
  }

  if (task.due_date && task.due_date !== todayStr()) {
    const due = document.createElement('span');
    due.textContent = formatDate(task.due_date);
    meta.appendChild(due);
  }

  if (task.estimated_hours) {
    const est = document.createElement('span');
    est.className = 'task-estimate';
    est.textContent = formatHours(task.estimated_hours);
    meta.appendChild(est);
  }

  body.appendChild(title);
  if (meta.children.length) body.appendChild(meta);

  li.appendChild(checkbox);
  li.appendChild(body);

  if (deletable && onToggleCritical) {
    const critBtn = document.createElement('button');
    critBtn.className = 'critical-btn';
    critBtn.textContent = '!';
    critBtn.title = task.critical ? 'Unmark critical' : 'Mark critical';
    critBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggleCritical(task.id);
    });
    li.appendChild(critBtn);
  }

  if (deletable) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', () => onDelete(task.id));
    li.appendChild(deleteBtn);
  }

  return li;
}

export function renderTodayZone(data, { onComplete, onDelete, onToggleCritical }) {
  const list = document.getElementById('today-list');
  const empty = document.getElementById('today-empty');
  const count = document.getElementById('today-count');
  const dateEl = document.getElementById('today-date');
  list.innerHTML = '';

  const now = new Date();
  dateEl.textContent = `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;

  const today = todayStr();
  const todayTasks = getTodayTasks(data.tasks);

  // Add recurring tasks due today
  const recurringToday = (data.recurring || [])
    .filter(r => isDueToday(r))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const allToday = [...todayTasks, ...recurringToday.map(r => ({
    ...r,
    _isRecurring: true,
    due_date: today
  }))];

  const totalHours = sumHours(allToday);
  const taskLabel = allToday.length > 0 ? `${allToday.length} task${allToday.length > 1 ? 's' : ''}` : '';
  const hoursLabel = totalHours > 0 ? ` · ${formatHours(totalHours)}` : '';
  count.textContent = taskLabel + hoursLabel;
  count.classList.toggle('over-threshold', totalHours > DAILY_HOUR_THRESHOLD);
  count.title = totalHours > DAILY_HOUR_THRESHOLD
    ? `Over ${DAILY_HOUR_THRESHOLD}h — consider rescheduling something`
    : '';
  empty.classList.toggle('hidden', allToday.length > 0);

  allToday.forEach(task => {
    const isOverdue = task.due_date && task.due_date < today;
    const isMissed = task._isRecurring && task.missed_count >= 2;
    list.appendChild(makeTaskCard({
      task,
      onComplete: task._isRecurring ? (id) => onComplete(id, true) : onComplete,
      onDelete,
      onToggleCritical: task._isRecurring ? null : onToggleCritical,
      isOverdue,
      isMissed,
      missedCount: task.missed_count || 0,
      deletable: !task._isRecurring
    }));
  });
}

export function renderComingUpZone(data, { onComplete, onDelete, onToggleCritical }) {
  const container = document.getElementById('coming-up-list');
  const empty = document.getElementById('coming-up-empty');
  container.innerHTML = '';

  const comingUp = getComingUpTasks(data.tasks);

  // Add recurring tasks due within 7 days (but not today)
  const recurringUpcoming = (data.recurring || [])
    .filter(r => isDueWithinDays(r, 7))
    .map(r => {
      const targetDay = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
        .indexOf(r.recurrence.day_of_week);
      const daysUntil = (targetDay - new Date().getDay() + 7) % 7;
      const due = new Date();
      due.setDate(due.getDate() + daysUntil);
      return { ...r, _isRecurring: true, due_date: due.toISOString().split('T')[0] };
    });

  const all = [...comingUp, ...recurringUpcoming]
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  empty.classList.toggle('hidden', all.length > 0);
  if (!all.length) return;

  // Group by date
  const byDate = {};
  all.forEach(t => {
    if (!byDate[t.due_date]) byDate[t.due_date] = [];
    byDate[t.due_date].push(t);
  });

  // First date is expanded by default; rest are collapsed.
  const sortedDates = Object.keys(byDate).sort();
  sortedDates.forEach((date, idx) => {
    const tasks = byDate[date];
    const dayEl = document.createElement('div');
    dayEl.className = 'coming-up-day' + (idx === 0 ? '' : ' collapsed');

    const d = new Date(date + 'T00:00:00');
    const label = document.createElement('div');
    label.className = 'coming-up-day-label';

    const caret = document.createElement('span');
    caret.className = 'coming-up-day-caret';
    caret.textContent = '▼';
    label.appendChild(caret);

    const labelText = document.createElement('span');
    labelText.textContent = `${DAY_NAMES[d.getDay()]} · ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    label.appendChild(labelText);

    const dayHours = sumHours(tasks);
    if (dayHours > 0) {
      const hoursEl = document.createElement('span');
      hoursEl.className = 'coming-up-day-hours';
      hoursEl.textContent = formatHours(dayHours);
      if (dayHours > DAILY_HOUR_THRESHOLD) {
        hoursEl.classList.add('over-threshold');
        hoursEl.title = `Over ${DAILY_HOUR_THRESHOLD}h — consider rescheduling`;
      }
      label.appendChild(hoursEl);
    }

    label.addEventListener('click', () => dayEl.classList.toggle('collapsed'));
    dayEl.appendChild(label);

    const ul = document.createElement('ul');
    ul.className = 'task-list';
    tasks.forEach(task => {
      ul.appendChild(makeTaskCard({
        task,
        onComplete: task._isRecurring ? (id) => onComplete(id, true) : onComplete,
        onDelete,
        onToggleCritical: task._isRecurring ? null : onToggleCritical,
        deletable: !task._isRecurring
      }));
    });
    dayEl.appendChild(ul);
    container.appendChild(dayEl);
  });
}

export function renderEverythingElse(data, { onComplete, onDelete, onToggleCritical }) {
  const list = document.getElementById('everything-else-list');
  list.innerHTML = '';
  const tasks = getEverythingElse(data.tasks);
  tasks.forEach(task => list.appendChild(makeTaskCard({ task, onComplete, onDelete, onToggleCritical })));
}

export function renderLightDayBanner(data, todayTotalHours, { onPull }) {
  const banner = document.getElementById('light-day-banner');
  const header = document.getElementById('light-day-header');
  const suggestions = document.getElementById('light-day-suggestions');

  // Skip if today is already meaningfully loaded.
  if (todayTotalHours >= LIGHT_DAY_THRESHOLD) {
    banner.classList.add('hidden');
    return;
  }

  const flex = getFlexibleSuggestions(data.tasks);
  if (flex.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  const free = LIGHT_DAY_THRESHOLD - todayTotalHours;
  header.textContent = `Light day — roughly ${formatHours(free)} of headroom. Pull something forward?`;
  suggestions.innerHTML = '';

  flex.forEach(task => {
    const row = document.createElement('div');
    row.className = 'light-day-suggestion';

    const titleEl = document.createElement('span');
    titleEl.textContent = task.title;
    row.appendChild(titleEl);

    const metaEl = document.createElement('span');
    metaEl.className = 'light-day-suggestion-meta';
    const parts = [];
    if (task.estimated_hours) parts.push(formatHours(task.estimated_hours));
    parts.push(`due ${formatDate(task.due_date)}`);
    metaEl.textContent = parts.join(' · ');
    row.appendChild(metaEl);

    const pullBtn = document.createElement('button');
    pullBtn.className = 'pull-btn';
    pullBtn.textContent = 'Pull to today';
    pullBtn.addEventListener('click', () => onPull(task.id));
    row.appendChild(pullBtn);

    suggestions.appendChild(row);
  });

  banner.classList.remove('hidden');
}

export function renderMoodTrend(reflections) {
  const container = document.getElementById('mood-trend');
  container.innerHTML = '';

  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1) - i * 7);
    weeks.push(monday.toISOString().split('T')[0]);
  }

  weeks.forEach(weekStart => {
    const reflection = reflections.find(r => r.week_start === weekStart);
    const d = new Date(weekStart + 'T00:00:00');
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

    const weekEl = document.createElement('div');
    weekEl.className = 'trend-week';

    const labelEl = document.createElement('span');
    labelEl.className = 'trend-week-label';
    labelEl.textContent = label;

    const chip = document.createElement('span');
    chip.className = 'trend-chip' + (reflection ? '' : ' no-data');
    chip.dataset.mood = reflection?.mood || '';
    chip.textContent = reflection?.mood || '–';

    weekEl.appendChild(chip);
    weekEl.appendChild(labelEl);
    container.appendChild(weekEl);
  });
}

export function renderHistoryWeek(data, weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const completed = data.completed.filter(t => {
    if (!t.completed_at) return false;
    const d = t.completed_at.split('T')[0];
    return d >= weekStart && d < weekEndStr && !t.is_recurring;
  });

  const recapsForWeek = (data.recaps || []).filter(r => r.date >= weekStart && r.date < weekEndStr);

  const container = document.getElementById('completed-list');
  const empty = document.getElementById('completed-empty');
  container.innerHTML = '';

  const hasContent = completed.length > 0 || recapsForWeek.length > 0;
  empty.classList.toggle('hidden', hasContent);
  if (!hasContent) return;

  const byDate = {};
  completed.forEach(t => {
    const d = t.completed_at.split('T')[0];
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(t);
  });
  // Ensure days with only a recap (no completed tasks) still show up.
  recapsForWeek.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
  });

  const recapByDate = Object.fromEntries(recapsForWeek.map(r => [r.date, r]));

  Object.entries(byDate).sort().forEach(([date, tasks]) => {
    const dayEl = document.createElement('div');
    dayEl.className = 'completed-day';

    const d = new Date(date + 'T00:00:00');
    const label = document.createElement('div');
    label.className = 'completed-day-label';
    label.textContent = `${DAY_NAMES[d.getDay()]} · ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    dayEl.appendChild(label);

    const recap = recapByDate[date];
    if (recap) {
      const recapEl = document.createElement('div');
      recapEl.className = 'recap-in-history';
      recapEl.textContent = recap.text;
      dayEl.appendChild(recapEl);
    }

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'completed-card';

      const check = document.createElement('span');
      check.className = 'completed-check';
      check.textContent = '✓';

      const body = document.createElement('div');
      body.className = 'task-body';

      const titleEl = document.createElement('span');
      titleEl.className = 'task-title';
      titleEl.textContent = task.title;

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      if (task.category) {
        const cat = document.createElement('span');
        cat.className = 'task-category';
        cat.textContent = task.category;
        meta.appendChild(cat);
      }

      const priority = document.createElement('span');
      priority.textContent = task.priority;
      meta.appendChild(priority);

      body.appendChild(titleEl);
      body.appendChild(meta);
      card.appendChild(check);
      card.appendChild(body);
      dayEl.appendChild(card);
    });

    container.appendChild(dayEl);
  });
}

export function renderReflectionCard(reflection) {
  const textarea = document.getElementById('reflection-text');
  const saved = document.getElementById('reflection-saved');
  textarea.value = reflection?.text || '';
  saved.classList.add('hidden');

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mood === reflection?.mood);
  });
}
