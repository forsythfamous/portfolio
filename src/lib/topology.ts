// Build-time layout for architecture diagrams. Produces plain geometry that
// Topology.astro renders as inline SVG: no layout runs in the browser, and the
// output carries no style attributes, so it works under style-src 'self'.

export type Kind = 'service' | 'datastore' | 'external' | 'client' | 'ci' | 'secret-store' | 'edge' | 'job';
export type State = 'ok' | 'warn' | 'error' | 'idle';

export interface Component {
  id: string;
  name: string;
  kind: Kind;
  tech: string;
  col: number;
  row: number;
  note?: string;
  href?: string;
  status?: State;
}

export interface Flow {
  from: string;
  to: string;
  label: string;
  type?: 'data' | 'control';
  evidence?: string;
}

export interface Boundary {
  name: string;
  contains: string[];
}

export interface Diagram {
  id: string;
  title: string;
  summary: string;
  components: Component[];
  flows: Flow[];
  boundaries: Boundary[];
}

export const KIND_TAG: Record<Kind, string> = {
  service: 'SVC',
  datastore: 'DB',
  external: 'EXT',
  client: 'CLI',
  ci: 'CI',
  'secret-store': 'SEC',
  edge: 'EDGE',
  job: 'JOB',
};

export const KIND_LABEL: Record<Kind, string> = {
  service: 'service',
  datastore: 'datastore',
  external: 'external service',
  client: 'client',
  ci: 'pipeline',
  'secret-store': 'secret store',
  edge: 'edge',
  job: 'scheduled job',
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedNode extends Component, Box {
  shape: string; // SVG path data for the outline
  inner?: string; // second outline (secret store) or front arc (datastore)
}

export interface PlacedFlow extends Flow {
  type: 'data' | 'control';
  d: string;
  index: number;
}

export interface PlacedBoundary extends Boundary, Box {}

export interface Layout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  flows: PlacedFlow[];
  boundaries: PlacedBoundary[];
}

const CONTROL_HINT = /deploy|trigger|config|auth|token|secret|schedule|cron|pull request|merge|review/i;

function flowType(f: Flow, byId: Map<string, Component>): 'data' | 'control' {
  if (f.type) return f.type;
  const from = byId.get(f.from);
  if (from && (from.kind === 'ci' || from.kind === 'secret-store')) return 'control';
  return CONTROL_HINT.test(f.label) ? 'control' : 'data';
}

function shapeFor(kind: Kind, { x, y, w, h }: Box): { shape: string; inner?: string } {
  const r = 6;
  const rect = (bx: number, by: number, bw: number, bh: number, rr: number) =>
    `M${bx + rr},${by}H${bx + bw - rr}A${rr},${rr} 0 0 1 ${bx + bw},${by + rr}V${by + bh - rr}` +
    `A${rr},${rr} 0 0 1 ${bx + bw - rr},${by + bh}H${bx + rr}A${rr},${rr} 0 0 1 ${bx},${by + bh - rr}` +
    `V${by + rr}A${rr},${rr} 0 0 1 ${bx + rr},${by}Z`;
  switch (kind) {
    case 'client':
      return { shape: rect(x, y, w, h, h / 2) };
    case 'datastore': {
      const ry = 6;
      return {
        shape: `M${x},${y + ry}A${w / 2},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${w / 2},${ry} 0 0 1 ${x},${y + h - ry}Z`,
        inner: `M${x},${y + ry}A${w / 2},${ry} 0 0 0 ${x + w},${y + ry}`,
      };
    }
    case 'ci':
      return { shape: `M${x + r},${y}H${x + w - 14}L${x + w},${y + h / 2}L${x + w - 14},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z` };
    case 'edge':
      return { shape: `M${x + 12},${y}H${x + w - 12}L${x + w},${y + h / 2}L${x + w - 12},${y + h}H${x + 12}L${x},${y + h / 2}Z` };
    case 'secret-store':
      return { shape: rect(x, y, w, h, r), inner: rect(x + 3, y + 3, w - 6, h - 6, r - 2) };
    default:
      return { shape: rect(x, y, w, h, r) };
  }
}

// ---------- horizontal (desktop) ----------

const H = { nodeW: 176, nodeH: 64, colGap: 64, rowGap: 40, pad: 32, top: 20 };

