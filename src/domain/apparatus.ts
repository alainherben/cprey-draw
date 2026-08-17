import { APPARATUS_CATALOG_VERSION, getApparatusCatalogItem } from '../catalog/apparatus';
import type { ApparatusCatalogId, ApparatusInstance, ApparatusLabelPosition, Point } from '../types/project';

export const APPARATUS_LAYER_ID = 'apparatus';
export const APPARATUS_SYMBOL_BASE_METERS = 0.1;
export type ApparatusLabelSide = ApparatusLabelPosition;

export interface ApparatusVisibleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ApparatusLabelPlacement {
  side: ApparatusLabelSide;
  x: number;
  y: number;
  width: number;
  height: number;
  align: 'left' | 'center';
}

export interface ApparatusLabelLayoutInput {
  apparatus: Pick<
    ApparatusInstance,
    'identifier' | 'labelPosition' | 'labelFontSize' | 'labelOffsetX' | 'labelOffsetY' | 'labelLocked'
  >;
  center: Point;
  iconWidth: number;
  iconHeight: number;
  visibleBounds: ApparatusVisibleBounds;
  gap: number;
  fontSize?: number;
}

export interface ApparatusImageLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

let apparatusIdSequence = 0;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nextApparatusName(catalogId: ApparatusCatalogId, existingApparatus: ApparatusInstance[]): string {
  const catalogItem = getApparatusCatalogItem(catalogId);
  const namePattern = new RegExp(`^${escapeRegExp(catalogItem.name)} (\\d+)$`);
  const largestExistingIndex = existingApparatus
    .filter((apparatus) => apparatus.catalogId === catalogId)
    .reduce((largestIndex, apparatus) => {
      const match = apparatus.name.match(namePattern);
      const index = match ? Number(match[1]) : 0;
      return Number.isFinite(index) ? Math.max(largestIndex, index) : largestIndex;
    }, 0);

  return `${catalogItem.name} ${String(largestExistingIndex + 1).padStart(2, '0')}`;
}

function nextApparatusIdentifier(catalogId: ApparatusCatalogId, existingApparatus: ApparatusInstance[]): string {
  const catalogItem = getApparatusCatalogItem(catalogId);
  const identifierPattern = new RegExp(`^${escapeRegExp(catalogItem.type)}(\\d+)$`);
  const largestExistingIndex = existingApparatus.reduce((largestIndex, apparatus) => {
    const currentCatalogItem = getApparatusCatalogItem(apparatus.catalogId);
    if (currentCatalogItem.type !== catalogItem.type) {
      return largestIndex;
    }

    const match = apparatus.identifier?.match(identifierPattern);
    const index = match ? Number(match[1]) : 0;
    return Number.isFinite(index) ? Math.max(largestIndex, index) : largestIndex;
  }, 0);

  return `${catalogItem.type}${largestExistingIndex + 1}`;
}

export function createApparatusInstance(
  catalogId: ApparatusCatalogId,
  position: Point,
  existingApparatus: ApparatusInstance[],
): ApparatusInstance {
  apparatusIdSequence += 1;
  const catalogItem = getApparatusCatalogItem(catalogId);

  return {
    id: `apparatus-${catalogId}-${Date.now()}-${apparatusIdSequence}`,
    type: 'apparatus',
    catalogId,
    catalogVersion: APPARATUS_CATALOG_VERSION,
    catalogRevision: catalogItem.revision,
    identifier: nextApparatusIdentifier(catalogId, existingApparatus),
    name: nextApparatusName(catalogId, existingApparatus),
    x: position.x,
    y: position.y,
    rotation: 0,
    visible: true,
    locked: false,
    layerId: APPARATUS_LAYER_ID,
    connected: catalogItem.connectedDefault,
    displayScale: catalogItem.defaultDisplayScale,
    labelPosition: 'right',
    labelFontSize: 12,
    labelOffsetX: 0,
    labelOffsetY: 0,
    labelLocked: false,
    comments: '',
  };
}

export function getApparatusPixelSize(
  metersPerPixel: number,
  displayScale: number,
  apparatusGlobalScale = 1,
): { width: number; height: number } {
  const size = (APPARATUS_SYMBOL_BASE_METERS * displayScale * apparatusGlobalScale) / metersPerPixel;
  return { width: size, height: size };
}

export function getApparatusImageLayout({
  center,
  width,
  height,
  rotation,
}: {
  center: Point;
  width: number;
  height: number;
  rotation: number;
}): ApparatusImageLayout {
  return {
    x: center.x,
    y: center.y,
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    rotation,
  };
}

