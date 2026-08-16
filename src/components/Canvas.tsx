import Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Path, Rect, Stage, Text } from 'react-konva';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { getApparatusCatalogItem } from '../catalog/apparatus';
import { ProjectStorage } from '../storage/ProjectStorage';
import { CommandManager } from '../commands/CommandManager';
import {
  createAddApparatusCommand,
  createDeleteApparatusCommand,
  createMoveApparatusCommand,
  createUpdateApparatusCommand,
} from '../commands/apparatus/ApparatusCommands';
import {
  createAddElectricalPanelCommand,
  createDeleteElectricalPanelCommand,
  createMoveElectricalPanelCommand,
  createUpdateElectricalPanelCommand,
} from '../commands/electricalPanel/ElectricalPanelCommands';
import {
  createAddOctopusCommand,
  createDeleteOctopusCommand,
  createMoveOctopusCommand,
  createResetOctopusOutputOverrideCommand,
  createUpdateOctopusCommand,
  createUpdateOctopusOutputOverrideCommand,
} from '../commands/octopus/OctopusCommands';
import {
  createDeletePlanCommand,
  createImportPlanCommand,
  createSetScaleCommand,
  createUpdatePlanCommand,
} from '../commands/plan/PlanCommands';
import {
  createAddDuctCommand,
  createAddDuctWaypointCommand,
  createDeleteDuctCommand,
  createDeleteDuctWaypointCommand,
  createMoveDuctControlCommand,
  createMoveDuctWaypointCommand,
  createResetDuctControlCommand,
} from '../commands/connections/ConnectionCommands';
import {
  createApparatusInstance,
  estimateApparatusLabelSize,
  getApparatusLabelPlacement,
  getApparatusPixelSize,
  type ApparatusVisibleBounds,
} from '../domain/apparatus';
import {
  createApparatusChainDuct,
  createDuct,
  createDuctControlPoint,
  createDuctWaypoint,
  createDirectPanelDuct,
  calculateDuctLengthStatus,
  calculateDuctUsedLengthMeters,
  getCircuitExpectedApparatusType,
  getIncomingDuctForApparatus,
  getDuctGeometry,
  getDuctPathPoints,
  getLinkColorCss,
  isApparatusCompatibleWithOutputCode,
} from '../domain/ducts';
import {
  buildQuadraticDuctGeometry,
  createDefaultDuctControlPoint,
  getQuadraticInsertion,
  normalizeDuctControlsForPoints,
  splitQuadraticCurve,
} from '../domain/ductGeometry';
import { getProjectLayers, setLayerVisible } from '../domain/layers';
import { canDragBusinessObject, canDragViewport } from '../domain/interaction';
import {
  isApparatusEffectivelyVisible,
  isDuctEffectivelyVisible,
  isElectricalPanelEffectivelyVisible,
  isOctopusEffectivelyVisible,
  isPlanEffectivelyVisible,
} from '../domain/visibility';
import { getElectricalPanelPixelSize, createElectricalPanel } from '../domain/electricalPanel';
import {
  createOctopus,
  getOctopusPixelSize,
  getOctopusPortLocalPosition,
  OCTOPUS_MODELS,
} from '../domain/octopus';
import { getEffectiveOctopusOutput } from '../domain/octopusOutputs';
import { getObjectDisplayLevel, getOctopusDisplayLevel } from '../domain/display';
import { viewportPointToWorld, zoomViewportAtPointer } from '../domain/viewport';
import type {
  ApparatusCatalogId,
  ApparatusInstance,
  ConnectionTargetType,
  CpreyDrawProject,
  Duct,
  ElectricalPanel,
  Octopus,
  OctopusOutputOverride,
  OctopusModelId,
  Plan,
  Point,
  ToolMode,
  Viewport,
} from '../types/project';
import {
  calculateMetersPerPixel,
  createEmptyScaleDraft,
  createScaleReference,
  pixelDistance,
  type ScaleDraft,
} from '../tools/ScaleTool';
import {
  createEmptyMeasureDraft,
  createMeasurement,
  measurementMeters,
  type Measurement,
  type MeasureDraft,
} from '../tools/MeasureTool';
import { getApparatusAssetUrl } from '../domain/apparatusAssets';
import { OCTOPUS_LOGO_URLS } from '../domain/octopusAssets';

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 8;
const FIT_PADDING = 40;
const LIGHTNING_PATH = 'M13 1 L4 14 H11 L9 23 L20 9 H13 Z';

type PendingConnection =
  | {
      kind: 'octopus-output';
      octopusId: string;
      outputNumber: number;
      targetType: ConnectionTargetType;
    }
  | {
      kind: 'apparatus-chain';
      apparatusId: string;
    };
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function linePoints(start: Point, end: Point): number[] {
  return [start.x, start.y, end.x, end.y];
}

function getVisibleWorldBounds(viewport: Viewport, width: number, height: number): ApparatusVisibleBounds {
  return {
    x: -viewport.x / viewport.scale,
    y: -viewport.y / viewport.scale,
    width: width / viewport.scale,
    height: height / viewport.scale,
  };
}

