// Live state for the hero topology: measures a round trip to /status.json,
// updates the edge node and the single status line, and keeps relative
// timestamps fresh. External file so the CSP stays at script-src 'self'.
(() => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  const relative = (iso) => {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  };

  const updateTimes = () => {
    document.querySelectorAll('time[data-relative]').forEach((el) => {
      el.textContent = relative(el.getAttribute('datetime'));
    });
  };

  const root = document.querySelector('[data-site-status]');
  const statusLine = document.querySelector('[data-status-edge]');
  const edgeNodes = document.querySelectorAll('.node[data-node="pages"]');

  const setEdge = (state, text) => {
    edgeNodes.forEach((node) => {
      const glyph = node.querySelector('.status');
      if (glyph) glyph.dataset.state = state;
      const tech = node.querySelector('.tech');
      if (tech) tech.textContent = text;
    });
    document.querySelectorAll('[data-edge-row]').forEach((row) => {
      const glyph = row.querySelector('.glyph');
      if (glyph) glyph.dataset.state = state;
      const detail = row.querySelector('[data-edge-detail]');
      if (detail) detail.textContent = text;
    });
  };

  async function checkEdge() {
    if (!root) return;
    const started = performance.now();
    try {
      const res = await fetch(`/status.json?t=${Date.now()}`, { cache: 'no-store' });
      const ms = Math.round(performance.now() - started);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const status = await res.json();
      const ray = res.headers.get('cf-ray');
      const pop = ray && ray.includes('-') ? ray.split('-').pop() : null;
      setEdge('ok', pop ? `${ms} ms · edge ${pop}` : `${ms} ms · local`);
      const newer = root.dataset.siteStatus && status.build && status.build.sha && status.build.sha !== root.dataset.siteStatus;
      if (statusLine) statusLine.textContent = `edge ${ms} ms${newer ? ' · newer build live, refresh' : ''}`;
    } catch (err) {
      setEdge('error', 'unreachable');
      if (statusLine) statusLine.textContent = `edge check failed (${err.message})`;
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
