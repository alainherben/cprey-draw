export type ObjectDisplayLevel = 'icon' | 'shape' | 'detailed';

export function getObjectDisplayLevel(zoom: number): ObjectDisplayLevel {
  if (zoom < 0.35) {
    return 'icon';
  }

  if (zoom < 1.2) {
    return 'shape';
  }

  return 'detailed';
}

export function getOctopusDisplayLevel(zoom: number): ObjectDisplayLevel {
  if (zoom < 0.7) {
    return 'icon';
  }

  if (zoom < 1.4) {
    return 'shape';
  }

  return 'detailed';
}