function readImage(file: File): Promise<Plan> {
  return new Promise((resolve, reject) => {
    const mimeType = file.type;

    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
      reject(new Error('Format non pris en charge. Utilisez un fichier PNG ou JPG/JPEG.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new window.Image();
      image.onerror = () => reject(new Error("Impossible de charger l'image."));
      image.onload = () => {
        resolve({
          id: `plan-${Date.now()}`,
          name: file.name,
          source: dataUrl,
          visible: true,
          locked: false,
          opacity: 1,
          rotation: 0,
          mimeType,
          width: image.naturalWidth,
          height: image.naturalHeight,
          importedAt: new Date().toISOString(),
        });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function useHtmlImage(dataUrl: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!dataUrl) {
      setImage(null);
      return;
    }

    const nextImage = new window.Image();
    setImage(null);
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = dataUrl;
  }, [dataUrl]);

  return image;
}

function formatMeters(value: number | null): string {
  return value === null ? 'Échelle requise' : `${value.toFixed(2)} m`;
}

export function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const lastDragDistance = useRef(0);
  const panelDragStart = useRef<Point | null>(null);
  const octopusDragStart = useRef<{ id: string; position: Point } | null>(null);
  const apparatusDragStart = useRef<{ id: string; position: Point } | null>(null);
  const ductWaypointDragStart = useRef<{ ductId: string; waypointId: string; position: Point } | null>(null);
  const ductControlDragStart = useRef<{ ductId: string; controlId: string; position: Point } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 720 });
  const [activeTool, setActiveTool] = useState<ToolMode>('pan');
  const [placementOctopusModelId, setPlacementOctopusModelId] = useState<OctopusModelId | null>(null);
  const [placementApparatusCatalogId, setPlacementApparatusCatalogId] = useState<ApparatusCatalogId | null>(null);
  const [pendingConnectionOutput, setPendingConnectionOutput] = useState<PendingConnection | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedDuctWaypointId, setSelectedDuctWaypointId] = useState<string | null>(null);
  const [selectedDuctControlId, setSelectedDuctControlId] = useState<string | null>(null);
  const [isDraggingDuctHandle, setIsDraggingDuctHandle] = useState(false);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(true);
  const [project, setProject] = useState<CpreyDrawProject>(() => ProjectStorage.load());
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [, setHistoryRevision] = useState(0);
  const commandManagerRef = useRef<CommandManager | null>(null);
  const [scaleDraft, setScaleDraft] = useState<ScaleDraft>(() => createEmptyScaleDraft());
  const [measureDraft, setMeasureDraft] = useState<MeasureDraft>(() => createEmptyMeasureDraft());
  const [temporaryMeasurement, setTemporaryMeasurement] = useState<Measurement | null>(null);
  const activePlan = project.plans[0] ?? null;
  const selectedElectricalPanel =
    selectedObjectId === project.electricalPanel?.id ? project.electricalPanel : null;
  const selectedOctopus = project.octopuses.find((octopus) => octopus.id === selectedObjectId) ?? null;
  const selectedApparatus = project.apparatus.find((apparatus) => apparatus.id === selectedObjectId) ?? null;
  const selectedDuct = project.ducts.find((duct) => duct.id === selectedObjectId) ?? null;
  const selectedBusinessObject = selectedElectricalPanel ?? selectedOctopus ?? selectedApparatus;
  const planImage = useHtmlImage(activePlan?.source ?? null);
  const octopusLogoImages: Record<OctopusModelId, HTMLImageElement | null> = {
    kitchen: useHtmlImage(OCTOPUS_LOGO_URLS.kitchen),
    bath: useHtmlImage(OCTOPUS_LOGO_URLS.bath),
    other: useHtmlImage(OCTOPUS_LOGO_URLS.other),
    comfort: useHtmlImage(OCTOPUS_LOGO_URLS.comfort),
  };

  if (!commandManagerRef.current) {
    commandManagerRef.current = new CommandManager(
      (nextProject) => setProject(nextProject),
      () => setHistoryRevision((revision) => revision + 1),
    );
  }

  const commandManager = commandManagerRef.current;

  const viewport = project.drawing.viewport;

  const setViewport = useCallback((nextViewport: Viewport) => {
    setProject((current) => ({
      ...current,
      drawing: {
        ...current.drawing,
        viewport: nextViewport,
      },
    }));
  }, []);

  const updateDrawingState = useCallback((updates: Partial<CpreyDrawProject['drawing']>) => {
    setProject((current) => ({
      ...current,
      drawing: {
        ...current.drawing,
        ...updates,
      },
    }));
  }, []);

  const fitPlanToScreen = useCallback(
    (plan: Plan | null = activePlan) => {
      if (!plan) {
        return;
      }

      const planWidth = plan.width ?? 1;
      const planHeight = plan.height ?? 1;
      const availableWidth = Math.max(containerSize.width - FIT_PADDING * 2, 1);
      const availableHeight = Math.max(containerSize.height - FIT_PADDING * 2, 1);
      const nextScale = clamp(
        Math.min(availableWidth / planWidth, availableHeight / planHeight),
        MIN_ZOOM,
        MAX_ZOOM,
      );

      setViewport({
        scale: nextScale,
        x: (containerSize.width - planWidth * nextScale) / 2,
        y: (containerSize.height - planHeight * nextScale) / 2,
      });
    },
    [activePlan, containerSize.height, containerSize.width, setViewport],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({
        width: Math.max(Math.floor(width), 1),
        height: Math.max(Math.floor(height), 1),
      });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    ProjectStorage.save(project);
  }, [project]);

  useEffect(() => {
    if (!saveMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const usesModifier = event.metaKey || event.ctrlKey;
      if (!usesModifier || event.key.toLowerCase() !== 'z') {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        commandManager.redo();
      } else {
        commandManager.undo();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [commandManager]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      setMeasureDraft(createEmptyMeasureDraft());
      setTemporaryMeasurement(null);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
      const target = event.target;
      const isEditingField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;

      if (!isDeleteKey || isEditingField || (!selectedBusinessObject && !selectedDuct)) {
        return;
      }

      event.preventDefault();
      if (selectedDuct && selectedDuctWaypointId) {
        const pathPoints = getDuctPathPoints(
          selectedDuct,
          project.octopuses,
          project.apparatus,
          project.electricalPanel,
          project.drawing.metersPerPixel,
        );
        const waypointIndex = selectedDuct.waypoints.findIndex((waypoint) => waypoint.id === selectedDuctWaypointId);
        const mergedControl = waypointIndex >= 0 && pathPoints[waypointIndex] && pathPoints[waypointIndex + 2]
          ? createDefaultDuctControlPoint(pathPoints[waypointIndex], pathPoints[waypointIndex + 2])
          : createDuctControlPoint({ x: 0, y: 0 });
        commandManager.execute(
          createDeleteDuctWaypointCommand(
            project,
            selectedDuct.id,
            selectedDuctWaypointId,
            mergedControl,
            commandManager.setProject.bind(commandManager),
          ),
        );
        setSelectedDuctWaypointId(null);
        return;
      } else if (selectedDuct) {
        if (selectedDuct.locked) {
          return;
        }

        commandManager.execute(
          createDeleteDuctCommand(
            project,
            selectedDuct.id,
            commandManager.setProject.bind(commandManager),
          ),
        );
      } else if (selectedBusinessObject?.type === 'electrical-panel') {
        commandManager.execute(
          createDeleteElectricalPanelCommand(project, commandManager.setProject.bind(commandManager)),
        );
      } else if (selectedBusinessObject?.type === 'octopus') {
        commandManager.execute(
          createDeleteOctopusCommand(
            project,
            selectedBusinessObject.id,
            commandManager.setProject.bind(commandManager),
          ),
        );
      } else if (selectedBusinessObject?.type === 'apparatus') {
        commandManager.execute(
          createDeleteApparatusCommand(
            project,
            selectedBusinessObject.id,
            commandManager.setProject.bind(commandManager),
          ),
        );
      }
      setSelectedObjectId(null);
    };

    window.addEventListener('keydown', handleDeleteShortcut);
    return () => window.removeEventListener('keydown', handleDeleteShortcut);
  }, [commandManager, project, selectedBusinessObject, selectedDuct, selectedDuctWaypointId]);

  const importPlan = useCallback(
    async (file: File) => {
      setIsPlanLoading(true);
      try {
        const plan = await readImage(file);
        const planWidth = plan.width ?? 1;
        const planHeight = plan.height ?? 1;
        const availableWidth = Math.max(containerSize.width - FIT_PADDING * 2, 1);
        const availableHeight = Math.max(containerSize.height - FIT_PADDING * 2, 1);
        const nextScale = clamp(
          Math.min(availableWidth / planWidth, availableHeight / planHeight),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        const fittedViewport: Viewport = {
          scale: nextScale,
          x: (containerSize.width - planWidth * nextScale) / 2,
          y: (containerSize.height - planHeight * nextScale) / 2,
        };

        commandManager.execute(createImportPlanCommand(project, plan, fittedViewport, commandManager.setProject.bind(commandManager)));
        setScaleDraft(createEmptyScaleDraft());
        setMeasureDraft(createEmptyMeasureDraft());
        setTemporaryMeasurement(null);
        setActiveTool('pan');
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Import impossible.');
      } finally {
        setIsPlanLoading(false);
      }
    },
    [commandManager, containerSize.height, containerSize.width, project],
  );

  const updateActivePlan = useCallback(
    (
      updates: Partial<Pick<Plan, 'visible' | 'locked' | 'opacity' | 'rotation'>>,
      label: string,
    ) => {
      if (!activePlan || (activePlan.locked && !('locked' in updates))) {
        return;
      }

      commandManager.execute(
        createUpdatePlanCommand(
          project,
          activePlan.id,
          updates,
          commandManager.setProject.bind(commandManager),
          label,
        ),
      );
    },
    [activePlan, commandManager, project],
  );

  const getPointerWorldPosition = useCallback((): Point | null => {
    const stage = stageRef.current;
    const pointerPosition = stage?.getPointerPosition();

    if (!pointerPosition) {
      return null;
    }

    return viewportPointToWorld(pointerPosition, viewport);
  }, [viewport]);

  const handleWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();

      if (!pointer) {
        return;
      }

      const nextViewport = zoomViewportAtPointer(
        viewport,
        pointer,
        event.evt.deltaY,
        project.drawing.zoomWheelEnabled,
        MIN_ZOOM,
        MAX_ZOOM,
      );

      if (nextViewport !== viewport) {
        setViewport(nextViewport);
      }
    },
    [project.drawing.zoomWheelEnabled, setViewport, viewport],
  );

  const completeScale = useCallback(
    (start: Point, end: Point) => {
      const rawValue = window.prompt('Distance réelle entre les deux points, en mètres :', '5');
      const normalizedValue = rawValue?.replace(',', '.').trim();
      const realMeters = Number(normalizedValue);

      if (!normalizedValue || !Number.isFinite(realMeters) || realMeters <= 0) {
        setScaleDraft(createEmptyScaleDraft());
        return;
      }

      const metersPerPixel = calculateMetersPerPixel(start, end, realMeters);
      commandManager.execute(
        createSetScaleCommand(
          project,
          metersPerPixel,
          createScaleReference(start, end, realMeters),
          commandManager.setProject.bind(commandManager),
        ),
      );
      setScaleDraft(createEmptyScaleDraft());
      setActiveTool('measure');
    },
    [commandManager, project],
  );

  const handleStageClick = useCallback(() => {
    if (lastDragDistance.current > 4) {
      return;
    }

    const worldPosition = getPointerWorldPosition();
    if (!worldPosition) {
      return;
    }

    if (activeTool === 'pan') {
      setSelectedObjectId(null);
      setPendingConnectionOutput(null);
      return;
    }

    if (activeTool === 'place-electrical-panel') {
      if (!activePlan || project.drawing.metersPerPixel === null) {
        window.alert("Définissez d'abord l'échelle du plan.");
        setActiveTool('pan');
        return;
      }

      if (project.electricalPanel) {
        setSelectedObjectId(project.electricalPanel.id);
        setActiveTool('pan');
        return;
      }

      const electricalPanel = createElectricalPanel(worldPosition);
      commandManager.execute(
        createAddElectricalPanelCommand(
          project,
          electricalPanel,
          commandManager.setProject.bind(commandManager),
        ),
      );
      setSelectedObjectId(electricalPanel.id);
      setIsPropertiesPanelOpen(true);
      setActiveTool('pan');
      return;
    }

    if (activeTool === 'place-octopus') {
      if (!activePlan || project.drawing.metersPerPixel === null || !placementOctopusModelId) {
        window.alert("Définissez d'abord l'échelle du plan.");
        setActiveTool('pan');
        setPlacementOctopusModelId(null);
        return;
      }

      const octopus = createOctopus(placementOctopusModelId, worldPosition, project.octopuses);
      commandManager.execute(
        createAddOctopusCommand(
          project,
          octopus,
          commandManager.setProject.bind(commandManager),
        ),
      );
      setSelectedObjectId(octopus.id);
      setIsPropertiesPanelOpen(true);
      setActiveTool('pan');
      setPlacementOctopusModelId(null);
      return;
    }

    if (activeTool === 'place-apparatus') {
      if (!activePlan || project.drawing.metersPerPixel === null || !placementApparatusCatalogId) {
        window.alert("Définissez d'abord l'échelle du plan.");
        setActiveTool('pan');
        setPlacementApparatusCatalogId(null);
        return;
      }

      const apparatus = createApparatusInstance(
        placementApparatusCatalogId,
        worldPosition,
        project.apparatus,
      );
      commandManager.execute(
        createAddApparatusCommand(
          project,
          apparatus,
          commandManager.setProject.bind(commandManager),
        ),
      );
      setSelectedObjectId(apparatus.id);
      setIsPropertiesPanelOpen(true);
      setActiveTool('pan');
      setPlacementApparatusCatalogId(null);
      return;
    }

    if (activeTool === 'connect-target') {
      return;
    }

    if (!activePlan) {
      return;
    }

    if (activeTool === 'scale') {
      if (!scaleDraft.start) {
        setScaleDraft({ start: worldPosition, end: worldPosition });
        return;
      }

      completeScale(scaleDraft.start, worldPosition);
      return;
    }

    if (activeTool === 'measure' && project.drawing.metersPerPixel !== null) {
      if (!measureDraft.start) {
        setMeasureDraft({ start: worldPosition, end: worldPosition });
        setTemporaryMeasurement(null);
        return;
      }

      const nextMeasurement = createMeasurement(measureDraft.start, worldPosition);
      setTemporaryMeasurement(nextMeasurement);
      setMeasureDraft(createEmptyMeasureDraft());
    }
  }, [
    activePlan,
    activeTool,
    commandManager,
    completeScale,
    getPointerWorldPosition,
    measureDraft.start,
    project,
    project.drawing.metersPerPixel,
    project.electricalPanel,
    project.apparatus,
    project.octopuses,
    pendingConnectionOutput,
    placementApparatusCatalogId,
    placementOctopusModelId,
    scaleDraft.start,
  ]);

  const handlePointerMove = useCallback(() => {
    const worldPosition = getPointerWorldPosition();
    if (!worldPosition) {
      return;
    }

    if (activeTool === 'scale' && scaleDraft.start) {
      setScaleDraft((current) => ({ ...current, end: worldPosition }));
    }

    if (activeTool === 'measure' && measureDraft.start) {
      setMeasureDraft((current) => ({ ...current, end: worldPosition }));
    }
  }, [activeTool, getPointerWorldPosition, measureDraft.start, scaleDraft.start]);

  const handleDragStart = useCallback((event: Konva.KonvaEventObject<DragEvent>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    lastDragDistance.current = 0;
  }, []);

  const handleDragMove = useCallback((event: Konva.KonvaEventObject<DragEvent>) => {
    if (event.target !== event.currentTarget || project.drawing.movementLocked || isDraggingDuctHandle) {
      return;
    }

    lastDragDistance.current += Math.abs(event.evt.movementX) + Math.abs(event.evt.movementY);
    setViewport({
      x: event.target.x(),
      y: event.target.y(),
      scale: viewport.scale,
    });
  }, [isDraggingDuctHandle, project.drawing.movementLocked, setViewport, viewport.scale]);

  const updateElectricalPanel = useCallback(
    (
      updates: Partial<
        Pick<
          ElectricalPanel,
          'name' | 'x' | 'y' | 'rotation' | 'rows' | 'reserveModules' | 'comments' | 'visible' | 'locked'
        >
      >,
      label = 'Modifier le tableau électrique',
    ) => {
      if (!project.electricalPanel) {
        return;
      }

      if (project.electricalPanel.locked && !('locked' in updates) && !('visible' in updates)) {
        return;
      }

      commandManager.execute(
        createUpdateElectricalPanelCommand(
          project,
          updates,
          commandManager.setProject.bind(commandManager),
          label,
        ),
      );
    },
    [commandManager, project],
  );

  const deleteElectricalPanel = useCallback(() => {
    if (!project.electricalPanel) {
      return;
    }

    commandManager.execute(
      createDeleteElectricalPanelCommand(project, commandManager.setProject.bind(commandManager)),
    );
    setSelectedObjectId(null);
  }, [commandManager, project]);

  const updateOctopus = useCallback(
    (
      octopusId: string,
      updates: Partial<Pick<Octopus, 'name' | 'x' | 'y' | 'rotation' | 'comments' | 'visible' | 'locked' | 'displayScale' | 'outputOverrides'>>,
      label = 'Modifier une pieuvre',
    ) => {
      const octopus = project.octopuses.find((currentOctopus) => currentOctopus.id === octopusId);
      if (!octopus) {
        return;
      }

      if (octopus.locked && !('locked' in updates) && !('visible' in updates)) {
        return;
      }

      commandManager.execute(
        createUpdateOctopusCommand(
          project,
          octopusId,
          updates,
          commandManager.setProject.bind(commandManager),
          label,
        ),
      );
    },
    [commandManager, project],
  );

  const updateOctopusOutputOverride = useCallback(
    (octopusId: string, override: OctopusOutputOverride) => {
      commandManager.execute(
        createUpdateOctopusOutputOverrideCommand(
          project,
          octopusId,
          override,
          commandManager.setProject.bind(commandManager),
        ),
      );
    },
    [commandManager, project],
  );

  const resetOctopusOutputOverride = useCallback(
    (octopusId: string, outputNumber: number) => {
      commandManager.execute(
        createResetOctopusOutputOverrideCommand(
          project,
          octopusId,
          outputNumber,
          commandManager.setProject.bind(commandManager),
        ),
      );
    },
    [commandManager, project],
  );

  const deleteOctopus = useCallback(
    (octopusId: string) => {
      commandManager.execute(
        createDeleteOctopusCommand(project, octopusId, commandManager.setProject.bind(commandManager)),
      );
      setSelectedObjectId(null);
    },
    [commandManager, project],
  );

  const updateApparatus = useCallback(
    (
      apparatusId: string,
      updates: Partial<
        Pick<
          ApparatusInstance,
          | 'name'
          | 'identifier'
          | 'x'
          | 'y'
          | 'rotation'
          | 'comments'
          | 'visible'
          | 'locked'
          | 'connected'
          | 'displayScale'
          | 'labelPosition'
          | 'labelFontSize'
          | 'labelOffsetX'
          | 'labelOffsetY'
          | 'labelLocked'
        >
      >,
      label = 'Modifier un appareillage',
    ) => {
      const apparatus = project.apparatus.find((currentApparatus) => currentApparatus.id === apparatusId);
      if (!apparatus) {
        return;
      }

      if (apparatus.locked && !('locked' in updates) && !('visible' in updates) && !('connected' in updates)) {
        return;
      }

      commandManager.execute(
        createUpdateApparatusCommand(
          project,
          apparatusId,
          updates,
          commandManager.setProject.bind(commandManager),
          label,
        ),
      );
    },
    [commandManager, project],
  );

  const deleteApparatus = useCallback(
    (apparatusId: string) => {
      commandManager.execute(
        createDeleteApparatusCommand(project, apparatusId, commandManager.setProject.bind(commandManager)),
      );
      setSelectedObjectId(null);
    },
    [commandManager, project],
  );

  const startConnection = useCallback((octopusId: string, outputNumber: number, targetType: ConnectionTargetType) => {
    setPendingConnectionOutput({ kind: 'octopus-output', octopusId, outputNumber, targetType });
    setActiveTool('connect-target');
    setPlacementApparatusCatalogId(null);
    setPlacementOctopusModelId(null);
    setScaleDraft(createEmptyScaleDraft());
    setMeasureDraft(createEmptyMeasureDraft());
    setTemporaryMeasurement(null);
  }, []);

  const startApparatusChainConnection = useCallback((apparatusId: string) => {
    setPendingConnectionOutput({ kind: 'apparatus-chain', apparatusId });
    setActiveTool('connect-target');
    setPlacementApparatusCatalogId(null);
    setPlacementOctopusModelId(null);
    setScaleDraft(createEmptyScaleDraft());
    setMeasureDraft(createEmptyMeasureDraft());
    setTemporaryMeasurement(null);
  }, []);

  const createDirectPanelConnection = useCallback(
    (apparatusId: string) => {
      if (!project.electricalPanel) {
        window.alert('Ajoutez d’abord le tableau électrique.');
        return;
      }

      const result = createDirectPanelDuct(project, project.electricalPanel.id, apparatusId);
      if (!result.ok) {
        window.alert(result.reason);
        return;
      }

      commandManager.execute(
        createAddDuctCommand(project, result.duct, commandManager.setProject.bind(commandManager)),
      );
      setSelectedObjectId(result.duct.id);
      setIsPropertiesPanelOpen(true);
    },
    [commandManager, project],
  );

  const completeConnection = useCallback(
    (targetType: ConnectionTargetType, targetId: string) => {
      if (!pendingConnectionOutput) {
        return false;
      }

      if (pendingConnectionOutput.kind === 'apparatus-chain') {
        if (targetType !== 'apparatus') {
          window.alert('Sélectionnez un appareillage.');
          return false;
        }

        const result = createApparatusChainDuct(project, pendingConnectionOutput.apparatusId, targetId);
        if (!result.ok) {
          window.alert(result.reason);
          setPendingConnectionOutput(null);
          setActiveTool('pan');
          return false;
        }

        commandManager.execute(
          createAddDuctCommand(project, result.duct, commandManager.setProject.bind(commandManager)),
        );
        setSelectedObjectId(result.duct.id);
        setIsPropertiesPanelOpen(true);
        setPendingConnectionOutput(null);
        setActiveTool('pan');
        return true;
      }

      if (pendingConnectionOutput.targetType !== targetType) {
        window.alert(
          pendingConnectionOutput.targetType === 'electrical-panel'
            ? 'Sélectionnez le tableau électrique.'
            : 'Sélectionnez un appareillage.',
        );
        return false;
      }

      const result = createDuct(
        project,
        pendingConnectionOutput.octopusId,
        pendingConnectionOutput.outputNumber,
        { type: targetType, id: targetId },
      );

      if (!result.ok) {
        window.alert(result.reason);
        setPendingConnectionOutput(null);
        setActiveTool('pan');
        return false;
      }

      commandManager.execute(
        createAddDuctCommand(project, result.duct, commandManager.setProject.bind(commandManager)),
      );
      setSelectedObjectId(result.duct.id);
      setIsPropertiesPanelOpen(true);
      setPendingConnectionOutput(null);
      setActiveTool('pan');
      return true;
    },
    [commandManager, pendingConnectionOutput, project],
  );

  const deleteDuct = useCallback(
    (ductId: string) => {
      const duct = project.ducts.find((currentDuct) => currentDuct.id === ductId);
      if (!duct || duct.locked) {
        return;
      }

      commandManager.execute(
        createDeleteDuctCommand(project, ductId, commandManager.setProject.bind(commandManager)),
      );
      setSelectedObjectId(null);
    },
    [commandManager, project],
  );

  const resetDuctControl = useCallback(
    (ductId: string, controlId: string) => {
      const duct = project.ducts.find((currentDuct) => currentDuct.id === ductId);
      if (!duct || duct.locked) {
        return;
      }

      const pathPoints = getDuctPathPoints(
        duct,
        project.octopuses,
        project.apparatus,
        project.electricalPanel,
        project.drawing.metersPerPixel,
      );
      const controlIndex = duct.controls.findIndex((control) => control.id === controlId);
      if (controlIndex < 0 || !pathPoints[controlIndex] || !pathPoints[controlIndex + 1]) {
        return;
      }

      commandManager.execute(
        createResetDuctControlCommand(
          project,
          ductId,
          controlId,
          {
            ...duct.controls[controlIndex],
            x: (pathPoints[controlIndex].x + pathPoints[controlIndex + 1].x) / 2,
            y: (pathPoints[controlIndex].y + pathPoints[controlIndex + 1].y) / 2,
          },
          commandManager.setProject.bind(commandManager),
        ),
      );
    },
    [commandManager, project],
  );

  const addDuctWaypoint = useCallback(
    (ductId: string, position: Point | null = null) => {
      const duct = project.ducts.find((currentDuct) => currentDuct.id === ductId);
      if (!duct || duct.locked) {
        return;
      }

      const pathPoints = getDuctPathPoints(
        duct,
        project.octopuses,
        project.apparatus,
        project.electricalPanel,
        project.drawing.metersPerPixel,
      );
      if (pathPoints.length < 2) {
        return;
      }

      const insertionPosition = position ?? {
        x: (pathPoints[0].x + pathPoints[pathPoints.length - 1].x) / 2,
        y: (pathPoints[0].y + pathPoints[pathPoints.length - 1].y) / 2,
      };
      const controls = normalizeDuctControlsForPoints(pathPoints, duct.controls);
      const insertion = getQuadraticInsertion(pathPoints, controls, insertionPosition);
      const split = splitQuadraticCurve(
        pathPoints[insertion.segmentIndex],
        controls[insertion.segmentIndex],
        pathPoints[insertion.segmentIndex + 1],
        insertion.t,
      );
      const insertionIndex = insertion.segmentIndex;
      const waypoint = createDuctWaypoint(split.waypoint);
      const firstControl = createDuctControlPoint(split.firstControl);
      const secondControl = createDuctControlPoint(split.secondControl);

      commandManager.execute(
        createAddDuctWaypointCommand(
          project,
          ductId,
          waypoint,
          insertionIndex,
          [firstControl, secondControl],
          commandManager.setProject.bind(commandManager),
        ),
      );
      setSelectedObjectId(ductId);
      setSelectedDuctWaypointId(waypoint.id);
      setSelectedDuctControlId(null);
      setIsPropertiesPanelOpen(true);
    },
    [commandManager, project],
  );

  const activeDraftLine = useMemo(() => {
    if (activeTool === 'scale' && scaleDraft.start && scaleDraft.end) {
      return { start: scaleDraft.start, end: scaleDraft.end, className: 'scale' };
    }

    if (activeTool === 'measure' && measureDraft.start && measureDraft.end) {
      return { start: measureDraft.start, end: measureDraft.end, className: 'measure' };
    }

    return null;
  }, [activeTool, measureDraft.end, measureDraft.start, scaleDraft.end, scaleDraft.start]);

  return (
    <div className="app-shell">
      <Toolbar
        activeTool={activeTool}
        activePlan={activePlan}
        canUndo={commandManager.canUndo()}
        canRedo={commandManager.canRedo()}
        isPlanLoading={isPlanLoading}
        metersPerPixel={project.drawing.metersPerPixel}
        hasElectricalPanel={project.electricalPanel !== undefined}
        hasTemporaryMeasurement={temporaryMeasurement !== null || measureDraft.start !== null}
        wheelZoomEnabled={project.drawing.zoomWheelEnabled}
        movementLocked={project.drawing.movementLocked}
        hasScaleReference={project.drawing.scaleReference !== null}
        scaleMarkerVisible={project.drawing.scaleMarkerVisible}
        layers={getProjectLayers(project)}
        onImportPlan={importPlan}
        onFitToScreen={() => fitPlanToScreen()}
        onToggleWheelZoom={() => updateDrawingState({ zoomWheelEnabled: !project.drawing.zoomWheelEnabled })}
        onToggleMovementLocked={() => updateDrawingState({ movementLocked: !project.drawing.movementLocked })}
        onToggleScaleMarkerVisible={() => updateDrawingState({ scaleMarkerVisible: !project.drawing.scaleMarkerVisible })}
        onToggleLayerVisible={(layerId, visible) => {
          setProject((currentProject) => setLayerVisible(currentProject, layerId, visible));
        }}
        onSaveProject={() => {
          ProjectStorage.save(project);
          setSaveMessage('Projet sauvegardé');
        }}
        onUndo={() => commandManager.undo()}
        onRedo={() => commandManager.redo()}
        onStartElectricalPanelPlacement={() => {
          if (project.drawing.metersPerPixel === null) {
            window.alert("Définissez d'abord l'échelle du plan.");
            return;
          }

          lastDragDistance.current = 0;
          setSelectedObjectId(null);
          setIsPropertiesPanelOpen(true);
          setActiveTool('place-electrical-panel');
          setPlacementApparatusCatalogId(null);
          setPlacementOctopusModelId(null);
          setPendingConnectionOutput(null);
          setScaleDraft(createEmptyScaleDraft());
          setMeasureDraft(createEmptyMeasureDraft());
          setTemporaryMeasurement(null);
        }}
        onStartOctopusPlacement={(modelId) => {
          if (project.drawing.metersPerPixel === null) {
            window.alert("Définissez d'abord l'échelle du plan.");
            return;
          }

          lastDragDistance.current = 0;
          setSelectedObjectId(null);
          setIsPropertiesPanelOpen(true);
          setActiveTool('place-octopus');
          setPlacementOctopusModelId(modelId);
          setPlacementApparatusCatalogId(null);
          setPendingConnectionOutput(null);
          setScaleDraft(createEmptyScaleDraft());
          setMeasureDraft(createEmptyMeasureDraft());
          setTemporaryMeasurement(null);
        }}
        onStartApparatusPlacement={(catalogId) => {
          if (project.drawing.metersPerPixel === null) {
            window.alert("Définissez d'abord l'échelle du plan.");
            return;
          }

          lastDragDistance.current = 0;
          setSelectedObjectId(null);
          setIsPropertiesPanelOpen(true);
          setActiveTool('place-apparatus');
          setPlacementApparatusCatalogId(catalogId);
          setPlacementOctopusModelId(null);
          setPendingConnectionOutput(null);
          setScaleDraft(createEmptyScaleDraft());
          setMeasureDraft(createEmptyMeasureDraft());
          setTemporaryMeasurement(null);
        }}
        onClearTemporaryMeasurement={() => {
          setMeasureDraft(createEmptyMeasureDraft());
          setTemporaryMeasurement(null);
        }}
        onSelectTool={(tool) => {
          lastDragDistance.current = 0;
          setActiveTool(tool);
          setPlacementOctopusModelId(null);
          setPlacementApparatusCatalogId(null);
          setPendingConnectionOutput(null);
          setScaleDraft(createEmptyScaleDraft());
          setMeasureDraft(createEmptyMeasureDraft());
          if (tool === 'measure') {
            setTemporaryMeasurement(null);
          }
        }}
        onDeletePlan={() => {
          if (!activePlan || activePlan.locked) {
            return;
          }

          commandManager.execute(
            createDeletePlanCommand(project, commandManager.setProject.bind(commandManager)),
          );
          setScaleDraft(createEmptyScaleDraft());
          setMeasureDraft(createEmptyMeasureDraft());
          setTemporaryMeasurement(null);
          setActiveTool('pan');
        }}
        onTogglePlanVisible={() => updateActivePlan({ visible: !activePlan?.visible }, activePlan?.visible ? 'Masquer le plan' : 'Afficher le plan')}
        onTogglePlanLocked={() => updateActivePlan({ locked: !activePlan?.locked }, activePlan?.locked ? 'Déverrouiller le plan' : 'Verrouiller le plan')}
        onChangePlanOpacity={(opacity) => {
          if (!Number.isFinite(opacity)) {
            return;
          }

          updateActivePlan({ opacity: clamp(opacity, 0.1, 1) }, 'Modifier l’opacité du plan');
        }}
        onChangePlanRotation={(rotation) => {
          if (!Number.isFinite(rotation)) {
            return;
          }

          updateActivePlan({ rotation }, 'Modifier la rotation du plan');
        }}
      />

      <main
        className={`workspace ${
          activeTool === 'place-electrical-panel' ||
          activeTool === 'place-octopus' ||
          activeTool === 'place-apparatus' ||
          activeTool === 'connect-target'
            ? 'placing-object'
            : ''
        }`}
        ref={containerRef}
      >
        {(isPlanLoading || (activePlan && !planImage)) && (
          <div className="loading-overlay" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <strong>Chargement du plan…</strong>
          </div>
        )}

        {saveMessage && <div className="save-toast">{saveMessage}</div>}

        {pendingConnectionOutput && (
          <div className="connection-hint" role="status">
            {pendingConnectionOutput.kind === 'apparatus-chain'
              ? 'Sélectionnez l’appareillage à ajouter au circuit'
              : pendingConnectionOutput.targetType === 'electrical-panel'
              ? `Sélectionnez le tableau électrique à connecter à la sortie ${pendingConnectionOutput.outputNumber}`
              : `Sélectionnez l’appareillage à connecter à la sortie ${pendingConnectionOutput.outputNumber}`}
          </div>
        )}

        {!activePlan && (
          <div className="empty-state">
            <strong>Importez un plan pour commencer.</strong>
            <span>PNG et JPG/JPEG sont pris en charge dans cette première version.</span>
          </div>
        )}

        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={canDragViewport(activeTool, project.drawing.movementLocked, isDraggingDuctHandle)}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          className={
            activeTool === 'pan' && project.drawing.movementLocked
              ? 'canvas-pan-locked'
              : activeTool === 'pan'
              ? 'canvas-pan'
              : activeTool === 'place-electrical-panel' ||
                  activeTool === 'place-octopus' ||
                  activeTool === 'place-apparatus' ||
                  activeTool === 'connect-target'
                ? 'canvas-place'
                : 'canvas-crosshair'
          }
        >
          <Layer>
            {planImage && activePlan && isPlanEffectivelyVisible(project, activePlan) && (
              <>
                <Rect
                  x={-40}
                  y={-40}
                  width={(activePlan.width ?? 0) + 80}
                  height={(activePlan.height ?? 0) + 80}
                  fill="#f7f5ef"
                  opacity={activePlan.opacity}
                  listening={false}
                />
                <KonvaImage
                  image={planImage}
                  x={(activePlan.width ?? 0) / 2}
                  y={(activePlan.height ?? 0) / 2}
                  offsetX={(activePlan.width ?? 0) / 2}
                  offsetY={(activePlan.height ?? 0) / 2}
                  width={activePlan.width ?? planImage.naturalWidth}
                  height={activePlan.height ?? planImage.naturalHeight}
                  opacity={activePlan.opacity}
                  rotation={activePlan.rotation}
                  listening={false}
                />
              </>
            )}
          </Layer>

          <Layer>
            {project.drawing.scaleReference && project.drawing.scaleMarkerVisible && (
              <ReferenceLine
                start={project.drawing.scaleReference.start}
                end={project.drawing.scaleReference.end}
                label={`${project.drawing.scaleReference.realMeters.toFixed(2)} m`}
                scale={viewport.scale}
                color="#0f766e"
              />
            )}

            {temporaryMeasurement && (
              <MeasurementLine
                measurement={temporaryMeasurement}
                metersPerPixel={project.drawing.metersPerPixel}
                scale={viewport.scale}
              />
            )}

            {activeDraftLine && (
              <ReferenceLine
                start={activeDraftLine.start}
                end={activeDraftLine.end}
                label={
                  activeTool === 'measure'
                    ? formatMeters(
                        measurementMeters(
                          { start: activeDraftLine.start, end: activeDraftLine.end },
                          project.drawing.metersPerPixel,
                        ),
                      )
                    : `${pixelDistance(activeDraftLine.start, activeDraftLine.end).toFixed(0)} px`
                }
                scale={viewport.scale}
                color={activeTool === 'measure' ? '#b45309' : '#2563eb'}
                dash={[8 / viewport.scale, 6 / viewport.scale]}
              />
            )}
          </Layer>

          <Layer>
            {project.ducts.map((duct) => (
              <DuctNode
                key={duct.id}
                duct={duct}
                project={project}
                octopuses={project.octopuses}
                apparatus={project.apparatus}
                electricalPanel={project.electricalPanel}
                metersPerPixel={project.drawing.metersPerPixel}
                viewportScale={viewport.scale}
                selected={selectedObjectId === duct.id}
                selectedWaypointId={selectedDuctWaypointId}
                selectedControlId={selectedDuctControlId}
                movementLocked={project.drawing.movementLocked}
                onHandlePointerDown={() => {
                  if (!project.drawing.movementLocked && !duct.locked) {
                    setIsDraggingDuctHandle(true);
                  }
                }}
                onHandlePointerUp={() => setIsDraggingDuctHandle(false)}
                onSelect={() => {
                  setSelectedObjectId(duct.id);
                  setSelectedDuctWaypointId(null);
                  setSelectedDuctControlId(null);
                  setIsPropertiesPanelOpen(true);
                }}
                onAddWaypoint={(position) => addDuctWaypoint(duct.id, position)}
                onSelectWaypoint={(waypointId) => {
                  setSelectedObjectId(duct.id);
                  setSelectedDuctWaypointId(waypointId);
                  setSelectedDuctControlId(null);
                  setIsPropertiesPanelOpen(true);
                }}
                onSelectControl={(controlId) => {
                  setSelectedObjectId(duct.id);
                  setSelectedDuctControlId(controlId);
                  setSelectedDuctWaypointId(null);
                  setIsPropertiesPanelOpen(true);
                }}
                onWaypointDragStart={(waypointId, position) => {
                  setIsDraggingDuctHandle(true);
                  ductWaypointDragStart.current = { ductId: duct.id, waypointId, position };
                }}
                onWaypointDragEnd={(waypointId, position) => {
                  const initialDrag = ductWaypointDragStart.current;
                  ductWaypointDragStart.current = null;
                  setIsDraggingDuctHandle(false);
                  if (
                    !initialDrag ||
                    initialDrag.ductId !== duct.id ||
                    initialDrag.waypointId !== waypointId ||
                    (initialDrag.position.x === position.x && initialDrag.position.y === position.y)
                  ) {
                    return;
                  }

                  commandManager.execute(
                    createMoveDuctWaypointCommand(
                      project,
                      duct.id,
                      waypointId,
                      initialDrag.position,
                      position,
                      commandManager.setProject.bind(commandManager),
                    ),
                  );
                }}
                onControlDragStart={(controlId, position) => {
                  setIsDraggingDuctHandle(true);
                  ductControlDragStart.current = { ductId: duct.id, controlId, position };
                }}
                onControlDragEnd={(controlId, position) => {
                  const initialDrag = ductControlDragStart.current;
                  ductControlDragStart.current = null;
                  setIsDraggingDuctHandle(false);
                  if (
                    !initialDrag ||
                    initialDrag.ductId !== duct.id ||
                    initialDrag.controlId !== controlId ||
                    (initialDrag.position.x === position.x && initialDrag.position.y === position.y)
                  ) {
                    return;
                  }

                  commandManager.execute(
                    createMoveDuctControlCommand(
                      project,
                      duct.id,
                      controlId,
                      initialDrag.position,
                      position,
                      commandManager.setProject.bind(commandManager),
                    ),
                  );
                }}
              />
            ))}
          </Layer>

          <Layer>
            {project.octopuses.map((octopus) => (
              <OctopusNode
                key={octopus.id}
                octopus={octopus}
                effectivelyVisible={isOctopusEffectivelyVisible(project, octopus)}
                logoImage={octopusLogoImages[octopus.modelId]}
                metersPerPixel={project.drawing.metersPerPixel}
                viewportScale={viewport.scale}
                selected={selectedObjectId === octopus.id}
                movementLocked={project.drawing.movementLocked}
                onSelect={() => {
                  setSelectedObjectId(octopus.id);
                  setIsPropertiesPanelOpen(true);
                }}
                onDragStart={() => {
                  octopusDragStart.current = {
                    id: octopus.id,
                    position: { x: octopus.x, y: octopus.y },
                  };
                }}
                onDragEnd={(position) => {
                  const initialDrag = octopusDragStart.current;
                  octopusDragStart.current = null;
                  if (
                    !initialDrag ||
                    initialDrag.id !== octopus.id ||
                    (initialDrag.position.x === position.x && initialDrag.position.y === position.y)
                  ) {
                    return;
                  }

                  commandManager.execute(
                    createMoveOctopusCommand(
                      project,
                      octopus.id,
                      initialDrag.position,
                      position,
                      commandManager.setProject.bind(commandManager),
                    ),
                  );
                }}
              />
            ))}
            {project.apparatus.map((apparatus) => {
              const pendingOctopus = pendingConnectionOutput?.kind === 'octopus-output'
                ? project.octopuses.find((octopus) => octopus.id === pendingConnectionOutput.octopusId)
                : null;
              const pendingOutput = pendingOctopus
                ? getEffectiveOctopusOutput(
                    pendingOctopus,
                    pendingConnectionOutput?.kind === 'octopus-output' ? pendingConnectionOutput.outputNumber : 0,
                  )
                : undefined;
              const pendingSourceDuct = pendingConnectionOutput?.kind === 'apparatus-chain'
                ? getIncomingDuctForApparatus(project, pendingConnectionOutput.apparatusId)
                : undefined;
              const pendingChainExpectedType = pendingSourceDuct ? getCircuitExpectedApparatusType(pendingSourceDuct) : null;
              const connectionCompatible =
                activeTool !== 'connect-target' ||
                (pendingConnectionOutput?.kind === 'octopus-output' &&
                  pendingConnectionOutput.targetType === 'apparatus' &&
                  pendingOutput !== undefined &&
                  isApparatusCompatibleWithOutputCode(apparatus.catalogId, pendingOutput.code)) ||
                (pendingConnectionOutput?.kind === 'apparatus-chain' &&
                  pendingChainExpectedType !== null &&
                  getApparatusCatalogItem(apparatus.catalogId).type === pendingChainExpectedType &&
                  apparatus.id !== pendingConnectionOutput.apparatusId);

              return (
                <ApparatusNode
                  key={apparatus.id}
                  apparatus={apparatus}
                  effectivelyVisible={isApparatusEffectivelyVisible(project, apparatus)}
                  metersPerPixel={project.drawing.metersPerPixel}
                  viewportScale={viewport.scale}
                  apparatusGlobalScale={project.drawing.apparatusGlobalScale}
                  visibleBounds={getVisibleWorldBounds(viewport, containerSize.width, containerSize.height)}
                  selected={selectedObjectId === apparatus.id}
                  connectionTargetMode={activeTool === 'connect-target'}
                  connectionCompatible={connectionCompatible}
                  movementLocked={project.drawing.movementLocked}
                  onSelect={() => {
                    if (activeTool === 'connect-target') {
                      completeConnection('apparatus', apparatus.id);
                      return;
                    }

                    setSelectedObjectId(apparatus.id);
                    setIsPropertiesPanelOpen(true);
                  }}
                  onDragStart={() => {
                    apparatusDragStart.current = {
                      id: apparatus.id,
                      position: { x: apparatus.x, y: apparatus.y },
                    };
                  }}
                  onDragEnd={(position) => {
                    const initialDrag = apparatusDragStart.current;
                    apparatusDragStart.current = null;
                    if (
                      !initialDrag ||
                      initialDrag.id !== apparatus.id ||
                      (initialDrag.position.x === position.x && initialDrag.position.y === position.y)
                    ) {
                      return;
                    }

                    commandManager.execute(
                      createMoveApparatusCommand(
                        project,
                        apparatus.id,
                        initialDrag.position,
                        position,
                        commandManager.setProject.bind(commandManager),
                      ),
                    );
                  }}
                />
              );
            })}
            {project.electricalPanel && project.drawing.metersPerPixel !== null && (
              <ElectricalPanelNode
                electricalPanel={project.electricalPanel}
                effectivelyVisible={isElectricalPanelEffectivelyVisible(project, project.electricalPanel)}
                metersPerPixel={project.drawing.metersPerPixel}
                viewportScale={viewport.scale}
                selected={selectedObjectId === project.electricalPanel.id}
                movementLocked={project.drawing.movementLocked}
                onSelect={() => {
                  if (activeTool === 'connect-target') {
                    completeConnection('electrical-panel', project.electricalPanel?.id ?? '');
                    return;
                  }

                  setSelectedObjectId(project.electricalPanel?.id ?? null);
                  setIsPropertiesPanelOpen(true);
                }}
                onDragStart={() => {
                  if (project.electricalPanel) {
                    panelDragStart.current = {
                      x: project.electricalPanel.x,
                      y: project.electricalPanel.y,
                    };
                  }
                }}
                onDragEnd={(position) => {
                  const initialPosition = panelDragStart.current;
                  panelDragStart.current = null;
                  if (
                    !initialPosition ||
                    !project.electricalPanel ||
                    (initialPosition.x === position.x && initialPosition.y === position.y)
                  ) {
                    return;
                  }

                  commandManager.execute(
                    createMoveElectricalPanelCommand(
                      project,
                      initialPosition,
                      position,
                      commandManager.setProject.bind(commandManager),
                    ),
                  );
                }}
              />
            )}
          </Layer>
        </Stage>

        <PropertiesPanel
          selectedObject={isPropertiesPanelOpen ? selectedBusinessObject : null}
          selectedDuct={isPropertiesPanelOpen ? selectedDuct : null}
          selectedDuctControlId={selectedDuctControlId}
          octopuses={project.octopuses}
          apparatus={project.apparatus}
          electricalPanel={project.electricalPanel}
          ducts={project.ducts}
          metersPerPixel={project.drawing.metersPerPixel}
          pendingConnectionOutput={pendingConnectionOutput}
          onClose={() => setIsPropertiesPanelOpen(false)}
          onUpdateElectricalPanel={updateElectricalPanel}
          onDeleteElectricalPanel={deleteElectricalPanel}
          onUpdateOctopus={updateOctopus}
          onUpdateOctopusOutputOverride={updateOctopusOutputOverride}
          onResetOctopusOutputOverride={resetOctopusOutputOverride}
          onDeleteOctopus={deleteOctopus}
          onUpdateApparatus={updateApparatus}
          onDeleteApparatus={deleteApparatus}
          onStartConnection={startConnection}
          onStartApparatusConnection={startApparatusChainConnection}
          onCreateDirectPanelConnection={createDirectPanelConnection}
          onAddDuctWaypoint={addDuctWaypoint}
          onResetDuctControl={resetDuctControl}
          onDeleteDuct={deleteDuct}
        />
      </main>
    </div>
  );
}