export function layoutHorizontal(dg: Diagram, scale: Partial<typeof H> = {}): Layout {
  const c = { ...H, ...scale };
  const byId = new Map(dg.components.map((n) => [n.id, n]));
  const cols = Math.max(...dg.components.map((n) => n.col)) + 1;
  const rows = Math.max(...dg.components.map((n) => n.row)) + 1;

  const nodes: PlacedNode[] = dg.components.map((n) => {
    const box = {
      x: c.pad + n.col * (c.nodeW + c.colGap),
      y: c.pad + c.top + n.row * (c.nodeH + c.rowGap),
      w: c.nodeW,
      h: c.nodeH,
    };
    return { ...n, ...box, ...shapeFor(n.kind, box) };
  });
  const placed = new Map(nodes.map((n) => [n.id, n]));

  // Spread the endpoints that share a node side so parallel edges don't overlap.
  type Side = 'l' | 'r' | 't' | 'b';
  const ports = new Map<string, number[]>();
  const sideOf = (from: PlacedNode, to: PlacedNode): [Side, Side] =>
    to.col > from.col ? ['r', 'l'] : to.col < from.col ? ['l', 'r'] : to.row > from.row ? ['b', 't'] : ['t', 'b'];

  const raw = dg.flows.map((f, index) => {
    const a = placed.get(f.from)!;
    const b = placed.get(f.to)!;
    const [sa, sb] = sideOf(a, b);
    for (const [id, s] of [[a.id, sa], [b.id, sb]] as const) {
      const key = `${id}:${s}`;
      ports.set(key, [...(ports.get(key) ?? []), index]);
    }
    return { f, index, a, b, sa, sb };
  });

  const portOffset = (id: string, side: Side, index: number) => {
    const list = ports.get(`${id}:${side}`) ?? [index];
    const i = list.indexOf(index);
    return (i - (list.length - 1) / 2) * 12;
  };

  // Lanes in each column gap so vertical segments of different edges don't overlap.
  const gapLanes = new Map<number, number[]>();
  for (const r of raw) {
    if (r.a.col === r.b.col) continue;
    const gap = Math.min(r.a.col, r.b.col);
    gapLanes.set(gap, [...(gapLanes.get(gap) ?? []), r.index]);
  }

  const flows: PlacedFlow[] = raw.map(({ f, index, a, b, sa, sb }) => {
    const pa = portOffset(a.id, sa, index);
    const pb = portOffset(b.id, sb, index);
    let d: string;
    if (sa === 'r' || sa === 'l') {
      const sx = sa === 'r' ? a.x + a.w : a.x;
      const ex = sb === 'l' ? b.x : b.x + b.w;
      const sy = a.y + a.h / 2 + pa;
      const ey = b.y + b.h / 2 + pb;
      const gap = Math.min(a.col, b.col);
      const lanes = gapLanes.get(gap) ?? [index];
      const gapCenter = c.pad + (gap + 1) * c.nodeW + gap * c.colGap + c.colGap / 2;
      const mid = gapCenter + (lanes.indexOf(index) - (lanes.length - 1) / 2) * 8;
      d = Math.abs(sy - ey) < 0.5 ? `M${sx},${sy}H${ex}` : `M${sx},${sy}H${mid}V${ey}H${ex}`;
    } else {
      const sx = a.x + a.w / 2 + pa;
      const ex = b.x + b.w / 2 + pb;
      const sy = sa === 'b' ? a.y + a.h : a.y;
      const ey = sb === 't' ? b.y : b.y + b.h;
      const midY = (sy + ey) / 2;
      d = Math.abs(sx - ex) < 0.5 ? `M${sx},${sy}V${ey}` : `M${sx},${sy}V${midY}H${ex}V${ey}`;
    }
    return { ...f, index, type: flowType(f, byId), d };
  });

  const boundaries: PlacedBoundary[] = dg.boundaries.map((bd, i) => {
    const members = bd.contains.map((id) => placed.get(id)).filter((n): n is PlacedNode => Boolean(n));
    const inset = 16 + i * 0; // boundaries are authored not to nest
    const x = Math.min(...members.map((n) => n.x)) - inset;
    const y = Math.min(...members.map((n) => n.y)) - inset - 8;
    const x2 = Math.max(...members.map((n) => n.x + n.w)) + inset;
    const y2 = Math.max(...members.map((n) => n.y + n.h)) + inset;
    return { ...bd, x, y, w: x2 - x, h: y2 - y };
  });

  return {
    width: c.pad * 2 + cols * c.nodeW + (cols - 1) * c.colGap,
    height: c.pad * 2 + c.top + rows * c.nodeH + (rows - 1) * c.rowGap,
    nodes,
    flows,
    boundaries,
  };
}

