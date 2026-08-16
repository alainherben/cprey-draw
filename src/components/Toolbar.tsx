import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getApparatusCatalogMenuItems } from '../catalog/apparatus';
import type { ApparatusCatalogId, DrawingLayer, OctopusModelId, Plan, ToolMode } from '../types/project';

type MenuId = 'project' | 'plan' | 'insert' | 'view' | 'layers' | 'measure' | 'history';

interface ToolbarProps {
  activeTool: ToolMode;
  activePlan: Plan | null;
  canUndo: boolean;
  canRedo: boolean;
  isPlanLoading: boolean;
  metersPerPixel: number | null;
  hasElectricalPanel: boolean;
  hasTemporaryMeasurement: boolean;
  wheelZoomEnabled: boolean;
  movementLocked: boolean;
  hasScaleReference: boolean;
  scaleMarkerVisible: boolean;
  layers: DrawingLayer[];
  onImportPlan: (file: File) => void;
  onFitToScreen: () => void;
  onToggleWheelZoom: () => void;
  onToggleMovementLocked: () => void;
  onToggleScaleMarkerVisible: () => void;
  onToggleLayerVisible: (layerId: string, visible: boolean) => void;
  onSaveProject: () => void;
  onOpenNomenclature: () => void;
  onStartElectricalPanelPlacement: () => void;
  onStartOctopusPlacement: (modelId: OctopusModelId) => void;
  onStartApparatusPlacement: (catalogId: ApparatusCatalogId) => void;
  onClearTemporaryMeasurement: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectTool: (tool: ToolMode) => void;
  onDeletePlan: () => void;
  onTogglePlanVisible: () => void;
  onTogglePlanLocked: () => void;
  onChangePlanOpacity: (opacity: number) => void;
  onChangePlanRotation: (rotation: number) => void;
}