interface ElectricalPanelNodeProps {
  electricalPanel: ElectricalPanel;
  effectivelyVisible: boolean;
  metersPerPixel: number;
  viewportScale: number;
  selected: boolean;
  movementLocked: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: (position: Point) => void;
}

interface OctopusNodeProps {
  octopus: Octopus;
  effectivelyVisible: boolean;
  logoImage: HTMLImageElement | null;
  metersPerPixel: number | null;
  viewportScale: number;
  selected: boolean;
  movementLocked: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: (position: Point) => void;
}

function OctopusNode({
  octopus,
  effectivelyVisible,
  logoImage,
  metersPerPixel,
  viewportScale,
  selected,
  movementLocked,
  onSelect,
  onDragStart,
  onDragEnd,
}: OctopusNodeProps) {
  if (!effectivelyVisible || metersPerPixel === null) {
    return null;
  }

  const { width: physicalWidth, height: physicalHeight } = getOctopusPixelSize(metersPerPixel);
  const displayScale = octopus.displayScale ?? 1;
  const width = physicalWidth * displayScale;
  const height = physicalHeight * displayScale;
  const displayLevel = getOctopusDisplayLevel(viewportScale);
  const showPorts = displayLevel !== 'icon';
  const showPortNumbers = displayLevel === 'detailed';
  const model = OCTOPUS_MODELS[octopus.modelId];
  const logoBoxSize = Math.max(Math.min(width, height) * 0.62, 18 / viewportScale);
  const logoRatio = logoImage ? logoImage.naturalWidth / logoImage.naturalHeight : 1;
  const logoWidth = logoRatio >= 1 ? logoBoxSize : logoBoxSize * logoRatio;
  const logoHeight = logoRatio >= 1 ? logoBoxSize / logoRatio : logoBoxSize;
  const portRadius = Math.max(3 / viewportScale, Math.min(width, height) * 0.035);

  return (
    <Group
      x={octopus.x}
      y={octopus.y}
      rotation={octopus.rotation}
      draggable={canDragBusinessObject(octopus.locked, movementLocked)}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onDragStart();
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        onDragEnd({ x: event.target.x(), y: event.target.y() });
      }}
    >
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        cornerRadius={Math.min(width, height) * 0.06}
        fill="#ffffff"
        stroke={model.color}
        strokeWidth={Math.max(1.5 / viewportScale, 0.5)}
        listening
      />

      {logoImage && (
        <KonvaImage
          image={logoImage}
          x={-logoWidth / 2}
          y={-logoHeight / 2}
          width={logoWidth}
          height={logoHeight}
          listening={false}
        />
      )}

      {showPorts &&
        octopus.ports.map((port) => {
          const position = getOctopusPortLocalPosition(port, width, height);
          const labelOffset = 12 / viewportScale;
          const labelX =
            port.side === 'left'
              ? position.x - 30 / viewportScale
              : port.side === 'right'
                ? position.x + 8 / viewportScale
                : position.x - 10 / viewportScale;
          const labelY =
            port.side === 'top'
              ? position.y - labelOffset - 8 / viewportScale
              : port.side === 'bottom'
                ? position.y + labelOffset - 4 / viewportScale
                : position.y - 7 / viewportScale;

          return (
            <Group key={port.number}>
              <Rect
                x={position.x - portRadius}
                y={position.y - portRadius}
                width={portRadius * 2}
                height={portRadius * 2}
                cornerRadius={portRadius}
                fill="#ffffff"
                stroke={model.color}
                strokeWidth={1.2 / viewportScale}
                listening={false}
              />
              {showPortNumbers && (
                <Text
                  x={labelX}
                  y={labelY}
                  width={20 / viewportScale}
                  align="center"
                  text={String(port.number)}
                  fontSize={10 / viewportScale}
                  fontFamily="Inter, Arial, sans-serif"
                  fill="#111827"
                  listening={false}
                />
              )}
            </Group>
          );
        })}

      {selected && (
        <Rect
          x={-width / 2 - 5 / viewportScale}
          y={-height / 2 - 5 / viewportScale}
          width={width + 10 / viewportScale}
          height={height + 10 / viewportScale}
          cornerRadius={Math.min(width, height) * 0.08}
          stroke="#2563eb"
          strokeWidth={2 / viewportScale}
          dash={[8 / viewportScale, 5 / viewportScale]}
          listening={false}
        />
      )}
    </Group>
  );
}

