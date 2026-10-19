/**
 * Pure game rules, grid math, and state logic for CyberSerpent 3D.
 * Fully decoupled from UI and WebGL rendering for fast deterministic testing.
 */

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface GridCoord {
  x: number;
  z: number;
}

export type FoodType = 'CYAN_CORE' | 'GOLDEN_SUPERNOVA' | 'PURPLE_CHRONO';

export interface FoodItem {
  id: string;
  x: number;
  z: number;
  type: FoodType;
  points: number;
  spawnTime: number;
  duration?: number; // for temporary items like Supernova
}

export interface HazardPillar {
  id: string;
  x: number;
  z: number;
  state: 'WARNING' | 'ACTIVE';
  warningStartTime: number;
  duration: number;
}

export interface GameConfig {
  gridSize: number; // e.g. 21 (from -10 to +10)
  initialSpeedMs: number;
  minSpeedMs: number;
  speedIncrement: number;
  comboTimeoutMs: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  gridSize: 21,
  initialSpeedMs: 110,
  minSpeedMs: 65,
  speedIncrement: 2,
  comboTimeoutMs: 3200,
};

export const DIFFICULTY_PRESETS = {
  chill: { initialSpeedMs: 140, minSpeedMs: 90, speedIncrement: 1, hazardRate: 0 },
  arcade: { initialSpeedMs: 110, minSpeedMs: 65, speedIncrement: 2, hazardRate: 1 },
  hardcore: { initialSpeedMs: 85, minSpeedMs: 50, speedIncrement: 3, hazardRate: 2 },
};

/**
 * Check if two grid coordinates are identical
 */
export function isSameCoord(a: GridCoord, b: GridCoord): boolean {
  return a.x === b.x && a.z === b.z;
}

/**
 * Check if a coordinate is occupied by any element in an array
 */
export function isOccupied(coord: GridCoord, obstacles: GridCoord[]): boolean {
  return obstacles.some((o) => isSameCoord(o, coord));
}

/**
 * Get opposite direction to prevent instant 180-degree self-reversals
 */
export function isOppositeDirection(dirA: Direction, dirB: Direction): boolean {
  return (
    (dirA === 'UP' && dirB === 'DOWN') ||
    (dirA === 'DOWN' && dirB === 'UP') ||
    (dirA === 'LEFT' && dirB === 'RIGHT') ||
    (dirA === 'RIGHT' && dirB === 'LEFT')
  );
}

/**
 * Get coordinate delta for direction
 * Note: In 3D space, UP moves along -Z, DOWN moves along +Z, LEFT moves along -X, RIGHT moves along +X
 */
export function getDirectionDelta(dir: Direction): GridCoord {
  switch (dir) {
    case 'UP':
      return { x: 0, z: -1 };
    case 'DOWN':
      return { x: 0, z: 1 };
    case 'LEFT':
      return { x: -1, z: 0 };
    case 'RIGHT':
      return { x: 1, z: 0 };
  }
}

/**
 * Compute relative turn (e.g. for chase camera mode where A/D or Left/Right turns relative to current heading)
 */
