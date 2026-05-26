import { fetchTasks, saveTasks } from './api.js';

let _data = null;
let _sha = null;

export async function load() {
  const result = await fetchTasks();
  _data = result.data;
  _sha = result.sha;
  return _data;
}

export function getData() {
  return _data;
}

async function persist() {
  _sha = await saveTasks(_data, _sha);
}

export async function addTask({ title, priority = 'medium', due_date = null, category = null }) {
  const task = {
    id: crypto.randomUUID(),
    title,
    priority,
    due_date,
    category,
    created_at: new Date().toISOString()
  };
  _data.tasks.push(task);
  await persist();
  return task;
}

export async function completeTask(id) {
  const idx = _data.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [task] = _data.tasks.splice(idx, 1);
  _data.completed.push({
    ...task,
    completed_at: new Date().toISOString(),
    is_recurring: false
  });
  await persist();
}

export async function deleteTask(id) {
  _data.tasks = _data.tasks.filter(t => t.id !== id);
  await persist();
}

export async function completeRecurring(id) {
  const rec = _data.recurring.find(r => r.id === id);
  if (!rec) return;
  rec.last_completed_at = new Date().toISOString();
  rec.missed_count = 0;
  await persist();
}

export async function incrementMissedCount(id, lastScheduledDateStr) {
  const rec = _data.recurring.find(r => r.id === id);
  if (!rec) return;
  rec.missed_count += 1;
  rec.last_missed_at = lastScheduledDateStr;
  await persist();
}

export async function saveReflection({ week_start, text, mood }) {
  const existing = _data.reflections.findIndex(r => r.week_start === week_start);
  const reflection = {
    week_start,
    text,
    mood,
    created_at: new Date().toISOString()
  };
  if (existing === -1) {
    _data.reflections.push(reflection);
  } else {
    _data.reflections[existing] = reflection;
  }
  await persist();
}

export function getReflection(week_start) {
  return _data.reflections.find(r => r.week_start === week_start) || null;
}

export function getCompletedForWeek(week_start) {
  const weekEnd = new Date(week_start);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const endStr = weekEnd.toISOString().split('T')[0];
  return _data.completed.filter(t => {
    const d = t.completed_at.split('T')[0];
    return d >= week_start && d < endStr && !t.is_recurring;
  });
}