interface ApparatusNodeProps {
  apparatus: ApparatusInstance;
  effectivelyVisible: boolean;
  metersPerPixel: number | null;
  viewportScale: number;
  apparatusGlobalScale: number;
  visibleBounds: ApparatusVisibleBounds;
  selected: boolean;
  connectionTargetMode: boolean;
  connectionCompatible: boolean;
  movementLocked: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: (position: Point) => void;
}

interface DuctNodeProps {
  duct: Duct;
  project: CpreyDrawProject;
  octopuses: Octopus[];
  apparatus: ApparatusInstance[];
  electricalPanel: ElectricalPanel | undefined;
  metersPerPixel: number | null;
  viewportScale: number;
  selected: boolean;
  selectedWaypointId: string | null;
  selectedControlId: string | null;
  movementLocked: boolean;
  onHandlePointerDown: () => void;
  onHandlePointerUp: () => void;
  onSelect: () => void;
  onAddWaypoint: (position: Point) => void;
  onSelectWaypoint: (waypointId: string) => void;
  onSelectControl: (controlId: string) => void;
  onWaypointDragStart: (waypointId: string, position: Point) => void;
  onWaypointDragEnd: (waypointId: string, position: Point) => void;
  onControlDragStart: (controlId: string, position: Point) => void;
  onControlDragEnd: (controlId: string, position: Point) => void;
}

