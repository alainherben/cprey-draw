import type { CpreyDrawProject, DrawingLayer, Octopus } from '../types/project';

export const PLAN_LAYER_ID = 'plan';
export const ELECTRICAL_PANEL_LAYER_ID = 'electrical-panel';
export const DIRECT_DUCTS_LAYER_ID = 'direct-ducts';
export const UNASSIGNED_APPARATUS_LAYER_ID = 'unassigned-apparatus';

export function createBaseLayers(): DrawingLayer[] {
  return [
    { id: PLAN_LAYER_ID, name: 'Plan', visible: true, printVisible: true },
    { id: ELECTRICAL_PANEL_LAYER_ID, name: 'Tableau électrique', visible: true, printVisible: true },
    { id: DIRECT_DUCTS_LAYER_ID, name: 'Câbles directs', visible: true, printVisible: true },
    { id: UNASSIGNED_APPARATUS_LAYER_ID, name: 'Appareillages non affectés', visible: true, printVisible: true },
  ];
}

export function getOctopusLayerId(octopusId: string): string {
  return `octopus:${octopusId}`;
}

export function getProjectLayers(project: CpreyDrawProject): DrawingLayer[] {
  const storedLayers = new Map(project.layers.map((layer) => [layer.id, layer]));
  const baseLayers = createBaseLayers().map((layer) => storedLayers.get(layer.id) ?? layer);
  const octopusLayers = project.octopuses.map((octopus) => createOctopusLayer(octopus, storedLayers));

  return [
    baseLayers[0],
    baseLayers[1],
    ...octopusLayers,
    baseLayers[2],
    baseLayers[3],
  ];
}

export function setLayerVisible(
  project: CpreyDrawProject,
  layerId: string,
  visible: boolean,
): CpreyDrawProject {
  const layers = getProjectLayers(project).map((layer) =>
    layer.id === layerId ? { ...layer, visible } : layer,
  );

  return { ...project, layers };
}

export function isLayerVisible(project: CpreyDrawProject, layerId: string): boolean {
  return getProjectLayers(project).find((layer) => layer.id === layerId)?.visible ?? true;
}

function createOctopusLayer(octopus: Octopus, storedLayers: Map<string, DrawingLayer>): DrawingLayer {
  const id = getOctopusLayerId(octopus.id);
  const storedLayer = storedLayers.get(id);

  return {
    id,
    name: octopus.name,
    visible: storedLayer?.visible ?? true,
    printVisible: storedLayer?.printVisible ?? true,
  };
}
