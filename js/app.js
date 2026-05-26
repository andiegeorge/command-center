import { getConfig, setConfig } from './api.js';
import * as store from './store.js';
import { wasMissed, getLastScheduledDate, isDueToday } from './recurring.js';
import { getTodayHours } from './state.js';
import {
  renderTodayZone,
  renderComingUpZone,
  renderEverythingElse,
  renderMoodTrend,
  renderHistoryWeek,
  renderReflectionCard,
  renderLightDayBanner
} from './render.js';

// ── State ───────────────────────────────────────────────
let appReady = false;
let currentWeekStart = getMondayStr(new Date());
let selectedMood = null;

function getMondayStr(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(weekStart) {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(weekStart + 'T00:00:00');
  end.setDate(end.getDate() + 6);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

// ── Rendering ───────────────────────────────────────────
function renderAll() {
  const data = store.getData();
  const handlers = {
    onComplete: async (id, isRecurring = false) => {
      if (isRecurring) {
        await store.completeRecurring(id);
      } else {
        await store.completeTask(id);
      }
      renderAll();
    },
    onDelete: async (id) => {
      await store.deleteTask(id);
      renderAll();
    },
    onToggleCritical: async (id) => {
      await store.toggleCritical(id);
      renderAll();
    }
  };
  renderTodayZone(data, handlers);
  renderComingUpZone(data, handlers);
  renderEverythingElse(data, handlers);

  const todayHours = getTodayHours(data, isDueToday);
  renderLightDayBanner(data, todayHours, {
    onPull: async (id) => {
      await store.pullTaskToToday(id);
      renderAll();
    }
  });

  loadRecapIntoForm();
}

function loadRecapIntoForm() {
  const today = new Date().toISOString().split('T')[0];
  const existing = store.getRecap(today);
  document.getElementById('recap-text').value = existing?.text || '';
  document.getElementById('recap-saved').classList.add('hidden');
}

function renderHistory() {
  const data = store.getData();
  document.getElementById('week-label').textContent = formatWeekLabel(currentWeekStart);
  renderHistoryWeek(data, currentWeekStart);
  renderReflectionCard(store.getReflection(currentWeekStart));
  renderMoodTrend(data.reflections);

  // Restore selected mood from saved reflection
  const reflection = store.getReflection(currentWeekStart);
  selectedMood = reflection?.mood || null;
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mood === selectedMood);
  });
}

// ── Init ────────────────────────────────────────────────
async function init() {
  if (!getConfig()) {
    document.getElementById('setup-modal').classList.remove('hidden');
    return;
  }

  document.getElementById('today-loading').classList.remove('hidden');
  document.getElementById('today-error').classList.add('hidden');

  try {
    await store.load();
  } catch (err) {
    document.getElementById('today-loading').classList.add('hidden');
    const errEl = document.getElementById('today-error');
    errEl.textContent = `Failed to load tasks: ${err.message}`;
    errEl.classList.remove('hidden');
    return;
  }

  document.getElementById('today-loading').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Check recurring missed counts on load
  await checkRecurringMisses();

  appReady = true;
  renderAll();
  renderHistory();
}

async function checkRecurringMisses() {
  const data = store.getData();
  for (const rec of (data.recurring || [])) {
    if (!wasMissed(rec)) continue;
    const lastScheduled = getLastScheduledDate(rec);
    if (!lastScheduled) continue;
    const lastScheduledStr = lastScheduled.toISOString().split('T')[0];
    // Only increment if we haven't already recorded this specific missed window
    if (rec.last_missed_at === lastScheduledStr) continue;
    await store.incrementMissedCount(rec.id, lastScheduledStr);
  }
}

// ── Tab Switching ────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (!appReady) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('tab-today').classList.toggle('hidden', target !== 'today');
    document.getElementById('tab-history').classList.toggle('hidden', target !== 'history');
    if (target === 'history') renderHistory();
  });
});

// ── Brain Dump Bar ───────────────────────────────────────
const dumpInput = document.getElementById('brain-dump-input');
const dumpOptions = document.getElementById('brain-dump-options');

dumpInput.addEventListener('input', () => {
  if (!appReady) return;
  dumpOptions.classList.toggle('hidden', dumpInput.value.trim() === '');
});

dumpInput.addEventListener('keydown', async (e) => {
  if (!appReady) return;
  if (e.key === 'Enter' && dumpInput.value.trim()) {
    await quickAdd();
  }
  if (e.key === 'Escape') {
    dumpInput.value = '';
    dumpOptions.classList.add('hidden');
  }
});