function DuctNode({
  duct,
  project,
  octopuses,
  apparatus,
  electricalPanel,
  metersPerPixel,
  viewportScale,
  selected,
  selectedWaypointId,
  selectedControlId,
  movementLocked,
  onHandlePointerDown,
  onHandlePointerUp,
  onSelect,
  onAddWaypoint,
  onSelectWaypoint,
  onSelectControl,
  onWaypointDragStart,
  onWaypointDragEnd,
  onControlDragStart,
  onControlDragEnd,
}: DuctNodeProps) {
  const pathPoints = getDuctPathPoints(duct, octopuses, apparatus, electricalPanel, metersPerPixel);

  if (!isDuctEffectivelyVisible(project, duct) || pathPoints.length < 2) {
    return null;
  }

  const color = getLinkColorCss(duct.specification.linkColor);
  const strokeWidth = selected ? 4 / viewportScale : 2.5 / viewportScale;
  const controls = normalizeDuctControlsForPoints(pathPoints, duct.controls);
  const usedLengthMeters = calculateDuctUsedLengthMeters(pathPoints, metersPerPixel, controls);
  const lengthStatus = calculateDuctLengthStatus(duct.specification.availableLengthMeters, usedLengthMeters);
  const quadraticGeometry = buildQuadraticDuctGeometry(pathPoints, controls, metersPerPixel);
  const labelPoint = quadraticGeometry?.labelPoint ?? pathPoints[Math.floor(pathPoints.length / 2)];
  const canDragHandle = canDragBusinessObject(duct.locked, movementLocked);
  const handleHitRadius = 13 / viewportScale;

  return (
    <Group>
      {lengthStatus.hasOverrun && quadraticGeometry && (
        <Path
          data={quadraticGeometry.pathData}
          stroke="#dc2626"
          strokeWidth={(strokeWidth + 5 / viewportScale)}
          lineCap="round"
          lineJoin="round"
          opacity={0.28}
          listening={false}
        />
      )}
      {quadraticGeometry && (
        <Path
          data={quadraticGeometry.pathData}
          stroke={color}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(12 / viewportScale, strokeWidth)}
          shadowColor={selected ? '#2563eb' : undefined}
          shadowBlur={selected ? 6 / viewportScale : 0}
          shadowOpacity={selected ? 0.45 : 0}
          onClick={(event) => {
            event.cancelBubble = true;
            onSelect();
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            onSelect();
          }}
          onDblClick={(event) => {
            event.cancelBubble = true;
            const stage = event.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (!pointer) {
              return;
            }
            onAddWaypoint(viewportPointToWorld(pointer, {
              x: stage?.x() ?? 0,
              y: stage?.y() ?? 0,
              scale: stage?.scaleX() ?? 1,
            }));
          }}
        />
      )}
      {usedLengthMeters !== null && (
        <Text
          x={labelPoint.x + 8 / viewportScale}
          y={labelPoint.y - 18 / viewportScale}
          text={`${usedLengthMeters.toFixed(2).replace('.', ',')} m`}
          fontSize={12 / viewportScale}
          fontFamily="Inter, Arial, sans-serif"
          fill={lengthStatus.hasOverrun ? '#b91c1c' : '#111827'}
          padding={3 / viewportScale}
          listening={false}
        />
      )}
      {selected &&
        controls.map((control) => (
          <Group
            key={control.id}
            x={control.x}
            y={control.y}
            draggable={canDragHandle}
            onPointerDown={(event) => {
              event.cancelBubble = true;
              onHandlePointerDown();
            }}
            onMouseDown={(event) => {
              event.cancelBubble = true;
              onHandlePointerDown();
            }}
            onTouchStart={(event) => {
              event.cancelBubble = true;
              onHandlePointerDown();
            }}
            onPointerUp={(event) => {
              event.cancelBubble = true;
              onHandlePointerUp();
            }}
            onMouseUp={(event) => {
              event.cancelBubble = true;
              onHandlePointerUp();
            }}
            onTouchEnd={(event) => {
              event.cancelBubble = true;
              onHandlePointerUp();
            }}
            onClick={(event) => {
              event.cancelBubble = true;
              onSelectControl(control.id);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onSelectControl(control.id);
            }}
            onDragStart={(event) => {
              event.cancelBubble = true;
              onControlDragStart(control.id, { x: control.x, y: control.y });
            }}
            onDragMove={(event) => {
              event.cancelBubble = true;
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              onControlDragEnd(control.id, { x: event.target.x(), y: event.target.y() });
            }}
          >
            <Circle radius={handleHitRadius} fill="#ffffff" opacity={0.01} strokeEnabled={false} />
            <Circle
              radius={selectedControlId === control.id ? 5 / viewportScale : 4 / viewportScale}
              fill="#ffffff"
              stroke={selectedControlId === control.id ? '#7c3aed' : '#6d28d9'}
              strokeWidth={1.5 / viewportScale}
              dash={[2 / viewportScale, 2 / viewportScale]}
              listening={false}
            />
          </Group>
        ))}
      {selected &&
        duct.waypoints.map((waypoint) => (
          <Group
            key={waypoint.id}
            x={waypoint.x}
            y={waypoint.y}
            draggable={canDragHandle}
            onPointerDown={(event) => {
              event.cancelBubble = true;
              onHandlePointerDown();
            }}
            onMouseDown={(event) => {
              event.cancelBubble = true;
              onHandlePointerDown();
            }}
            onTouchStart={(event) => {
              event.cancelBubble = true;
              onHandlePointerDown();
            }}
            onPointerUp={(event) => {
              event.cancelBubble = true;
              onHandlePointerUp();
            }}
            onMouseUp={(event) => {
              event.cancelBubble = true;
              onHandlePointerUp();
            }}
            onTouchEnd={(event) => {
              event.cancelBubble = true;
              onHandlePointerUp();
            }}
            onClick={(event) => {
              event.cancelBubble = true;
              onSelectWaypoint(waypoint.id);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onSelectWaypoint(waypoint.id);
            }}
            onDragStart={(event) => {
              event.cancelBubble = true;
              onWaypointDragStart(waypoint.id, { x: waypoint.x, y: waypoint.y });
            }}
            onDragMove={(event) => {
              event.cancelBubble = true;
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              onWaypointDragEnd(waypoint.id, { x: event.target.x(), y: event.target.y() });
            }}
          >
            <Circle radius={handleHitRadius} fill="#ffffff" opacity={0.01} strokeEnabled={false} />
            <Circle
              radius={selectedWaypointId === waypoint.id ? 6 / viewportScale : 5 / viewportScale}
              fill="#ffffff"
              stroke={selectedWaypointId === waypoint.id ? '#dc2626' : '#2563eb'}
              strokeWidth={2 / viewportScale}
              listening={false}
            />
          </Group>
        ))}
    </Group>
  );
}

