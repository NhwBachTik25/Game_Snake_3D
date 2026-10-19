import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSameCoord,
  isOppositeDirection,
  getDirectionDelta,
  getRelativeTurn,
  isOutOfBounds,
  advanceSnake,
  checkSelfCollision,
  calculateCombo,
  calculateScore,
  findFreeGridCoord,
  computeNextAiDirection,
  type GridCoord,
  type Direction
} from './logic.ts';

test('isSameCoord detects identical coordinates', () => {
  assert.equal(isSameCoord({ x: 3, z: -2 }, { x: 3, z: -2 }), true);
  assert.equal(isSameCoord({ x: 3, z: -2 }, { x: 3, z: 2 }), false);
});

test('isOppositeDirection prevents 180 reversals', () => {
  assert.equal(isOppositeDirection('UP', 'DOWN'), true);
  assert.equal(isOppositeDirection('DOWN', 'UP'), true);
  assert.equal(isOppositeDirection('LEFT', 'RIGHT'), true);
  assert.equal(isOppositeDirection('RIGHT', 'LEFT'), true);
  assert.equal(isOppositeDirection('UP', 'LEFT'), false);
  assert.equal(isOppositeDirection('DOWN', 'RIGHT'), false);
});

test('getDirectionDelta maps directions to 3D grid axes', () => {
  assert.deepEqual(getDirectionDelta('UP'), { x: 0, z: -1 });
  assert.deepEqual(getDirectionDelta('DOWN'), { x: 0, z: 1 });
  assert.deepEqual(getDirectionDelta('LEFT'), { x: -1, z: 0 });
  assert.deepEqual(getDirectionDelta('RIGHT'), { x: 1, z: 0 });
});

test('getRelativeTurn rotates direction correctly for chase camera', () => {
  // Heading UP, turn RIGHT -> should be RIGHT
  assert.equal(getRelativeTurn('UP', 'RIGHT'), 'RIGHT');
  // Heading UP, turn LEFT -> should be LEFT
  assert.equal(getRelativeTurn('UP', 'LEFT'), 'LEFT');
  // Heading RIGHT, turn RIGHT -> should be DOWN
  assert.equal(getRelativeTurn('RIGHT', 'RIGHT'), 'DOWN');
  // Heading LEFT, turn LEFT -> should be DOWN
  assert.equal(getRelativeTurn('LEFT', 'LEFT'), 'DOWN');
});

test('isOutOfBounds checks half-grid boundaries', () => {
  const halfGrid = 10;
  assert.equal(isOutOfBounds({ x: 0, z: 0 }, halfGrid), false);
  assert.equal(isOutOfBounds({ x: 10, z: -10 }, halfGrid), false);
  assert.equal(isOutOfBounds({ x: 11, z: 0 }, halfGrid), true);
  assert.equal(isOutOfBounds({ x: 0, z: -11 }, halfGrid), true);
});

test('advanceSnake shifts segments and honors growth', () => {
  const initialBody: GridCoord[] = [
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: 2 }
  ];

  // Moving UP (next head: {x: 0, z: -1}) without growth
  const moved = advanceSnake(initialBody, { x: 0, z: -1 }, false);
  assert.equal(moved.length, 3);
  assert.deepEqual(moved[0], { x: 0, z: -1 });
  assert.deepEqual(moved[1], { x: 0, z: 0 });
  assert.deepEqual(moved[2], { x: 0, z: 1 });

  // Moving again with growth
  const grown = advanceSnake(moved, { x: 0, z: -2 }, true);
  assert.equal(grown.length, 4);
  assert.deepEqual(grown[0], { x: 0, z: -2 });
});

test('checkSelfCollision detects body overlap', () => {
  const body: GridCoord[] = [
    { x: 1, z: 1 }, // head
    { x: 1, z: 2 },
    { x: 2, z: 2 },
    { x: 2, z: 1 },
    { x: 1, z: 1 } // coiled into self
  ];
  assert.equal(checkSelfCollision(body[0], body), true);

  const straightBody: GridCoord[] = [
    { x: 0, z: -2 },
    { x: 0, z: -1 },
    { x: 0, z: 0 }
  ];
  assert.equal(checkSelfCollision(straightBody[0], straightBody), false);
});

test('calculateCombo scales multipliers with timing', () => {
  const timeoutMs = 2000;
  // First item eaten
  const c1 = calculateCombo(1000, 0, 0, timeoutMs);
  assert.equal(c1.combo, 1);
  assert.equal(c1.multiplier, 1);

  // Quick succession item (+500ms)
  const c2 = calculateCombo(1500, 1000, c1.combo, timeoutMs);
  assert.equal(c2.combo, 2);
  assert.equal(c2.multiplier, 2);

  // Third quick succession item (+600ms)
  const c3 = calculateCombo(2100, 1500, c2.combo, timeoutMs);
  assert.equal(c3.combo, 3);
  assert.equal(c3.multiplier, 2);

  // Fourth quick succession item (+400ms)
  const c4 = calculateCombo(2500, 2100, c3.combo, timeoutMs);
  assert.equal(c4.combo, 4);
  assert.equal(c4.multiplier, 4);

  // Expired item (+3000ms later)
  const cReset = calculateCombo(5500, 2500, c4.combo, timeoutMs);
  assert.equal(cReset.combo, 1);
  assert.equal(cReset.multiplier, 1);
});

test('calculateScore factors in multipliers and overdrive', () => {
  // Base 10, multiplier 1, no overdrive -> 10
  assert.equal(calculateScore(10, 1, false), 10);
  // Base 10, multiplier 4, no overdrive -> 40
  assert.equal(calculateScore(10, 4, false), 40);
  // Base 50, multiplier 2, overdrive -> 200
  assert.equal(calculateScore(50, 2, true), 200);
});

test('findFreeGridCoord returns valid unoccupied coordinates', () => {
  const halfGrid = 1; // 3x3 grid: 9 cells total
  const occupied: GridCoord[] = [
    { x: -1, z: -1 },
    { x: -1, z: 0 },
    { x: -1, z: 1 },
    { x: 0, z: -1 },
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    { x: 1, z: -1 },
    { x: 1, z: 0 }
    // { x: 1, z: 1 } is only free spot
  ];
  const free = findFreeGridCoord(halfGrid, occupied, () => 0);
  assert.deepEqual(free, { x: 1, z: 1 });
});

test('computeNextAiDirection chooses safe non-suicidal move towards food', () => {
  const head: GridCoord = { x: 0, z: 0 };
  const currentDir: Direction = 'UP';
  const target: GridCoord = { x: 3, z: 0 };
  const body: GridCoord[] = [
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: 2 }
  ];
  const halfGrid = 10;

  const nextDir = computeNextAiDirection(head, currentDir, target, body, halfGrid);
  // Target is to the right (x=3), so it should steer RIGHT rather than hitting body (DOWN) or wandering
  assert.equal(nextDir, 'RIGHT');
});