document.getElementById('opt-save').addEventListener('click', async () => {
  if (!appReady) return;
  if (dumpInput.value.trim()) await quickAdd();
});

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function nextFridayISO() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  // If today is Fri, use today; else advance to upcoming Fri (5).
  const diff = (5 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Parse natural-language deadline keywords in a task title.
// Returns the resolved YYYY-MM-DD if a keyword is found, otherwise null.
function resolveTitleKeyword(title) {
  const t = title.toLowerCase();
  if (/\beow\b/.test(t)) return nextFridayISO();
  if (/\beod\b/.test(t)) return todayISO();
  if (/\btomorrow\b/.test(t)) return tomorrowISO();
  return null;
}

async function quickAdd() {
  const title = dumpInput.value.trim();
  if (!title) return;
  const explicitDue = document.getElementById('opt-due').value;
  const due_date = explicitDue || resolveTitleKeyword(title) || null;
  const estimateRaw = document.getElementById('opt-estimate').value;
  const estimated_hours = estimateRaw ? parseFloat(estimateRaw) : null;
  await store.addTask({
    title,
    priority: document.getElementById('opt-priority').value,
    due_date,
    category: document.getElementById('opt-category').value.trim() || null,
    estimated_hours,
    critical: document.getElementById('opt-critical').checked,
    lock_to_date: document.getElementById('opt-lock').checked
  });
  dumpInput.value = '';
  document.getElementById('opt-due').value = '';
  document.getElementById('opt-priority').value = 'medium';
  document.getElementById('opt-category').value = '';
  document.getElementById('opt-estimate').value = '';
  document.getElementById('opt-critical').checked = false;
  document.getElementById('opt-lock').checked = false;
  dumpOptions.classList.add('hidden');
  renderAll();
}

// EOW shortcut button — fill the date picker with upcoming Friday.
document.getElementById('opt-eow').addEventListener('click', () => {
  document.getElementById('opt-due').value = nextFridayISO();
});

// Daily recap save
document.getElementById('recap-save').addEventListener('click', async () => {
  if (!appReady) return;
  const text = document.getElementById('recap-text').value.trim();
  if (!text) return;
  const today = new Date().toISOString().split('T')[0];
  await store.saveRecap(today, text);
  const savedEl = document.getElementById('recap-saved');
  savedEl.classList.remove('hidden');
  setTimeout(() => savedEl.classList.add('hidden'), 2000);
});

// ── Everything Else Toggle ───────────────────────────────
document.getElementById('everything-else-toggle').addEventListener('click', () => {
  if (!appReady) return;
  const list = document.getElementById('everything-else-list');
  const icon = document.querySelector('#everything-else-toggle .toggle-icon');
  list.classList.toggle('collapsed');
  icon.classList.toggle('open', !list.classList.contains('collapsed'));
});

// ── History Week Navigation ──────────────────────────────
document.getElementById('week-prev').addEventListener('click', () => {
  if (!appReady) return;
  const d = new Date(currentWeekStart + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  currentWeekStart = d.toISOString().split('T')[0];
  renderHistory();
});

document.getElementById('week-next').addEventListener('click', () => {
  if (!appReady) return;
  const d = new Date(currentWeekStart + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  currentWeekStart = d.toISOString().split('T')[0];
  renderHistory();
});

// ── Mood Selector ────────────────────────────────────────
document.getElementById('mood-selector').addEventListener('click', (e) => {
  if (!appReady) return;
  const btn = e.target.closest('.mood-btn');
  if (!btn) return;
  selectedMood = btn.dataset.mood;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('selected', b === btn));
});

// ── Reflection Save ──────────────────────────────────────
document.getElementById('reflection-save').addEventListener('click', async () => {
  if (!appReady) return;
  const text = document.getElementById('reflection-text').value.trim();
  if (!selectedMood && !text) return;
  await store.saveReflection({ week_start: currentWeekStart, text, mood: selectedMood });
  const savedEl = document.getElementById('reflection-saved');
  savedEl.classList.remove('hidden');
  setTimeout(() => savedEl.classList.add('hidden'), 2000);
  renderMoodTrend(store.getData().reflections);
});

// ── Setup Modal ──────────────────────────────────────────
document.getElementById('setup-save').addEventListener('click', async () => {
  const owner = document.getElementById('setup-owner').value.trim();
  const repo = document.getElementById('setup-repo').value.trim();
  const token = document.getElementById('setup-token').value.trim();
  const errEl = document.getElementById('setup-error');

  if (!owner || !repo || !token) {
    errEl.textContent = 'All fields are required.';
    errEl.classList.remove('hidden');
    return;
  }

  setConfig(owner, repo, token);

  document.getElementById('today-loading').classList.remove('hidden');
  try {
    await store.load();
    document.getElementById('today-loading').classList.add('hidden');
    document.getElementById('setup-modal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    await checkRecurringMisses();
    appReady = true;
    renderAll();
    renderHistory();
  } catch (err) {
    document.getElementById('today-loading').classList.add('hidden');
    errEl.textContent = `Could not connect: ${err.message}. Check your credentials.`;
    errEl.classList.remove('hidden');
  }
});

// ── Settings (re-open setup modal) ──────────────────────
document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('setup-modal').classList.remove('hidden');
});

// ── Boot ─────────────────────────────────────────────────
init();