function ApparatusNode({
  apparatus,
  effectivelyVisible,
  metersPerPixel,
  viewportScale,
  apparatusGlobalScale,
  visibleBounds,
  selected,
  connectionTargetMode,
  connectionCompatible,
  movementLocked,
  onSelect,
  onDragStart,
  onDragEnd,
}: ApparatusNodeProps) {
  const assetUrl = getApparatusAssetUrl(apparatus.catalogId, apparatus.connected);
  const iconImage = useHtmlImage(assetUrl);

  if (!effectivelyVisible || metersPerPixel === null || !iconImage) {
    return null;
  }

  const { width, height } = getApparatusPixelSize(
    metersPerPixel,
    apparatus.displayScale,
    apparatusGlobalScale,
  );
  const displayLevel = getObjectDisplayLevel(viewportScale);
  const showLabel = displayLevel !== 'icon';
  const labelFontSize = apparatus.labelFontSize;
  const labelGap = Math.max(width * 0.18, 6);
  const labelSize = estimateApparatusLabelSize(apparatus.identifier, labelFontSize);
  const labelPlacement = getApparatusLabelPlacement({
    center: { x: apparatus.x, y: apparatus.y },
    iconWidth: width,
    iconHeight: height,
    labelWidth: labelSize.width,
    labelHeight: labelSize.height,
    visibleBounds,
    gap: labelGap,
    overrideSide: apparatus.labelPosition,
  });

  return (
    <Group
      x={apparatus.x}
      y={apparatus.y}
      opacity={connectionTargetMode && !connectionCompatible ? 0.38 : 1}
      draggable={canDragBusinessObject(apparatus.locked, movementLocked, connectionTargetMode)}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onDragStart();
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        onDragEnd({ x: event.target.x(), y: event.target.y() });
      }}
    >
      <Group rotation={apparatus.rotation}>
        {selected && (
          <Rect
            x={-width / 2 - 5 / viewportScale}
            y={-height / 2 - 5 / viewportScale}
            width={width + 10 / viewportScale}
            height={height + 10 / viewportScale}
            cornerRadius={4 / viewportScale}
            stroke="#2563eb"
            strokeWidth={1.5 / viewportScale}
            dash={[5 / viewportScale, 4 / viewportScale]}
            listening={false}
          />
        )}
        <KonvaImage
          image={iconImage}
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          listening
        />
      </Group>
      {showLabel && (
        <Text
          x={labelPlacement.x - apparatus.x}
          y={labelPlacement.y - apparatus.y}
          width={labelPlacement.width}
          height={labelPlacement.height}
          align={labelPlacement.align}
          verticalAlign="middle"
          text={apparatus.identifier}
          fontSize={labelFontSize}
          fontFamily="Inter, Arial, sans-serif"
          fill="#1f2937"
          listening={false}
        />
      )}
    </Group>
  );
}

