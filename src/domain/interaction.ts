import type { ToolMode } from '../types/project';

export function canDragViewport(
  activeTool: ToolMode,
  movementLocked: boolean,
  interactionLocked = false,
): boolean {
  return activeTool === 'pan' && !movementLocked && !interactionLocked;
}

export function canDragBusinessObject(
  objectLocked: boolean,
  movementLocked: boolean,
  interactionLocked = false,
): boolean {
  return !objectLocked && !movementLocked && !interactionLocked;
}