export function getRelativeTurn(current: Direction, turn: 'LEFT' | 'RIGHT'): Direction {
  const directions: Direction[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
  const currentIndex = directions.indexOf(current);
  if (turn === 'RIGHT') {
    return directions[(currentIndex + 1) % 4];
  } else {
    return directions[(currentIndex + 3) % 4];
  }
}

/**
 * Check boundary collision
 */
export function isOutOfBounds(coord: GridCoord, halfGridSize: number): boolean {
  return (
    coord.x < -halfGridSize ||
    coord.x > halfGridSize ||
    coord.z < -halfGridSize ||
    coord.z > halfGridSize
  );
}

/**
 * Advance snake body one tick
 */
export function advanceSnake(
  body: GridCoord[],
  nextHead: GridCoord,
  grow: boolean
): GridCoord[] {
  const newBody = [nextHead, ...body];
  if (!grow) {
    newBody.pop();
  }
  return newBody;
}

/**
 * Check if head collides with any part of body (excluding head itself)
 */
export function checkSelfCollision(head: GridCoord, body: GridCoord[]): boolean {
  // Start from index 1 (or check against rest of body)
  for (let i = 1; i < body.length; i++) {
    if (isSameCoord(head, body[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate combo multiplier based on time elapsed since last collect
 */
export function calculateCombo(
  currentTime: number,
  lastCollectTime: number,
  currentCombo: number,
  timeoutMs: number
): { combo: number; multiplier: number } {
  if (currentTime - lastCollectTime <= timeoutMs) {
    const nextCombo = Math.min(currentCombo + 1, 8);
    const multiplier = nextCombo >= 6 ? 8 : nextCombo >= 4 ? 4 : nextCombo >= 2 ? 2 : 1;
    return { combo: nextCombo, multiplier };
  }
  return { combo: 1, multiplier: 1 };
}

/**
 * Calculate score for food item
 */
export function calculateScore(
  basePoints: number,
  multiplier: number,
  isOverdrive: boolean
): number {
  const overdriveMultiplier = isOverdrive ? 2 : 1;
  return basePoints * multiplier * overdriveMultiplier;
}

/**
 * Pick a random free coordinate on the grid that is not occupied by snake, foods, or hazards
 */
export function findFreeGridCoord(
  halfGridSize: number,
  occupiedCoords: GridCoord[],
  randomFn = Math.random
): GridCoord | null {
  const allPossible: GridCoord[] = [];
  for (let x = -halfGridSize; x <= halfGridSize; x++) {
    for (let z = -halfGridSize; z <= halfGridSize; z++) {
      allPossible.push({ x, z });
    }
  }

  const freeCoords = allPossible.filter(
    (c) => !occupiedCoords.some((occ) => isSameCoord(occ, c))
  );

  if (freeCoords.length === 0) return null;
  const index = Math.floor(randomFn() * freeCoords.length);
  return freeCoords[index];
}

/**
 * Simple AI pathfinder heuristic for demo mode / attract screen
 * Chooses the safest valid move towards the target food
 */
export function computeNextAiDirection(
  head: GridCoord,
  currentDir: Direction,
  target: GridCoord | null,
  body: GridCoord[],
  halfGridSize: number,
  hazards: GridCoord[] = []
): Direction {
  const possibleDirections: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
  const validDirections = possibleDirections.filter(
    (d) => !isOppositeDirection(d, currentDir)
  );

  // Score each valid direction
  const scoredMoves: { dir: Direction; score: number }[] = [];

  for (const dir of validDirections) {
    const delta = getDirectionDelta(dir);
    const nextCoord: GridCoord = { x: head.x + delta.x, z: head.z + delta.z };

    // Disqualify out of bounds
    if (isOutOfBounds(nextCoord, halfGridSize)) continue;

    // Disqualify collision with body
    if (body.some((segment) => isSameCoord(nextCoord, segment))) continue;

    // Disqualify collision with active hazards
    if (hazards.some((hazard) => isSameCoord(nextCoord, hazard))) continue;

    // Calculate Manhattan distance to target
    let dist = 0;
    if (target) {
      dist = Math.abs(nextCoord.x - target.x) + Math.abs(nextCoord.z - target.z);
    }

    // Look ahead 1 more step to avoid dead ends
    let openNeighbors = 0;
    for (const testDir of possibleDirections) {
      const neighborDelta = getDirectionDelta(testDir);
      const neighborCoord = { x: nextCoord.x + neighborDelta.x, z: nextCoord.z + neighborDelta.z };
      if (!isOutOfBounds(neighborCoord, halfGridSize) && !body.some((s) => isSameCoord(neighborCoord, s))) {
        openNeighbors++;
      }
    }

    // Prefer moves that maintain freedom of movement and move toward target
    const score = 1000 - dist * 10 + openNeighbors * 50;
    scoredMoves.push({ dir, score });
  }

  if (scoredMoves.length === 0) {
    // No safe moves, just return current direction
    return currentDir;
  }

  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves[0].dir;
}