export function estimateApparatusLabelSize(
  label: string,
  fontSize: number,
): { width: number; height: number } {
  return {
    width: Math.max(label.length * fontSize * 0.58, fontSize * 2.4),
    height: fontSize * 1.35,
  };
}

export function getApparatusLabelPlacement({
  center,
  iconWidth,
  iconHeight,
  labelWidth,
  labelHeight,
  visibleBounds,
  gap,
  overrideSide,
}: {
  center: Point;
  iconWidth: number;
  iconHeight: number;
  labelWidth: number;
  labelHeight: number;
  visibleBounds: ApparatusVisibleBounds;
  gap: number;
  overrideSide?: ApparatusLabelSide;
}): ApparatusLabelPlacement {
  const sidePreference: ApparatusLabelSide[] = ['right', 'left', 'top', 'bottom'];
  if (overrideSide) {
    return createLabelPlacement(overrideSide, center, iconWidth, iconHeight, labelWidth, labelHeight, gap);
  }

  const preferredSides: ApparatusLabelSide[] = overrideSide
    ? [overrideSide]
    : sidePreference;
  const fallbackSides: ApparatusLabelSide[] = sidePreference.filter((side) => side !== overrideSide);
  const candidates = [...preferredSides, ...fallbackSides].map((side) =>
    createLabelPlacement(side, center, iconWidth, iconHeight, labelWidth, labelHeight, gap),
  );

  return (
    candidates.find((candidate) => fitsVisibleBounds(candidate, visibleBounds)) ??
    candidates.reduce((bestCandidate, candidate) =>
      visibleOverflow(candidate, visibleBounds) < visibleOverflow(bestCandidate, visibleBounds)
        ? candidate
        : bestCandidate,
    )
  );
}

export function getApparatusLabelLayout({
  apparatus,
  center,
  iconWidth,
  iconHeight,
  visibleBounds,
  gap,
  fontSize = apparatus.labelFontSize,
}: ApparatusLabelLayoutInput): ApparatusLabelPlacement {
  const labelSize = estimateApparatusLabelSize(apparatus.identifier, fontSize);
  const placement = getApparatusLabelPlacement({
    center,
    iconWidth,
    iconHeight,
    labelWidth: labelSize.width,
    labelHeight: labelSize.height,
    visibleBounds,
    gap,
    overrideSide: apparatus.labelPosition,
  });

  return {
    ...placement,
    x: placement.x + apparatus.labelOffsetX,
    y: placement.y + apparatus.labelOffsetY,
  };
}

function createLabelPlacement(
  side: ApparatusLabelSide,
  center: Point,
  iconWidth: number,
  iconHeight: number,
  labelWidth: number,
  labelHeight: number,
  gap: number,
): ApparatusLabelPlacement {
  switch (side) {
    case 'right':
      return {
        side,
        x: center.x + iconWidth / 2 + gap,
        y: center.y - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
        align: 'left',
      };
    case 'left':
      return {
        side,
        x: center.x - iconWidth / 2 - gap - labelWidth,
        y: center.y - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
        align: 'left',
      };
    case 'top':
      return {
        side,
        x: center.x - labelWidth / 2,
        y: center.y - iconHeight / 2 - gap - labelHeight,
        width: labelWidth,
        height: labelHeight,
        align: 'center',
      };
    case 'bottom':
      return {
        side,
        x: center.x - labelWidth / 2,
        y: center.y + iconHeight / 2 + gap,
        width: labelWidth,
        height: labelHeight,
        align: 'center',
      };
  }
}

function fitsVisibleBounds(
  placement: ApparatusLabelPlacement,
  bounds: ApparatusVisibleBounds,
): boolean {
  return (
    placement.x >= bounds.x &&
    placement.y >= bounds.y &&
    placement.x + placement.width <= bounds.x + bounds.width &&
    placement.y + placement.height <= bounds.y + bounds.height
  );
}

function visibleOverflow(
  placement: ApparatusLabelPlacement,
  bounds: ApparatusVisibleBounds,
): number {
  const left = Math.max(bounds.x - placement.x, 0);
  const top = Math.max(bounds.y - placement.y, 0);
  const right = Math.max(placement.x + placement.width - (bounds.x + bounds.width), 0);
  const bottom = Math.max(placement.y + placement.height - (bounds.y + bounds.height), 0);

  return left + top + right + bottom;
}
