// Inspection for build-time topology diagrams. Touches only data-*, tabindex
// and aria-* attributes and the hidden flag on server-rendered inspector items;
// no innerHTML, no network.
(() => {
  for (const figure of document.querySelectorAll('[data-topology]')) {
    const inspector = figure.querySelector('[data-inspector]');
    const empty = inspector && inspector.querySelector('[data-insp-empty]');

    for (const svg of figure.querySelectorAll('svg.topo')) {
      const nodes = [...svg.querySelectorAll('.node')].sort(
        (a, b) => a.dataset.col - b.dataset.col || a.dataset.row - b.dataset.row,
      );
      if (!nodes.length) continue;
      const flows = [...svg.querySelectorAll('.flow')];
      let pinned = null;

      nodes[0].tabIndex = 0;

      const show = (node) => {
        svg.querySelectorAll('[data-hl]').forEach((el) => el.removeAttribute('data-hl'));
        if (!node) {
          delete svg.dataset.active;
          if (inspector) {
            inspector.querySelectorAll('[data-insp]').forEach((el) => (el.hidden = true));
            if (empty) empty.hidden = false;
          }
          return;
        }
        const id = node.dataset.node;
        svg.dataset.active = id;
        node.dataset.hl = 'self';
        for (const f of flows) {
          if (f.dataset.from !== id && f.dataset.to !== id) continue;
          f.dataset.hl = '';
          const peer = f.dataset.from === id ? f.dataset.to : f.dataset.from;
          const peerNode = svg.querySelector(`.node[data-node="${peer}"]`);
          if (peerNode && !peerNode.dataset.hl) peerNode.dataset.hl = 'peer';
        }
        if (inspector) {
          if (empty) empty.hidden = true;
          inspector.querySelectorAll('[data-insp]').forEach((el) => (el.hidden = el.dataset.insp !== id));
        }
      };

      const pin = (node) => {
        for (const n of nodes) n.setAttribute('aria-pressed', String(n === node));
        pinned = node;
        show(node);
      };

      const focus = (node) => {
        for (const n of nodes) n.tabIndex = n === node ? 0 : -1;
        node.focus();
      };

      const neighbour = (node, key) => {
        const i = nodes.indexOf(node);
        if (key === 'ArrowDown') return nodes[i + 1];
        if (key === 'ArrowUp') return nodes[i - 1];
        if (key === 'Home') return nodes[0];
        if (key === 'End') return nodes[nodes.length - 1];
        // Left/right: nearest node in the previous/next column.
        const col = Number(node.dataset.col) + (key === 'ArrowRight' ? 1 : -1);
        const candidates = nodes.filter((n) => Number(n.dataset.col) === col);
        if (!candidates.length) return key === 'ArrowRight' ? nodes[i + 1] : nodes[i - 1];
        const row = Number(node.dataset.row);
        return candidates.reduce((best, n) =>
          Math.abs(n.dataset.row - row) < Math.abs(best.dataset.row - row) ? n : best,
        );
      };

      for (const node of nodes) {
        node.addEventListener('mouseenter', () => !pinned && show(node));
        node.addEventListener('mouseleave', () => show(pinned));
        node.addEventListener('click', () => pin(pinned === node ? null : node));
        node.addEventListener('focus', () => !pinned && show(node));
        node.addEventListener('blur', () => !pinned && show(null));
        node.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pin(pinned === node ? null : node);
          } else if (e.key === 'Escape') {
            pin(null);
          } else if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const next = neighbour(node, e.key);
            if (next) {
              focus(next);
              if (pinned) pin(next);
            }
          }
        });
      }
    }
  }
})();