export function Toolbar({
  activeTool,
  activePlan,
  canUndo,
  canRedo,
  isPlanLoading,
  metersPerPixel,
  hasElectricalPanel,
  hasTemporaryMeasurement,
  wheelZoomEnabled,
  movementLocked,
  hasScaleReference,
  scaleMarkerVisible,
  layers,
  onImportPlan,
  onFitToScreen,
  onToggleWheelZoom,
  onToggleMovementLocked,
  onToggleScaleMarkerVisible,
  onToggleLayerVisible,
  onSaveProject,
  onOpenNomenclature,
  onStartElectricalPanelPlacement,
  onStartOctopusPlacement,
  onStartApparatusPlacement,
  onClearTemporaryMeasurement,
  onUndo,
  onRedo,
  onSelectTool,
  onDeletePlan,
  onTogglePlanVisible,
  onTogglePlanLocked,
  onChangePlanOpacity,
  onChangePlanRotation,
}: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const hasPlan = activePlan !== null;
  const apparatusMenuItems = getApparatusCatalogMenuItems();

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const runAndClose = (action: () => void) => {
    action();
    setOpenMenu(null);
  };

  return (
    <header className="toolbar" ref={toolbarRef}>
      <div className="brand">
        <span className="brand-mark">CP</span>
        <div>
          <h1>CPREY DRAW</h1>
          <p>Socle de dessin</p>
        </div>
      </div>

      <nav className="menu-bar" aria-label="Menus CPREY DRAW">
        <MenuButton
          id="project"
          label="Projet"
          openMenu={openMenu}
          onToggle={setOpenMenu}
        >
          <MenuItem label="Sauvegarder" onSelect={() => runAndClose(onSaveProject)} />
          <MenuItem label="Nomenclature" onSelect={() => runAndClose(onOpenNomenclature)} />
        </MenuButton>

        <MenuButton id="plan" label="Plan" openMenu={openMenu} onToggle={setOpenMenu}>
          <FileMenuItem
            label={hasPlan ? 'Remplacer le plan' : 'Importer le plan'}
            disabled={isPlanLoading}
            onImportPlan={(file) => {
              onImportPlan(file);
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Supprimer le plan"
            disabled={!activePlan || activePlan.locked || isPlanLoading}
            onSelect={() => runAndClose(onDeletePlan)}
          />
          <MenuItem
            label={activePlan?.visible === false ? 'Afficher le plan' : 'Masquer le plan'}
            disabled={!activePlan || activePlan.locked || isPlanLoading}
            onSelect={() => runAndClose(onTogglePlanVisible)}
          />
          <MenuItem
            label={activePlan?.locked ? 'Déverrouiller le plan' : 'Verrouiller le plan'}
            disabled={!activePlan || isPlanLoading}
            onSelect={() => runAndClose(onTogglePlanLocked)}
          />
          <div className="menu-separator" />
          <label className="menu-control">
            <span>Opacité</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={activePlan?.opacity ?? 1}
              disabled={!activePlan || activePlan.locked || isPlanLoading}
              onChange={(event) => onChangePlanOpacity(Number(event.currentTarget.value))}
            />
          </label>
          <label className="menu-control">
            <span>Rotation</span>
            <input
              type="number"
              min="-360"
              max="360"
              step="1"
              value={activePlan?.rotation ?? 0}
              disabled={!activePlan || activePlan.locked || isPlanLoading}
              onChange={(event) => onChangePlanRotation(Number(event.currentTarget.value))}
            />
          </label>
        </MenuButton>

        <MenuButton id="insert" label="Insertion" openMenu={openMenu} onToggle={setOpenMenu}>
          <MenuItem
            label={
              hasElectricalPanel
                ? 'Tableau électrique déjà placé'
                : metersPerPixel === null
                  ? "Définissez d'abord l'échelle du plan"
                  : 'Tableau électrique'
            }
            disabled={hasElectricalPanel || metersPerPixel === null}
            onSelect={() => runAndClose(onStartElectricalPanelPlacement)}
          />
          <div className="menu-separator" />
          <MenuItem
            label="Pieuvre Zone Cuisine"
            disabled={metersPerPixel === null}
            onSelect={() => runAndClose(() => onStartOctopusPlacement('kitchen'))}
          />
          <MenuItem
            label="Pieuvre Zone Bain"
            disabled={metersPerPixel === null}
            onSelect={() => runAndClose(() => onStartOctopusPlacement('bath'))}
          />
          <MenuItem
            label="Pieuvre Autre Zone"
            disabled={metersPerPixel === null}
            onSelect={() => runAndClose(() => onStartOctopusPlacement('other'))}
          />
          <MenuItem
            label="Pieuvre Zone Confort"
            disabled={metersPerPixel === null}
            onSelect={() => runAndClose(() => onStartOctopusPlacement('comfort'))}
          />
          <div className="menu-separator" />
          <div className="menu-section-title">Appareillages</div>
          {apparatusMenuItems.map((catalogItem) => (
            <MenuItem
              key={catalogItem.id}
              label={catalogItem.name}
              disabled={metersPerPixel === null}
              onSelect={() => runAndClose(() => onStartApparatusPlacement(catalogItem.id))}
            />
          ))}
        </MenuButton>

        <MenuButton id="view" label="Vue" openMenu={openMenu} onToggle={setOpenMenu}>
          <MenuItem
            label="Ajuster à l'écran"
            disabled={!hasPlan}
            onSelect={() => runAndClose(onFitToScreen)}
          />
          <MenuItem
            label="Déplacer"
            active={activeTool === 'pan'}
            onSelect={() => runAndClose(() => onSelectTool('pan'))}
          />
          <MenuItem
            label={wheelZoomEnabled ? '✓ Zoom avec la molette' : 'Zoom avec la molette'}
            onSelect={() => runAndClose(onToggleWheelZoom)}
          />
          <MenuItem
            label={movementLocked ? 'Déplacements : OFF' : '✓ Déplacements : ON'}
            onSelect={() => runAndClose(onToggleMovementLocked)}
          />
        </MenuButton>

        <MenuButton id="layers" label="Calques" openMenu={openMenu} onToggle={setOpenMenu}>
          {layers.map((layer) => (
            <MenuItem
              key={layer.id}
              label={layer.visible ? `✓ ${layer.name}` : layer.name}
              onSelect={() => runAndClose(() => onToggleLayerVisible(layer.id, !layer.visible))}
            />
          ))}
        </MenuButton>

        <MenuButton id="measure" label="Mesure" openMenu={openMenu} onToggle={setOpenMenu}>
          <MenuItem
            label={metersPerPixel === null ? "Définir l'échelle" : "Modifier l'échelle"}
            active={activeTool === 'scale'}
            disabled={!hasPlan}
            onSelect={() => runAndClose(() => onSelectTool('scale'))}
          />
          <MenuItem
            label="Mesurer"
            active={activeTool === 'measure'}
            disabled={!hasPlan || metersPerPixel === null}
            onSelect={() => runAndClose(() => onSelectTool('measure'))}
          />
          <MenuItem
            label="Effacer la mesure"
            disabled={!hasTemporaryMeasurement && activeTool !== 'measure'}
            onSelect={() => runAndClose(onClearTemporaryMeasurement)}
          />
          <MenuItem
            label={scaleMarkerVisible ? "✓ Afficher le repère d’échelle" : "Afficher le repère d’échelle"}
            disabled={!hasScaleReference}
            onSelect={() => runAndClose(onToggleScaleMarkerVisible)}
          />
        </MenuButton>

        <MenuButton id="history" label="Historique" openMenu={openMenu} onToggle={setOpenMenu}>
          <MenuItem
            label="Annuler"
            shortcut="Cmd+Z"
            disabled={!canUndo}
            onSelect={() => runAndClose(onUndo)}
          />
          <MenuItem
            label="Rétablir"
            shortcut="Cmd+Shift+Z"
            disabled={!canRedo}
            onSelect={() => runAndClose(onRedo)}
          />
        </MenuButton>
      </nav>

      <div className="quick-actions" aria-label="Actions rapides">
        <button
          type="button"
          className={`icon-button ${movementLocked ? 'active' : ''}`}
          onClick={onToggleMovementLocked}
          title="Activer/désactiver le verrouillage des déplacements"
          aria-pressed={movementLocked}
        >
          ⇄
        </button>
        <button
          type="button"
          className={`icon-button ${wheelZoomEnabled ? '' : 'active'}`}
          onClick={onToggleWheelZoom}
          title="Activer/désactiver le zoom avec la molette"
          aria-pressed={!wheelZoomEnabled}
        >
          ⌕
        </button>
        <button type="button" className="icon-button" onClick={onSaveProject} title="Sauvegarder">
          S
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onFitToScreen}
          disabled={!hasPlan}
          title="Ajuster à l'écran"
        >
          ⤢
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler - Cmd+Z"
        >
          ↶
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rétablir - Cmd+Shift+Z"
        >
          ↷
        </button>
      </div>

      <div className="status">
        {metersPerPixel === null
          ? 'Échelle non définie'
          : `Échelle : ${(1 / metersPerPixel).toFixed(1)} px/m`}
      </div>
    </header>
  );
}

interface MenuButtonProps {
  id: MenuId;
  label: string;
  openMenu: MenuId | null;
  onToggle: (menu: MenuId | null) => void;
  children: ReactNode;
}

function MenuButton({ id, label, openMenu, onToggle, children }: MenuButtonProps) {
  const isOpen = openMenu === id;

  return (
    <div className="menu-root">
      <button
        type="button"
        className={`menu-trigger ${isOpen ? 'active' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => onToggle(isOpen ? null : id)}
      >
        {label}
      </button>
      {isOpen && (
        <div className="menu-panel" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

function MenuItem({ label, shortcut, active = false, disabled = false, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`menu-item ${active ? 'active' : ''}`}
      disabled={disabled}
      role="menuitem"
      onClick={onSelect}
    >
      <span>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}

interface FileMenuItemProps {
  label: string;
  disabled: boolean;
  onImportPlan: (file: File) => void;
}

function FileMenuItem({ label, disabled, onImportPlan }: FileMenuItemProps) {
  return (
    <label className={`menu-item file-menu-item ${disabled ? 'disabled' : ''}`} role="menuitem">
      <span>{label}</span>
      <input
        type="file"
        accept="image/png,image/jpeg"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onImportPlan(file);
            event.currentTarget.value = '';
          }
        }}
      />
    </label>
  );
}
