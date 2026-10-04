import type { Diagram } from '../../lib/topology';
import { siteDiagram } from '../../lib/site-diagram';
import konta from './konta.json';
import jahus from './jahus.json';

export const diagrams: Record<string, Diagram> = {
  konta: konta as Diagram,
  jahus: jahus as Diagram,
  site: siteDiagram,
};
