const DAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
};

export function getLastScheduledDate(recurring) {
  const now = new Date();
  const { frequency, day_of_week, due_time } = recurring.recurrence;

  if (frequency === 'weekly') {
    const targetDay = DAY_INDEX[day_of_week];
    const daysPast = (now.getDay() - targetDay + 7) % 7;
    const result = new Date(now);
    result.setDate(now.getDate() - daysPast);
    if (due_time) {
      const [h, m] = due_time.split(':').map(Number);
      result.setHours(h, m, 0, 0);
    } else {
      result.setHours(23, 59, 0, 0);
    }
    return result;
  }

  if (frequency === 'daily') {
    const result = new Date(now);
    result.setDate(now.getDate() - 1);
    if (due_time) {
      const [h, m] = due_time.split(':').map(Number);
      result.setHours(h, m, 0, 0);
    }
    return result;
  }

  return null;
}

export function getNextDueDate(recurring) {
  const now = new Date();
  const { frequency, day_of_week, due_time } = recurring.recurrence;

  if (frequency === 'weekly') {
    const targetDay = DAY_INDEX[day_of_week];
    let daysUntil = (targetDay - now.getDay() + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    const result = new Date(now);
    result.setDate(now.getDate() + daysUntil);
    if (due_time) {
      const [h, m] = due_time.split(':').map(Number);
      result.setHours(h, m, 0, 0);
    } else {
      result.setHours(23, 59, 0, 0);
    }
    return result;
  }

  if (frequency === 'daily') {
    const result = new Date(now);
    result.setDate(now.getDate() + 1);
    if (due_time) {
      const [h, m] = due_time.split(':').map(Number);
      result.setHours(h, m, 0, 0);
    }
    return result;
  }

  return null;
}

export function wasMissed(recurring) {
  const lastScheduled = getLastScheduledDate(recurring);
  if (!lastScheduled) return false;
  const now = new Date();
  if (lastScheduled > now) return false;
  if (!recurring.last_completed_at) return true;
  return new Date(recurring.last_completed_at) < lastScheduled;
}

export function isDueToday(recurring) {
  const { frequency, day_of_week } = recurring.recurrence;
  if (frequency === 'weekly') {
    return new Date().getDay() === DAY_INDEX[day_of_week];
  }
  if (frequency === 'daily') return true;
  return false;
}

export function isDueWithinDays(recurring, days) {
  const { frequency, day_of_week } = recurring.recurrence;
  if (frequency === 'weekly') {
    const targetDay = DAY_INDEX[day_of_week];
    const daysUntil = (targetDay - new Date().getDay() + 7) % 7;
    return daysUntil > 0 && daysUntil < days;
  }
  if (frequency === 'daily') return true;
  return false;
}
