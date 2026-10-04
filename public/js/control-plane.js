// Live parts of the control-plane panel: relative timestamps and an edge check
// against /status.json. Served as a static file so the CSP can stay at
// script-src 'self' with no inline scripts.
(() => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  function relative(iso) {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  function updateTimes() {
    document.querySelectorAll('time[data-relative]').forEach((el) => {
      el.textContent = relative(el.getAttribute('datetime'));
      el.title = el.getAttribute('datetime');
    });
  }

  const panel = document.querySelector('[data-build-sha]');
  const dot = document.querySelector('[data-edge-dot]');
  const value = document.querySelector('[data-edge-value]');
  const detail = document.querySelector('[data-edge-detail]');

  async function checkEdge() {
    if (!panel || !dot) return;
    const started = performance.now();
    try {
      const res = await fetch(`/status.json?t=${Date.now()}`, { cache: 'no-store' });
      const ms = Math.round(performance.now() - started);
      if (!res.ok) throw new Error(String(res.status));
      const status = await res.json();
      const ray = res.headers.get('cf-ray');
      const pop = ray && ray.includes('-') ? ray.split('-').pop() : null;

      dot.dataset.state = 'ok';
      value.textContent = `responding · ${ms} ms`;
      const where = pop ? `Cloudflare edge ${pop}` : 'origin (no CDN headers)';
      const pageSha = panel.dataset.buildSha;
      const liveSha = status.build && status.build.sha;
      const fresh = pageSha && liveSha && pageSha !== liveSha ? ' · newer build live, refresh to update' : '';
      detail.textContent = `${where}${fresh}`;
    } catch (err) {
      dot.dataset.state = 'error';
      value.textContent = 'unreachable';
      detail.textContent = `status check failed (${err.message})`;
    }
  }

  updateTimes();
  checkEdge();
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    updateTimes();
    checkEdge();
  }, 60000);
})();