function ElectricalPanelNode({
  electricalPanel,
  effectivelyVisible,
  metersPerPixel,
  viewportScale,
  selected,
  movementLocked,
  onSelect,
  onDragStart,
  onDragEnd,
}: ElectricalPanelNodeProps) {
  if (!effectivelyVisible) {
    return null;
  }

  const { width, height } = getElectricalPanelPixelSize(metersPerPixel);
  const displayLevel = getObjectDisplayLevel(viewportScale);
  const iconWorldSize = Math.max(Math.min(width, height) * 0.78, 18 / viewportScale);
  const iconScale = iconWorldSize / 24;
  const showShape = displayLevel !== 'icon';
  const showName = displayLevel === 'detailed';

  return (
    <Group
      x={electricalPanel.x}
      y={electricalPanel.y}
      rotation={electricalPanel.rotation}
      draggable={canDragBusinessObject(electricalPanel.locked, movementLocked)}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onDragStart();
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        onDragEnd({ x: event.target.x(), y: event.target.y() });
      }}
    >
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={showShape ? '#d9dee5' : 'transparent'}
        stroke={showShape ? '#111827' : 'transparent'}
        strokeWidth={Math.max(1 / viewportScale, 0.5)}
        listening
      />
      <Path
        data={LIGHTNING_PATH}
        x={-12 * iconScale}
        y={-12 * iconScale}
        scaleX={iconScale}
        scaleY={iconScale}
        fill="#111111"
        listening={false}
      />
      {selected && (
        <Rect
          x={-width / 2 - 5 / viewportScale}
          y={-height / 2 - 5 / viewportScale}
          width={width + 10 / viewportScale}
          height={height + 10 / viewportScale}
          stroke="#2563eb"
          strokeWidth={2 / viewportScale}
          dash={[8 / viewportScale, 5 / viewportScale]}
          listening={false}
        />
      )}
      {showName && (
        <Text
          x={-80 / viewportScale}
          y={height / 2 + 8 / viewportScale}
          width={160 / viewportScale}
          align="center"
          text={electricalPanel.name}
          fontSize={13 / viewportScale}
          fontFamily="Inter, Arial, sans-serif"
          fill="#111827"
          listening={false}
        />
      )}
    </Group>
  );
}

interface ReferenceLineProps {
  start: Point;
  end: Point;
  label: string;
  scale: number;
  color: string;
  dash?: number[];
}

function ReferenceLine({ start, end, label, scale, color, dash }: ReferenceLineProps) {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <>
      <Line points={linePoints(start, end)} stroke={color} strokeWidth={2 / scale} dash={dash} />
      <Text
        x={midX + 8 / scale}
        y={midY - 24 / scale}
        text={label}
        fontSize={14 / scale}
        fontFamily="Inter, Arial, sans-serif"
        fill={color}
        padding={4 / scale}
      />
    </>
  );
}

interface MeasurementLineProps {
  measurement: Measurement;
  metersPerPixel: number | null;
  scale: number;
}

function MeasurementLine({ measurement, metersPerPixel, scale }: MeasurementLineProps) {
  return (
    <ReferenceLine
      start={measurement.start}
      end={measurement.end}
      label={formatMeters(measurementMeters(measurement, metersPerPixel))}
      scale={scale}
      color="#b45309"
    />
  );
}
