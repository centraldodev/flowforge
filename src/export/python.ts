import type JSZip from 'jszip';
import type { Graph } from '../engine';
import { models } from './models';
import appTemplate from './templates/python/app.py?raw';

export function addPythonProject(zip: JSZip, g: Graph) {
  zip.file('app.py', appTemplate);
  zip.file('models.py', models(g, 'python'));
}
