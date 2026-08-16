import {
  createDuct,
  getDuctGeometry,
  getLinkColorCss,
  isPowerSupplyOutputDestination,
  LINK_COLOR_CSS,
  type DuctResult,
} from './ducts';

export {
  getLinkColorCss,
  isPowerSupplyOutputDestination,
  LINK_COLOR_CSS,
};

export type ConnectionResult = DuctResult;
export const createConnection = createDuct;
export const getConnectionGeometry = getDuctGeometry;
