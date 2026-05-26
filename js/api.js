const CONFIG_KEY = 'cc_config';

export function getConfig() {
  const raw = localStorage.getItem(CONFIG_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setConfig(owner, repo, token) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ owner, repo, token }));
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

export async function fetchTasks() {
  const config = getConfig();
  if (!config) throw new Error('GitHub config is not set. Open settings to connect your repo.');
  const { owner, repo, token } = config;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/tasks.json`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  const raw = atob(data.content.replace(/\n/g, ''));
  const content = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(raw, c => c.charCodeAt(0))
  ));
  return { data: content, sha: data.sha };
}

export async function saveTasks(tasks, sha) {
  const config = getConfig();
  if (!config) throw new Error('GitHub config is not set. Open settings to connect your repo.');
  const { owner, repo, token } = config;
  const bytes = new TextEncoder().encode(JSON.stringify(tasks, null, 2));
  const encoded = btoa(String.fromCharCode(...bytes));
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/tasks.json`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update tasks',
        content: encoded,
        sha
      })
    }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.content.sha;
}
