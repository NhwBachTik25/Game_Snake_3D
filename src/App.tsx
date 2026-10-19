/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { CyberEngine, type CameraMode } from './game/engine';
import { soundManager } from './game/audio';
import {
  advanceSnake,
  calculateCombo,
  calculateScore,
  checkSelfCollision,
  computeNextAiDirection,
  DIFFICULTY_PRESETS,
  findFreeGridCoord,
  getDirectionDelta,
  getRelativeTurn,
  isOppositeDirection,
  isOutOfBounds,
  type Direction,
  type FoodItem,
  type GridCoord,
  type HazardPillar,
} from './game/logic';
import { HUD } from './components/HUD';
import { TitleScreen, type Difficulty } from './components/TitleScreen';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';

type ScreenState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

const HALF_GRID_SIZE = 10; // 21x21 tiles (-10 to +10)
const HIGH_SCORE_KEY = 'cyberserpent_high_score_v1';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CyberEngine | null>(null);

  // High score in local storage
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // UI state
  const [screenState, setScreenState] = useState<ScreenState>('TITLE');
  const [difficulty, setDifficulty] = useState<Difficulty>('arcade');
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [combo, setCombo] = useState<number>(1);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [comboRatio, setComboRatio] = useState<number>(0);
  const [stamina, setStamina] = useState<number>(100);
  const [isBoosting, setIsBoosting] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('ISOMETRIC');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState<boolean>(true);

  // Game over stats
  const [maxCombo, setMaxCombo] = useState<number>(1);
  const [orbsConsumed, setOrbsConsumed] = useState<number>(0);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);

  // Active chrono time-warp indicator
  const [isChronoActive, setIsChronoActive] = useState<boolean>(false);

  // Mutable Game Loop State stored in refs to prevent React rerender lag
  const stateRef = useRef({
    screenState: 'TITLE' as ScreenState,
    difficulty: 'arcade' as Difficulty,
    snakeBody: [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: 2 },
    ] as GridCoord[],
    currentDir: 'UP' as Direction,
    nextDir: 'UP' as Direction,
    foods: [] as FoodItem[],
    hazards: [] as HazardPillar[],
    score: 0,
    highScore: 0,
    level: 1,
    combo: 1,
    comboMultiplier: 1,
    maxCombo: 1,
    orbsConsumed: 0,
    lastCollectTime: 0,
    stamina: 100,
    isBoosting: false,
    overdriveUntil: 0,
    chronoUntil: 0,
    lastTickTime: 0,
    tickAccumulator: 0,
    hazardTimer: 0,
    cameraMode: 'ISOMETRIC' as CameraMode,
    hasPlayerMoved: false,
  });

  // Keep stateRef synced with critical values
  stateRef.current.screenState = screenState;
  stateRef.current.difficulty = difficulty;
  stateRef.current.highScore = highScore;
  stateRef.current.cameraMode = cameraMode;

  // Initialize Three.js Engine once on mount
  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new CyberEngine(mountRef.current, HALF_GRID_SIZE);
    engineRef.current = engine;

    // Check ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame('arcade');
    } else {
      // Spawn initial food for AI demo snake
      initAiDemo();
    }

    // Start background synthwave music
    soundManager.startAmbientMusic();

    let animId: number;
    let lastFrameTime = performance.now();

    const mainGameLoop = (now: number) => {
      animId = requestAnimationFrame(mainGameLoop);
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      const state = stateRef.current;

      // Handle stamina regeneration / consumption
      if (state.screenState === 'PLAYING') {
        if (state.isBoosting) {
          state.stamina = Math.max(0, state.stamina - dt * 32);
          if (state.stamina <= 0) {
            state.isBoosting = false;
            setIsBoosting(false);
            engine.setBoosting(false);
            soundManager.stopBoost();
          }
        } else {
          state.stamina = Math.min(100, state.stamina + dt * 18);
        }
        setStamina(state.stamina);

        // Update combo decay bar
        if (state.comboMultiplier > 1) {
          const elapsed = now - state.lastCollectTime;
          const comboTimeout = 3200;
          const remaining = Math.max(0, 1 - elapsed / comboTimeout);
          setComboRatio(remaining);
          if (remaining <= 0) {
            state.combo = 1;
            state.comboMultiplier = 1;
            setCombo(1);
            setComboMultiplier(1);
          }
        }

        // Overdrive expiry check
        if (state.overdriveUntil > 0 && now > state.overdriveUntil) {
          state.overdriveUntil = 0;
          engine.setOverdrive(false);
        }

        // Chrono expiry check
        if (state.chronoUntil > 0 && now > state.chronoUntil) {
          state.chronoUntil = 0;
          setIsChronoActive(false);
        }
      }

      // Calculate step tick duration
      const preset = DIFFICULTY_PRESETS[state.difficulty];
      let baseSpeed = Math.max(
        preset.minSpeedMs,
        preset.initialSpeedMs - (state.level - 1) * preset.speedIncrement
      );

      if (state.screenState === 'TITLE') {
        baseSpeed = 130; // Smooth leisurely speed for demo snake
      } else {
        if (state.isBoosting) baseSpeed *= 0.55;
        if (now < state.chronoUntil) baseSpeed *= 1.6; // slow-motion
      }

      const stepDurationSec = baseSpeed / 1000;
      state.tickAccumulator += dt;

      // Handle dynamic hazards timer
      if (state.screenState === 'PLAYING' && preset.hazardRate > 0) {
        state.hazardTimer += dt;
        if (state.hazardTimer > (state.difficulty === 'hardcore' ? 6 : 9)) {
          state.hazardTimer = 0;
          spawnHazardPillar();
        }

        // Update active hazards
        let hazardsChanged = false;
        for (let i = state.hazards.length - 1; i >= 0; i--) {
          const h = state.hazards[i];
          const age = now - h.warningStartTime;
          if (h.state === 'WARNING' && age >= 2400) {
            h.state = 'ACTIVE';
            soundManager.playWarning();
            hazardsChanged = true;
          } else if (age >= h.duration) {
            state.hazards.splice(i, 1);
            hazardsChanged = true;
          }
        }
        if (hazardsChanged) {
          engine.syncHazards(state.hazards);
        }
      }

      // Execute discrete game tick when accumulator reaches step duration
      if (state.tickAccumulator >= stepDurationSec) {
        state.tickAccumulator -= stepDurationSec;

        if (state.screenState === 'TITLE') {
          // AI Demo Snake tick
          executeAiTick(stepDurationSec);
        } else if (state.screenState === 'PLAYING') {
          // Player tick
          executePlayerTick(stepDurationSec, now);
        }
      }
    };

    animId = requestAnimationFrame(mainGameLoop);

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      handleKeyUp(e);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(animId);
      soundManager.stopAmbientMusic();
      soundManager.stopBoost();
      engine.dispose();
    };
  }, []);

  const initAiDemo = () => {
    const state = stateRef.current;
    state.snakeBody = [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: 2 },
      { x: 0, z: 3 },
      { x: 0, z: 4 },
    ];
    state.currentDir = 'UP';
    state.nextDir = 'UP';
    state.foods = [
      {
        id: 'demo-core',
        x: 4,
        z: -3,
        type: 'CYAN_CORE',
        points: 10,
        spawnTime: Date.now(),
      },
    ];
    state.hazards = [];

    engineRef.current?.updateSnakeState(state.snakeBody, 'UP', 0.13);
    engineRef.current?.syncFoods(state.foods);
    engineRef.current?.syncHazards([]);
  };

  const executeAiTick = (stepDurationSec: number) => {
    const state = stateRef.current;
    const head = state.snakeBody[0];
    const targetFood = state.foods[0] ? { x: state.foods[0].x, z: state.foods[0].z } : null;

    const nextDir = computeNextAiDirection(
      head,
      state.currentDir,
      targetFood,
      state.snakeBody,
      HALF_GRID_SIZE
    );

    state.currentDir = nextDir;
    const delta = getDirectionDelta(nextDir);
    const nextHead: GridCoord = { x: head.x + delta.x, z: head.z + delta.z };

    // Check if food eaten
    let grow = false;
    if (targetFood && nextHead.x === targetFood.x && nextHead.z === targetFood.z) {
      grow = true;
      engineRef.current?.spawnBurst(nextHead, 0x0ef0e4, 18);
      // Respawn demo food
      const newCoord = findFreeGridCoord(HALF_GRID_SIZE, [...state.snakeBody, nextHead]);
      if (newCoord) {
        state.foods = [
          {
            id: `demo-${Date.now()}`,
            x: newCoord.x,
            z: newCoord.z,
            type: Math.random() > 0.4 ? 'CYAN_CORE' : 'GOLDEN_SUPERNOVA',
            points: 10,
            spawnTime: Date.now(),
          },
        ];
        engineRef.current?.syncFoods(state.foods);
      }
    }

    state.snakeBody = advanceSnake(state.snakeBody, nextHead, grow);
    engineRef.current?.updateSnakeState(state.snakeBody, nextDir, stepDurationSec);
  };

  const executePlayerTick = (stepDurationSec: number, now: number) => {
    const state = stateRef.current;
    state.currentDir = state.nextDir;
    const head = state.snakeBody[0];
    let delta = getDirectionDelta(state.currentDir);
    let nextHead: GridCoord = { x: head.x + delta.x, z: head.z + delta.z };

    // If player has not given any input yet, auto-steer safely away from walls
    if (!state.hasPlayerMoved) {
      if (isOutOfBounds(nextHead, HALF_GRID_SIZE - 2)) {
        // Turn safely 90 degrees
        const turnRight = getRelativeTurn(state.currentDir, 'RIGHT');
        const testDelta = getDirectionDelta(turnRight);
        const testHead = { x: head.x + testDelta.x, z: head.z + testDelta.z };
        if (!isOutOfBounds(testHead, HALF_GRID_SIZE - 2)) {
          state.currentDir = turnRight;
          state.nextDir = turnRight;
          delta = testDelta;
          nextHead = testHead;
        } else {
          const turnLeft = getRelativeTurn(state.currentDir, 'LEFT');
          const testDeltaL = getDirectionDelta(turnLeft);
          state.currentDir = turnLeft;
          state.nextDir = turnLeft;
          delta = testDeltaL;
          nextHead = { x: head.x + testDeltaL.x, z: head.z + testDeltaL.z };
        }
      }
    }

    // 1. Check Wall Collision
    if (isOutOfBounds(nextHead, HALF_GRID_SIZE)) {
      triggerGameOver('CRASHED INTO ARENA PERIMETER');
      return;
    }

    // 2. Check Self Collision
    if (checkSelfCollision(nextHead, state.snakeBody)) {
      triggerGameOver('COLLIDED WITH SERPENT BODY');
      return;
    }

    // 3. Check Active Hazard Collision
    const hitHazard = state.hazards.find(
      (h) => h.state === 'ACTIVE' && h.x === nextHead.x && h.z === nextHead.z
    );
    if (hitHazard) {
      triggerGameOver('VAPORIZED BY LASER HAZARD');
      return;
    }

    // 4. Check Food Collection
    let ateFoodIndex = -1;
    for (let i = 0; i < state.foods.length; i++) {
      if (state.foods[i].x === nextHead.x && state.foods[i].z === nextHead.z) {
        ateFoodIndex = i;
        break;
      }
    }

    let grow = false;

    if (ateFoodIndex !== -1) {
      const food = state.foods[ateFoodIndex];
      grow = true;
      state.foods.splice(ateFoodIndex, 1);
      state.orbsConsumed++;
      setOrbsConsumed(state.orbsConsumed);

      // Combo update
      const { combo: newCombo, multiplier } = calculateCombo(
        now,
        state.lastCollectTime,
        state.combo,
        3200
      );
      state.combo = newCombo;
      state.comboMultiplier = multiplier;
      state.lastCollectTime = now;
      setCombo(newCombo);
      setComboMultiplier(multiplier);
      if (multiplier > state.maxCombo) {
        state.maxCombo = multiplier;
        setMaxCombo(multiplier);
      }

      // Score calculation
      const isOverdrive = now < state.overdriveUntil;
      const earned = calculateScore(food.points, multiplier, isOverdrive);
      state.score += earned;
      setScore(state.score);

      // Level progression every 100 points
      const newLevel = 1 + Math.floor(state.score / 120);
      if (newLevel > state.level) {
        state.level = newLevel;
        setLevel(newLevel);
        soundManager.playLevelUp();
        engineRef.current?.spawnFloatingPopup(`LEVEL ${newLevel}!`, nextHead, '#38bdf8');
      }

      // Power-up specific effects
      if (food.type === 'GOLDEN_SUPERNOVA') {
        soundManager.playGoldenSupernova();
        state.overdriveUntil = now + 8000;
        engineRef.current?.setOverdrive(true);
        engineRef.current?.spawnBurst(nextHead, 0xffbb00, 36);
        engineRef.current?.spawnFloatingPopup(`+${earned} SUPERNOVA!`, nextHead, '#ffd166');
        engineRef.current?.triggerCameraShake(0.5);
      } else if (food.type === 'PURPLE_CHRONO') {
        soundManager.playChrono();
        state.chronoUntil = now + 6000;
        setIsChronoActive(true);
        engineRef.current?.spawnBurst(nextHead, 0xa855f7, 28);
        engineRef.current?.spawnFloatingPopup(`+${earned} CHRONO SLOW!`, nextHead, '#c084fc');
      } else {
        // Cyan Core
        soundManager.playCollect(multiplier);
        engineRef.current?.spawnBurst(nextHead, 0x0ef0e4, 20);
        const popupText = multiplier > 1 ? `+${earned} (x${multiplier})` : `+${earned}`;
        engineRef.current?.spawnFloatingPopup(popupText, nextHead, '#0ef0e4');
      }

      // Check for High Score
      if (state.score > state.highScore) {
        state.highScore = state.score;
        setHighScore(state.score);
        try {
          localStorage.setItem(HIGH_SCORE_KEY, state.score.toString());
        } catch {
          // ignore
        }
      }

      // Spawn replacement food
      spawnFood();
    }

    // Advance snake body
    state.snakeBody = advanceSnake(state.snakeBody, nextHead, grow);
    engineRef.current?.updateSnakeState(state.snakeBody, state.currentDir, stepDurationSec);
  };

  const spawnFood = () => {
    const state = stateRef.current;
    const occupied = [
      ...state.snakeBody,
      ...state.foods.map((f) => ({ x: f.x, z: f.z })),
      ...state.hazards.map((h) => ({ x: h.x, z: h.z })),
    ];

    const freeCoord = findFreeGridCoord(HALF_GRID_SIZE, occupied);
    if (!freeCoord) return;

    // Determine type: 70% Cyan Core, 18% Golden Supernova, 12% Purple Chrono
    const rand = Math.random();
    let type: FoodItem['type'] = 'CYAN_CORE';
    let points = 10;

    if (rand > 0.88) {
      type = 'PURPLE_CHRONO';
      points = 25;
    } else if (rand > 0.70) {
      type = 'GOLDEN_SUPERNOVA';
      points = 50;
    }

    const newFood: FoodItem = {
      id: `food-${Date.now()}-${Math.random()}`,
      x: freeCoord.x,
      z: freeCoord.z,
      type,
      points,
      spawnTime: performance.now(),
    };

    state.foods.push(newFood);
    engineRef.current?.syncFoods(state.foods);
  };

  const spawnHazardPillar = () => {
    const state = stateRef.current;
    const occupied = [
      ...state.snakeBody,
      ...state.foods.map((f) => ({ x: f.x, z: f.z })),
      ...state.hazards.map((h) => ({ x: h.x, z: h.z })),
    ];

    const freeCoord = findFreeGridCoord(HALF_GRID_SIZE, occupied);
    if (!freeCoord) return;

    const newHazard: HazardPillar = {
      id: `hazard-${Date.now()}`,
      x: freeCoord.x,
      z: freeCoord.z,
      state: 'WARNING',
      warningStartTime: performance.now(),
      duration: 10000,
    };

    state.hazards.push(newHazard);
    engineRef.current?.syncHazards(state.hazards);
  };

  const triggerGameOver = (reason: string) => {
    const state = stateRef.current;
    state.screenState = 'GAME_OVER';
    setScreenState('GAME_OVER');

    soundManager.stopBoost();
    soundManager.playGameOver();
    engineRef.current?.setBoosting(false);
    engineRef.current?.triggerCameraShake(0.9);

    const isNew = state.score >= state.highScore && state.score > 0;
    setIsNewHighScore(isNew);
  };

  const startGame = (diff?: Difficulty) => {
    const state = stateRef.current;
    const chosenDiff = diff || difficulty;
    state.difficulty = chosenDiff;
    setDifficulty(chosenDiff);

    // Reset game state
    state.snakeBody = [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: 2 },
    ];
    state.currentDir = 'UP';
    state.nextDir = 'UP';
    state.score = 0;
    state.level = 1;
    state.combo = 1;
    state.comboMultiplier = 1;
    state.maxCombo = 1;
    state.orbsConsumed = 0;
    state.stamina = 100;
    state.isBoosting = false;
    state.overdriveUntil = 0;
    state.chronoUntil = 0;
    state.foods = [];
    state.hazards = [];
    state.tickAccumulator = 0;
    state.hasPlayerMoved = false;

    setScore(0);
    setLevel(1);
    setCombo(1);
    setComboMultiplier(1);
    setMaxCombo(1);
    setOrbsConsumed(0);
    setStamina(100);
    setIsBoosting(false);
    setIsChronoActive(false);

    engineRef.current?.setOverdrive(false);
    engineRef.current?.setBoosting(false);

    // Initial foods (spawn 2 items)
    spawnFood();
    spawnFood();

    engineRef.current?.updateSnakeState(state.snakeBody, 'UP', 0.1);
    engineRef.current?.syncHazards([]);

    state.screenState = 'PLAYING';
    setScreenState('PLAYING');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const state = stateRef.current;

    // Handle Title Screen [ENTER]
    if (state.screenState === 'TITLE') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startGame();
      }
      return;
    }

    // Handle Game Over [ENTER or SPACE]
    if (state.screenState === 'GAME_OVER') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startGame();
      }
      return;
    }

    // Handle Pause Toggle [ESC or P]
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (state.screenState === 'PLAYING') {
        state.screenState = 'PAUSED';
        setScreenState('PAUSED');
        soundManager.stopBoost();
      } else if (state.screenState === 'PAUSED') {
        state.screenState = 'PLAYING';
        setScreenState('PLAYING');
      }
      return;
    }

    // Camera Switch [C]
    if (e.key === 'c' || e.key === 'C') {
      cycleCamera();
      return;
    }

    if (state.screenState !== 'PLAYING') return;

    // Boost [Space or Shift]
    if (e.key === ' ' || e.key === 'Shift') {
      e.preventDefault();
      if (state.stamina > 10 && !state.isBoosting) {
        state.isBoosting = true;
        setIsBoosting(true);
        engineRef.current?.setBoosting(true);
        soundManager.startBoost();
      }
      return;
    }

    // Steering logic
    let desiredDir: Direction | null = null;

    if (state.cameraMode === 'CHASE') {
      // In Chase Cam mode, A/D or Left/Right turns relative to current heading
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        desiredDir = getRelativeTurn(state.currentDir, 'LEFT');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        desiredDir = getRelativeTurn(state.currentDir, 'RIGHT');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        desiredDir = state.currentDir; // keep forward
      }
    } else {
      // World directional mode (Isometric or Tactical)
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        desiredDir = 'UP';
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        desiredDir = 'DOWN';
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        desiredDir = 'LEFT';
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        desiredDir = 'RIGHT';
      }
    }

    if (desiredDir && desiredDir !== state.currentDir && !isOppositeDirection(desiredDir, state.currentDir)) {
      state.nextDir = desiredDir;
      state.hasPlayerMoved = true;
      soundManager.playTurn();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const state = stateRef.current;
    if (e.key === ' ' || e.key === 'Shift') {
      state.isBoosting = false;
      setIsBoosting(false);
      engineRef.current?.setBoosting(false);
      soundManager.stopBoost();
    }
  };

  const cycleCamera = () => {
    const modes: CameraMode[] = ['ISOMETRIC', 'CHASE', 'TACTICAL'];
    const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setCameraMode(nextMode);
    engineRef.current?.setCameraMode(nextMode);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const toggleMusic = () => {
    const next = soundManager.toggleMusic();
    setIsMusicEnabled(next);
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans"
      data-state={screenState}
      data-score={score}
      data-camera={cameraMode}
    >
      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Chrono Slow-Motion Vignette Overlay */}
      {isChronoActive && (
        <div className="absolute inset-0 pointer-events-none z-10 border-[16px] border-purple-500/25 transition-all duration-300 animate-pulse shadow-[inset_0_0_100px_rgba(168,85,247,0.3)]" />
      )}

      {/* Active Screen UI Overlay */}
      {screenState === 'TITLE' && (
        <TitleScreen
          highScore={highScore}
          difficulty={difficulty}
          onSelectDifficulty={(d) => setDifficulty(d)}
          onStartGame={() => startGame()}
        />
      )}

      {screenState === 'PLAYING' && (
        <HUD
          score={score}
          highScore={highScore}
          combo={combo}
          comboMultiplier={comboMultiplier}
          comboTimeRemainingRatio={comboRatio}
          stamina={stamina}
          isBoosting={isBoosting}
          level={level}
          cameraMode={cameraMode}
          isMuted={isMuted}
          isMusicEnabled={isMusicEnabled}
          onToggleMute={toggleMute}
          onToggleMusic={toggleMusic}
          onCycleCamera={cycleCamera}
          onPause={() => {
            stateRef.current.screenState = 'PAUSED';
            setScreenState('PAUSED');
            soundManager.stopBoost();
          }}
          onSteerDirection={(dir) => {
            const state = stateRef.current;
            if (dir !== state.currentDir && !isOppositeDirection(dir, state.currentDir)) {
              state.nextDir = dir;
              state.hasPlayerMoved = true;
              soundManager.playTurn();
            }
          }}
          onSteerRelative={(turn) => {
            const state = stateRef.current;
            const newDir = getRelativeTurn(state.currentDir, turn);
            if (!isOppositeDirection(newDir, state.currentDir)) {
              state.nextDir = newDir;
              state.hasPlayerMoved = true;
              soundManager.playTurn();
            }
          }}
          onStartBoost={() => {
            const state = stateRef.current;
            if (state.stamina > 10 && !state.isBoosting) {
              state.isBoosting = true;
              setIsBoosting(true);
              engineRef.current?.setBoosting(true);
              soundManager.startBoost();
            }
          }}
          onStopBoost={() => {
            const state = stateRef.current;
            state.isBoosting = false;
            setIsBoosting(false);
            engineRef.current?.setBoosting(false);
            soundManager.stopBoost();
          }}
        />
      )}

      {screenState === 'PAUSED' && (
        <PauseModal
          onResume={() => {
            stateRef.current.screenState = 'PLAYING';
            setScreenState('PLAYING');
          }}
          onRestart={() => startGame()}
          onMainMenu={() => {
            stateRef.current.screenState = 'TITLE';
            setScreenState('TITLE');
            initAiDemo();
          }}
          isMuted={isMuted}
          isMusicEnabled={isMusicEnabled}
          onToggleMute={toggleMute}
          onToggleMusic={toggleMusic}
        />
      )}

      {screenState === 'GAME_OVER' && (
        <GameOverModal
          score={score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          maxCombo={maxCombo}
          orbsConsumed={orbsConsumed}
          onRestart={() => startGame()}
          onMainMenu={() => {
            stateRef.current.screenState = 'TITLE';
            setScreenState('TITLE');
            initAiDemo();
          }}
        />
      )}
    </div>
  );
}
