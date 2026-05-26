import { getTodayTasks, getComingUpTasks, getEverythingElse } from './state.js';
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

export function makeTaskCard({ task, onComplete, onDelete, isOverdue = false, isMissed = false, missedCount = 0, deletable = true }) {
  const li = document.createElement('li');
  li.className = 'task-card' + (isOverdue ? ' overdue' : '');
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

  body.appendChild(title);
  if (meta.children.length) body.appendChild(meta);

  if (deletable) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', () => onDelete(task.id));
    li.appendChild(checkbox);
    li.appendChild(body);
    li.appendChild(deleteBtn);
  } else {
    li.appendChild(checkbox);
    li.appendChild(body);
  }
  return li;
}

export function renderTodayZone(data, { onComplete, onDelete }) {
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

  count.textContent = allToday.length > 0 ? `${allToday.length} task${allToday.length > 1 ? 's' : ''}` : '';
  empty.classList.toggle('hidden', allToday.length > 0);

  allToday.forEach(task => {
    const isOverdue = task.due_date && task.due_date < today;
    const isMissed = task._isRecurring && task.missed_count >= 2;
    list.appendChild(makeTaskCard({
      task,
      onComplete: task._isRecurring ? (id) => onComplete(id, true) : onComplete,
      onDelete,
      isOverdue,
      isMissed,
      missedCount: task.missed_count || 0,
      deletable: !task._isRecurring
    }));
  });
}

export function renderComingUpZone(data, { onComplete, onDelete }) {
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

  Object.entries(byDate).forEach(([date, tasks]) => {
    const dayEl = document.createElement('div');
    dayEl.className = 'coming-up-day';

    const d = new Date(date + 'T00:00:00');
    const label = document.createElement('div');
    label.className = 'coming-up-day-label';
    label.textContent = `${DAY_NAMES[d.getDay()]} · ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    dayEl.appendChild(label);

    const ul = document.createElement('ul');
    ul.className = 'task-list';
    tasks.forEach(task => {
      ul.appendChild(makeTaskCard({
        task,
        onComplete: task._isRecurring ? (id) => onComplete(id, true) : onComplete,
        onDelete,
        deletable: !task._isRecurring
      }));
    });
    dayEl.appendChild(ul);
    container.appendChild(dayEl);
  });
}

export function renderEverythingElse(data, { onComplete, onDelete }) {
  const list = document.getElementById('everything-else-list');
  list.innerHTML = '';
  const tasks = getEverythingElse(data.tasks);
  tasks.forEach(task => list.appendChild(makeTaskCard({ task, onComplete, onDelete })));
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
  const completed = data.completed.filter(t => {
    if (!t.completed_at) return false;
    const d = t.completed_at.split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= weekStart && d < weekEnd.toISOString().split('T')[0] && !t.is_recurring;
  });

  const container = document.getElementById('completed-list');
  const empty = document.getElementById('completed-empty');
  container.innerHTML = '';

  empty.classList.toggle('hidden', completed.length > 0);
  if (!completed.length) return;

  const byDate = {};
  completed.forEach(t => {
    const d = t.completed_at.split('T')[0];
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(t);
  });

  Object.entries(byDate).sort().forEach(([date, tasks]) => {
    const dayEl = document.createElement('div');
    dayEl.className = 'completed-day';

    const d = new Date(date + 'T00:00:00');
    const label = document.createElement('div');
    label.className = 'completed-day-label';
    label.textContent = `${DAY_NAMES[d.getDay()]} · ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    dayEl.appendChild(label);

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
