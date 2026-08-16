import type { ElectricalPanel, Point } from '../types/project';

export const ELECTRICAL_PANEL_LAYER_ID = 'electrical-panel';
export const ELECTRICAL_PANEL_WIDTH_METERS = 0.25;
export const ELECTRICAL_PANEL_HEIGHT_METERS = 0.1;

export function createElectricalPanel(position: Point): ElectricalPanel {
  return {
    id: `electrical-panel-${Date.now()}`,
    type: 'electrical-panel',
    name: 'Tableau principal',
    x: position.x,
    y: position.y,
    rotation: 0,
    visible: true,
    locked: false,
    layerId: ELECTRICAL_PANEL_LAYER_ID,
    widthMeters: ELECTRICAL_PANEL_WIDTH_METERS,
    heightMeters: ELECTRICAL_PANEL_HEIGHT_METERS,
    rows: 3,
    reserveModules: 0,
    comments: '',
  };
}

export function getElectricalPanelPixelSize(metersPerPixel: number): { width: number; height: number } {
  return {
    width: ELECTRICAL_PANEL_WIDTH_METERS / metersPerPixel,
    height: ELECTRICAL_PANEL_HEIGHT_METERS / metersPerPixel,
  };
}
