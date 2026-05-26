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
  const { owner, repo, token } = getConfig();
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
  const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
  return { data: content, sha: data.sha };
}

export async function saveTasks(tasks, sha) {
  const { owner, repo, token } = getConfig();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(tasks, null, 2))));
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