// ---------- vertical (narrow screens) ----------

export function layoutVertical(dg: Diagram): Layout {
  const byId = new Map(dg.components.map((n) => [n.id, n]));
  const order = [...dg.components].sort((a, b) => a.col - b.col || a.row - b.row);
  const index = new Map(order.map((n, i) => [n.id, i]));

  // Non-adjacent flows run along rails to the right of the nodes; assign lanes
  // greedily so overlapping spans never share a rail.
  const spans = dg.flows.map((f, i) => {
    const a = index.get(f.from)!;
    const b = index.get(f.to)!;
    return { i, lo: Math.min(a, b), hi: Math.max(a, b), adjacent: Math.abs(a - b) === 1 };
  });
  const laneOf = new Map<number, number>();
  const laneEnds: number[] = [];
  for (const s of [...spans].filter((s) => !s.adjacent).sort((a, b) => a.lo - b.lo || a.hi - b.hi)) {
    let lane = laneEnds.findIndex((end) => end <= s.lo);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = s.hi;
    laneOf.set(s.i, lane);
  }

  const width = 340;
  const pad = 2;
  const laneGap = 8;
  const railStart = 14;
  const nodeW = width - pad * 2 - railStart - Math.max(laneEnds.length, 1) * laneGap;
  const nodeH = 56;
  const gap = 28;

  const nodes: PlacedNode[] = order.map((n, i) => {
    const box = { x: pad, y: pad + i * (nodeH + gap), w: nodeW, h: nodeH };
    return { ...n, ...box, ...shapeFor(n.kind, box) };
  });

  // Spread endpoints on the right edge of each node across the rails that use it.
  const rightPorts = new Map<string, number[]>();
  for (const s of spans) {
    if (s.adjacent) continue;
    const f = dg.flows[s.i];
    for (const id of [f.from, f.to]) rightPorts.set(id, [...(rightPorts.get(id) ?? []), s.i]);
  }
  const adjPorts = new Map<string, number[]>();
  for (const s of spans) {
    if (!s.adjacent) continue;
    const key = `${s.lo}-${s.hi}`;
    adjPorts.set(key, [...(adjPorts.get(key) ?? []), s.i]);
  }

  const flows: PlacedFlow[] = dg.flows.map((f, i) => {
    const a = nodes[index.get(f.from)!];
    const b = nodes[index.get(f.to)!];
    const s = spans[i];
    let d: string;
    if (s.adjacent) {
      const list = adjPorts.get(`${s.lo}-${s.hi}`)!;
      const x = a.x + a.w / 2 + (list.indexOf(i) - (list.length - 1) / 2) * 14;
      const down = b.y > a.y;
      d = `M${x},${down ? a.y + a.h : a.y}V${down ? b.y : b.y + b.h}`;
    } else {
      const rail = a.x + a.w + railStart + laneOf.get(i)! * laneGap;
      const off = (id: string) => {
        const list = rightPorts.get(id)!;
        return (list.indexOf(i) - (list.length - 1) / 2) * 9;
      };
      const sy = a.y + a.h / 2 + off(a.id);
      const ey = b.y + b.h / 2 + off(b.id);
      d = `M${a.x + a.w},${sy}H${rail}V${ey}H${b.x + b.w}`;
    }
    return { ...f, index: i, type: flowType(f, byId), d };
  });

  return { width, height: pad * 2 + nodes.length * nodeH + (nodes.length - 1) * gap, nodes, flows, boundaries: [] };
}

// ---------- text helpers ----------

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Flows touching a component, for the inspector and the text table. */
export function flowsOf(dg: Diagram, id: string) {
  const name = (cid: string) => dg.components.find((c) => c.id === cid)?.name ?? cid;
  return {
    out: dg.flows.filter((f) => f.from === id).map((f) => ({ ...f, peer: name(f.to) })),
    in: dg.flows.filter((f) => f.to === id).map((f) => ({ ...f, peer: name(f.from) })),
  };
}

export function boundariesOf(dg: Diagram, id: string): string[] {
  return dg.boundaries.filter((b) => b.contains.includes(id)).map((b) => b.name);
}
