import type { Diagram } from '../../lib/topology';
import { siteDiagram } from '../../lib/site-diagram';
import konta from './konta.json';
import jahus from './jahus.json';
import azure from './azure.json';
import dykf from './dykf.json';

export const diagrams: Record<string, Diagram> = {
  konta: konta as Diagram,
  jahus: jahus as Diagram,
  azure: azure as Diagram,
  dykf: dykf as Diagram,
  site: siteDiagram,
};
