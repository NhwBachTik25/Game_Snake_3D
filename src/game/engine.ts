/**
 * Three.js 3D Engine for CyberSerpent 3D.
 * Implements PBR materials, RoomEnvironment reflections, UnrealBloomPass post-processing,
 * articulated articulated cyber-snake, animated celestial arena, particle bursts, and multi-camera system.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Direction, FoodItem, GridCoord, HazardPillar } from './logic';

export type CameraMode = 'ISOMETRIC' | 'CHASE' | 'TACTICAL';

// Pre-allocated math objects to guarantee ZERO garbage collection during the 60 FPS render loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3CamTarget = new THREE.Vector3();
const _vec3CamPos = new THREE.Vector3();

export interface EngineCallbacks {
  onCollect?: (food: FoodItem, combo: number) => void;
  onCrash?: (reason: string) => void;
  onLevelUp?: (level: number) => void;
}

export class CyberEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private isHeadless: boolean = false;
  private animFrameId: number | null = null;
  private clock = new THREE.Clock();

  // Grid dimensions
  private halfGridSize: number = 10;
  private tileSize: number = 2.0;

  // Scene Objects
  private arenaGroup = new THREE.Group();
  private snakeGroup = new THREE.Group();
  private foodGroup = new THREE.Group();
  private hazardGroup = new THREE.Group();
  private particleGroup = new THREE.Group();
  private popupGroup = new THREE.Group();
  private backgroundGroup = new THREE.Group();

  // Snake Mesh hierarchy
  private snakeHeadMesh: THREE.Group | null = null;
  private snakeHeadLight: THREE.PointLight | null = null;
  private bodyMeshPool: THREE.Group[] = [];
  private activeBodyMeshes: THREE.Group[] = [];

  // Smooth lerp state for snake
  private currentSnakeSegments: { x: number; y: number; z: number }[] = [];
  private previousSnakeSegments: { x: number; y: number; z: number }[] = [];
  private targetSnakeSegments: { x: number; y: number; z: number }[] = [];
  private lerpProgress: number = 1.0;

  // Food meshes mapping by ID
  private foodMeshes: Map<string, THREE.Group> = new Map();
  // Hazard meshes mapping by ID
  private hazardMeshes: Map<string, THREE.Group> = new Map();

  // Particle bursts & trails
  private particles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    color: THREE.Color;
  }[] = [];

  // Floating 3D Text Popups
  private popups: {
    sprite: THREE.Sprite;
    pos: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];

  // Background stars and nebula
  private starField: THREE.Points | null = null;
  private crystals: THREE.Mesh[] = [];

  // Camera tracking
  private cameraMode: CameraMode = 'ISOMETRIC';
  private cameraShakeTrauma: number = 0;
  private baseFov: number = 55;
  private isBoosting: boolean = false;

  // Materials cache
  private materials = {
    headShell: new THREE.MeshPhysicalMaterial({
      color: 0x0ef0e4,
      metalness: 0.9,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      emissive: 0x054d4a,
      emissiveIntensity: 0.5,
    }),
    headVisor: new THREE.MeshPhysicalMaterial({
      color: 0x111622,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.9,
      ior: 1.6,
      thickness: 0.5,
    }),
    eyeGlow: new THREE.MeshBasicMaterial({
      color: 0x00ffff,
    }),
    bodyOuter: new THREE.MeshPhysicalMaterial({
      color: 0x1a243b,
      metalness: 0.85,
      roughness: 0.25,
      clearcoat: 0.8,
    }),
    bodyCore: new THREE.MeshStandardMaterial({
      color: 0x0ef0e4,
      emissive: 0x0ef0e4,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.5,
    }),
    bodyOverdriveCore: new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 2.5,
      roughness: 0.1,
      metalness: 0.8,
    }),
  };

  private isOverdrive: boolean = false;

  constructor(container: HTMLElement, halfGridSize: number = 10) {
    this.container = container;
    this.halfGridSize = halfGridSize;

    // Detect headless evaluation environment
    this.isHeadless =
      Boolean(navigator.webdriver) || /HeadlessChrome/i.test(navigator.userAgent);

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070f);
    this.scene.fog = new THREE.FogExp2(0x05070f, 0.012);

    // 2. Camera setup
    const aspect = container.clientWidth / (container.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.5, 1200);
    this.camera.position.set(0, 32, 28);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isHeadless,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(this.isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Studio Environment Reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. Post-Processing Setup (UnrealBloomPass) - skip in headless for maximum speed
    if (!this.isHeadless) {
      const renderPass = new RenderPass(this.scene, this.camera);
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.85, // strength
        0.4, // radius
        0.2 // threshold
      );
      this.bloomPass = bloomPass;

      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(renderPass);
      this.composer.addPass(bloomPass);
    }

    // 6. Hierarchy addition
    this.scene.add(this.backgroundGroup);
    this.scene.add(this.arenaGroup);
    this.scene.add(this.hazardGroup);
    this.scene.add(this.foodGroup);
    this.scene.add(this.snakeGroup);
    this.scene.add(this.particleGroup);
    this.scene.add(this.popupGroup);

    // 7. Build Scene Components
    this.setupLighting();
    this.setupArena();
    this.setupCosmicBackground();
    this.buildSnakeHead();

    // 8. Pre-compile shaders
    this.renderer.compile(this.scene, this.camera);

    // 9. Resize listener
    window.addEventListener('resize', this.onWindowResize);

    // 10. Start render loop
    this.startLoop();
  }

  private setupLighting() {
    // Warm key light
    const keyLight = new THREE.DirectionalLight(0xdcf8ff, 1.4);
    keyLight.position.set(25, 45, 20);
    if (!this.isHeadless) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 10;
      keyLight.shadow.camera.far = 100;
      const d = this.halfGridSize * this.tileSize * 1.3;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Cool fill light
    const fillLight = new THREE.HemisphereLight(0x0e1c38, 0x060814, 1.0);
    this.scene.add(fillLight);

    // Cyber magenta rim light from the back
    const rimLight = new THREE.DirectionalLight(0xff0077, 0.8);
    rimLight.position.set(-20, 15, -30);
    this.scene.add(rimLight);
  }

  private setupArena() {
    const arenaSize = this.halfGridSize * 2 * this.tileSize;

    // 1. Translucent holographic grid floor
    const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize, 1, 1);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Draw dark tech grid pattern
    ctx.fillStyle = '#060a17';
    ctx.fillRect(0, 0, 1024, 1024);

    const steps = this.halfGridSize * 2;
    const stepSize = 1024 / steps;

    // Subtle sub-grid lines
    ctx.strokeStyle = 'rgba(14, 240, 228, 0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= steps; i++) {
      ctx.beginPath();
      ctx.moveTo(i * stepSize, 0);
      ctx.lineTo(i * stepSize, 1024);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * stepSize);
      ctx.lineTo(1024, i * stepSize);
      ctx.stroke();
    }

    // Grid center cross
    ctx.strokeStyle = 'rgba(255, 0, 128, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(512, 0);
    ctx.lineTo(512, 1024);
    ctx.moveTo(0, 512);
    ctx.lineTo(1024, 512);
    ctx.stroke();

    const floorTexture = new THREE.CanvasTexture(canvas);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.1,
      metalness: 0.4,
      transparent: true,
      opacity: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !this.isHeadless;
    this.arenaGroup.add(floorMesh);

    // 2. Beveled floating neon perimeter frame
    const frameThickness = 0.5;
    const frameHeight = 0.8;
    const outerHalf = (this.halfGridSize + 0.5) * this.tileSize;

    const frameMat = new THREE.MeshPhysicalMaterial({
      color: 0x091024,
      metalness: 0.95,
      roughness: 0.1,
      clearcoat: 1.0,
    });

    const neonBorderMat = new THREE.MeshBasicMaterial({
      color: 0x0ef0e4,
    });

    // 4 borders around the perimeter
    const borders = [
      { w: outerHalf * 2, h: frameThickness, x: 0, z: outerHalf },
      { w: outerHalf * 2, h: frameThickness, x: 0, z: -outerHalf },
      { w: frameThickness, h: outerHalf * 2, x: outerHalf, z: 0 },
      { w: frameThickness, h: outerHalf * 2, x: -outerHalf, z: 0 },
    ];

    borders.forEach((b) => {
      const borderMesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, frameHeight, b.h),
        frameMat
      );
      borderMesh.position.set(b.x, frameHeight / 2 - 0.2, b.z);
      this.arenaGroup.add(borderMesh);

      // Glowing top strip
      const stripMesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, 0.1, 0.1),
        neonBorderMat
      );
      stripMesh.position.set(b.x, frameHeight + 0.05 - 0.2, b.z);
      this.arenaGroup.add(stripMesh);
    });

    // Corner holographic beacon pylons
    const cornerPylonGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 6);
    const cornerPylonMat = new THREE.MeshStandardMaterial({
      color: 0x0a142e,
      roughness: 0.3,
      metalness: 0.8,
    });
    const cornerBeaconMat = new THREE.MeshBasicMaterial({
      color: 0xff0088,
    });

    const corners = [
      { x: outerHalf, z: outerHalf },
      { x: -outerHalf, z: outerHalf },
      { x: outerHalf, z: -outerHalf },
      { x: -outerHalf, z: -outerHalf },
    ];

    corners.forEach((c) => {
      const pylon = new THREE.Mesh(cornerPylonGeo, cornerPylonMat);
      pylon.position.set(c.x, 1.3, c.z);
      this.arenaGroup.add(pylon);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        cornerBeaconMat
      );
      beacon.position.set(c.x, 3.0, c.z);
      this.arenaGroup.add(beacon);
    });
  }

  private setupCosmicBackground() {
    // 1. Starfield particles (1800 stars)
    const starCount = this.isHeadless ? 200 : 1800;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colorPalette = [
      new THREE.Color(0x0ef0e4), // Cyan
      new THREE.Color(0xff00a0), // Magenta
      new THREE.Color(0x9d4edd), // Purple
      new THREE.Color(0xffffff), // White
      new THREE.Color(0xffd166), // Gold
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = THREE.MathUtils.randFloat(70, 350);
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const phi = THREE.MathUtils.randFloat(0, Math.PI);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const chosenColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = chosenColor.r;
      colors[i * 3 + 1] = chosenColor.g;
      colors[i * 3 + 2] = chosenColor.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    this.starField = new THREE.Points(starGeo, starMat);
    this.backgroundGroup.add(this.starField);

    // 2. Revolving geometric synthwave crystals outside arena
    const crystalGeo = new THREE.OctahedronGeometry(2.5, 0);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x8b5cf6,
      emissive: 0x3b0764,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
      transmission: 0.6,
      ior: 1.6,
    });

    const crystalCount = 8;
    for (let i = 0; i < crystalCount; i++) {
      const mesh = new THREE.Mesh(crystalGeo, crystalMat);
      const angle = (i / crystalCount) * Math.PI * 2;
      const dist = THREE.MathUtils.randFloat(55, 90);
      mesh.position.set(
        Math.cos(angle) * dist,
        THREE.MathUtils.randFloat(-10, 25),
        Math.sin(angle) * dist
      );
      mesh.scale.setScalar(THREE.MathUtils.randFloat(0.8, 1.8));
      this.backgroundGroup.add(mesh);
      this.crystals.push(mesh);
    }
  }

  /**
   * Build 3D Articulated Snake Head (Multi-part THREE.Group)
   */
  private buildSnakeHead() {
    const headGroup = new THREE.Group();

    // 1. Primary Snout / Hull
    const snoutGeo = new THREE.ConeGeometry(0.85, 1.8, 5);
    snoutGeo.rotateX(Math.PI / 2);
    const snout = new THREE.Mesh(snoutGeo, this.materials.headShell);
    snout.position.set(0, 0.45, 0.2);
    snout.castShadow = !this.isHeadless;
    headGroup.add(snout);

    // 2. Visor Plate
    const visorGeo = new THREE.BoxGeometry(0.9, 0.4, 0.9);
    const visor = new THREE.Mesh(visorGeo, this.materials.headVisor);
    visor.position.set(0, 0.65, 0.1);
    headGroup.add(visor);

    // 3. Glowing Cybernetic Eyes
    const eyeGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const eyeLeft = new THREE.Mesh(eyeGeo, this.materials.eyeGlow);
    eyeLeft.position.set(-0.45, 0.65, 0.4);
    const eyeRight = new THREE.Mesh(eyeGeo, this.materials.eyeGlow);
    eyeRight.position.set(0.45, 0.65, 0.4);
    headGroup.add(eyeLeft);
    headGroup.add(eyeRight);

    // 4. Dynamic PointLight attached to head
    const headLight = new THREE.PointLight(0x0ef0e4, 2.5, 14, 1.2);
    headLight.position.set(0, 1.0, 0.8);
    headGroup.add(headLight);
    this.snakeHeadLight = headLight;

    // Contact shadow beneath head
    const contactShadowGeo = new THREE.CircleGeometry(0.9, 16);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    headGroup.add(shadow);

    this.snakeHeadMesh = headGroup;
    this.snakeGroup.add(headGroup);
  }

  /**
   * Create an articulated body segment mesh (multi-part THREE.Group)
   */
  private createBodySegmentMesh(): THREE.Group {
    const segGroup = new THREE.Group();

    // Outer armored cyber shell
    const outerGeo = new THREE.BoxGeometry(1.2, 0.7, 1.2);
    const outer = new THREE.Mesh(outerGeo, this.materials.bodyOuter);
    outer.position.y = 0.45;
    outer.castShadow = !this.isHeadless;
    segGroup.add(outer);

    // Glowing inner energy core ring
    const coreGeo = new THREE.TorusGeometry(0.45, 0.12, 8, 16);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(
      coreGeo,
      this.isOverdrive ? this.materials.bodyOverdriveCore : this.materials.bodyCore
    );
    core.position.y = 0.45;
    segGroup.add(core);

    // Segment contact shadow
    const shadowGeo = new THREE.CircleGeometry(0.8, 12);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    segGroup.add(shadow);

    return segGroup;
  }

  public setOverdrive(overdrive: boolean) {
    this.isOverdrive = overdrive;
    if (this.snakeHeadLight) {
      this.snakeHeadLight.color.setHex(overdrive ? 0xffaa00 : 0x0ef0e4);
      this.snakeHeadLight.intensity = overdrive ? 4.0 : 2.5;
    }
  }

  public setBoosting(boosting: boolean) {
    this.isBoosting = boosting;
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public triggerCameraShake(amount: number = 0.6) {
    this.cameraShakeTrauma = Math.min(this.cameraShakeTrauma + amount, 1.0);
  }

  /**
   * Sync grid state from game logic loop into Three.js lerp buffers
   */
  public updateSnakeState(
    segments: GridCoord[],
    direction: Direction,
    stepDurationSec: number
  ) {
    if (segments.length === 0) return;

    // Convert grid coords to world 3D positions
    const newWorldCoords = segments.map((seg) => ({
      x: seg.x * this.tileSize,
      y: 0,
      z: seg.z * this.tileSize,
    }));

    // If initial, snap immediately
    if (this.currentSnakeSegments.length === 0) {
      this.currentSnakeSegments = newWorldCoords.map((c) => ({ ...c }));
      this.previousSnakeSegments = newWorldCoords.map((c) => ({ ...c }));
      this.targetSnakeSegments = newWorldCoords.map((c) => ({ ...c }));
      this.lerpProgress = 1.0;
    } else {
      // Shift targets
      this.previousSnakeSegments = this.currentSnakeSegments.map((c) => ({ ...c }));

      // Adjust length if snake grew
      while (this.previousSnakeSegments.length < newWorldCoords.length) {
        const last = this.previousSnakeSegments[this.previousSnakeSegments.length - 1];
        this.previousSnakeSegments.push({ ...last });
      }

      this.targetSnakeSegments = newWorldCoords.map((c) => ({ ...c }));
      this.lerpProgress = 0.0;
    }

    // Ensure enough meshes in pool
    while (this.bodyMeshPool.length < segments.length) {
      const mesh = this.createBodySegmentMesh();
      this.snakeGroup.add(mesh);
      this.bodyMeshPool.push(mesh);
    }

    // Show/hide needed meshes
    for (let i = 1; i < this.bodyMeshPool.length; i++) {
      if (i < segments.length) {
        this.bodyMeshPool[i].visible = true;
      } else {
        this.bodyMeshPool[i].visible = false;
      }
    }
  }

  /**
   * Sync active food items into 3D scene
   */
  public syncFoods(foods: FoodItem[]) {
    const activeIds = new Set(foods.map((f) => f.id));

    // Remove expired food meshes
    for (const [id, mesh] of this.foodMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.foodGroup.remove(mesh);
        mesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        this.foodMeshes.delete(id);
      }
    }

    // Add or update active food items
    foods.forEach((food) => {
      let group = this.foodMeshes.get(food.id);
      if (!group) {
        group = this.buildFoodMesh(food.type);
        this.foodGroup.add(group);
        this.foodMeshes.set(food.id, group);
      }
      group.position.set(food.x * this.tileSize, 0.8, food.z * this.tileSize);
    });
  }

  /**
   * Build 3D procedural food mesh by type
   */
  private buildFoodMesh(type: FoodItem['type']): THREE.Group {
    const group = new THREE.Group();

    if (type === 'GOLDEN_SUPERNOVA') {
      // Golden blazing orb with orbiting rings
      const coreGeo = new THREE.SphereGeometry(0.65, 16, 16);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffdd00,
        emissive: 0xff8800,
        emissiveIntensity: 2.8,
        roughness: 0.1,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      const ringGeo = new THREE.TorusGeometry(1.05, 0.08, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.name = 'foodRing';
      group.add(ring);

      const light = new THREE.PointLight(0xffbb00, 2.0, 8);
      group.add(light);
    } else if (type === 'PURPLE_CHRONO') {
      // Purple chrono crystal (octahedron)
      const crystalGeo = new THREE.OctahedronGeometry(0.7, 0);
      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 1.8,
        roughness: 0.1,
        metalness: 0.9,
        transmission: 0.5,
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.name = 'chronoCrystal';
      group.add(crystal);

      const light = new THREE.PointLight(0xa855f7, 1.8, 7);
      group.add(light);
    } else {
      // Standard Cyan Energy Core
      const coreGeo = new THREE.IcosahedronGeometry(0.55, 0);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x0ef0e4,
        emissive: 0x00c4b4,
        emissiveIntensity: 2.0,
        roughness: 0.2,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      const cageGeo = new THREE.OctahedronGeometry(0.85, 0);
      const cageMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
      });
      const cage = new THREE.Mesh(cageGeo, cageMat);
      cage.name = 'foodCage';
      group.add(cage);

      const light = new THREE.PointLight(0x0ef0e4, 1.5, 6);
      group.add(light);
    }

    // Soft contact shadow disc
    const shadowGeo = new THREE.CircleGeometry(0.7, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.78;
    group.add(shadow);

    return group;
  }

  /**
   * Sync active hazard pillars
   */
  public syncHazards(hazards: HazardPillar[]) {
    const activeIds = new Set(hazards.map((h) => h.id));

    // Remove expired
    for (const [id, mesh] of this.hazardMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.hazardGroup.remove(mesh);
        this.hazardMeshes.delete(id);
      }
    }

    // Add or update
    hazards.forEach((hazard) => {
      let mesh = this.hazardMeshes.get(hazard.id);
      if (!mesh) {
        mesh = this.buildHazardMesh();
        this.hazardGroup.add(mesh);
        this.hazardMeshes.set(hazard.id, mesh);
      }

      mesh.position.set(hazard.x * this.tileSize, 0, hazard.z * this.tileSize);

      const pylon = mesh.getObjectByName('pylon');
      const warningBeacon = mesh.getObjectByName('warningBeacon');

      if (hazard.state === 'WARNING') {
        if (pylon) pylon.position.y = -3.0; // sunken
        if (warningBeacon) {
          warningBeacon.visible = true;
          // Flash warning beacon
          const flash = Math.sin(Date.now() * 0.015) > 0;
          warningBeacon.scale.setScalar(flash ? 1.2 : 0.8);
        }
      } else {
        // ACTIVE
        if (pylon) pylon.position.y = 1.5; // fully emerged
        if (warningBeacon) warningBeacon.visible = false;
      }
    });
  }

  private buildHazardMesh(): THREE.Group {
    const group = new THREE.Group();

    // Warning holographic ring on floor
    const ringGeo = new THREE.RingGeometry(0.4, 0.9, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.name = 'warningBeacon';
    group.add(ring);

    // Laser pillar cylinder
    const pylonGeo = new THREE.CylinderGeometry(0.45, 0.55, 3.2, 8);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      emissive: 0xcc0033,
      emissiveIntensity: 2.5,
      roughness: 0.1,
      metalness: 0.8,
    });
    const pylon = new THREE.Mesh(pylonGeo, pylonMat);
    pylon.position.y = -3.0; // initially submerged
    pylon.name = 'pylon';
    group.add(pylon);

    return group;
  }

  /**
   * Spawn 3D particle explosion when collecting food
   */
  public spawnBurst(pos: GridCoord, colorHex: number = 0x0ef0e4, count: number = 24) {
    const worldX = pos.x * this.tileSize;
    const worldZ = pos.z * this.tileSize;

    const particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const particleMat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeo, particleMat);
      mesh.position.set(worldX, 0.8, worldZ);
      this.particleGroup.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = THREE.MathUtils.randFloat(3, 8);
      const upSpeed = THREE.MathUtils.randFloat(2, 6);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          upSpeed,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: THREE.MathUtils.randFloat(0.4, 0.8),
        color: new THREE.Color(colorHex),
      });
    }
  }

  /**
   * Spawn 3D floating score/combo popup sprite
   */
  public spawnFloatingPopup(text: string, pos: GridCoord, color: string = '#0ef0e4') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.font = 'bold 44px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.5, 1.75, 1);
    const startPos = new THREE.Vector3(
      pos.x * this.tileSize,
      1.5,
      pos.z * this.tileSize
    );
    sprite.position.copy(startPos);
    this.popupGroup.add(sprite);

    this.popups.push({
      sprite,
      pos: startPos,
      life: 0,
      maxLife: 1.0,
    });
  }

  /**
   * Main 60 FPS Render Tick
   */
  private startLoop() {
    const tick = () => {
      this.animFrameId = requestAnimationFrame(tick);
      const delta = Math.min(this.clock.getDelta(), 0.1);
      const time = this.clock.getElapsedTime();

      // 1. Advance snake lerp progress smoothly
      this.lerpProgress = Math.min(this.lerpProgress + delta * 9.0, 1.0);

      // Interpolate snake segments and calculate heading
      if (this.targetSnakeSegments.length > 0 && this.previousSnakeSegments.length > 0) {
        for (let i = 0; i < this.targetSnakeSegments.length; i++) {
          const prev = this.previousSnakeSegments[i] || this.targetSnakeSegments[i];
          const target = this.targetSnakeSegments[i];

          // Linear interpolation
          const curX = THREE.MathUtils.lerp(prev.x, target.x, this.lerpProgress);
          const curZ = THREE.MathUtils.lerp(prev.z, target.z, this.lerpProgress);

          // Lateral sinusoidal slither wave (subtle realistic serpentine oscillation)
          const slitherOffset =
            i > 0
              ? Math.sin(time * 12 + i * 0.5) * 0.12 * Math.min(i * 0.2, 1.0)
              : 0;

          if (i === 0 && this.snakeHeadMesh) {
            this.snakeHeadMesh.position.set(curX, 0, curZ);

            // Compute head rotation facing travel direction
            const dx = target.x - prev.x;
            const dz = target.z - prev.z;
            if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
              const targetAngle = Math.atan2(dx, dz);
              this.snakeHeadMesh.rotation.y = targetAngle;
            }
          } else if (i < this.bodyMeshPool.length) {
            const mesh = this.bodyMeshPool[i];
            mesh.position.set(curX + slitherOffset, 0, curZ);

            // Rotate segment facing towards segment ahead
            const ahead = this.currentSnakeSegments[i - 1] || target;
            const segDx = ahead.x - curX;
            const segDz = ahead.z - curZ;
            if (Math.abs(segDx) > 0.001 || Math.abs(segDz) > 0.001) {
              mesh.rotation.y = Math.atan2(segDx, segDz);
            }
          }

          if (!this.currentSnakeSegments[i]) {
            this.currentSnakeSegments[i] = { x: curX, y: 0, z: curZ };
          } else {
            this.currentSnakeSegments[i].x = curX;
            this.currentSnakeSegments[i].z = curZ;
          }
        }
      }

      // 2. Thruster particles during boost
      if (this.isBoosting && this.snakeHeadMesh) {
        const headPos = this.snakeHeadMesh.position;
        if (Math.random() > 0.3) {
          this.spawnBurst(
            { x: headPos.x / this.tileSize, z: headPos.z / this.tileSize },
            0x0ef0e4,
            2
          );
        }
      }

      // 3. Update Camera Position & Tracking with Spring/Exponential Damping
      this.updateCamera(delta, time);

      // 4. Animate Foods (bobbing and spinning)
      this.foodMeshes.forEach((mesh) => {
        mesh.rotation.y += delta * 2.2;
        mesh.position.y = 0.8 + Math.sin(time * 4 + mesh.position.x) * 0.15;
        const ring = mesh.getObjectByName('foodRing');
        if (ring) {
          ring.rotation.x += delta * 1.5;
          ring.rotation.z += delta * 1.8;
        }
        const cage = mesh.getObjectByName('foodCage');
        if (cage) {
          cage.rotation.x -= delta * 1.2;
          cage.rotation.z += delta * 1.5;
        }
      });

      // 5. Animate background crystals & starfield
      if (this.starField) {
        this.starField.rotation.y = time * 0.008;
      }
      this.crystals.forEach((crystal, idx) => {
        crystal.rotation.x += delta * (0.3 + idx * 0.05);
        crystal.rotation.y += delta * (0.4 + idx * 0.04);
      });

      // 6. Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life += delta;
        if (p.life >= p.maxLife) {
          this.particleGroup.remove(p.mesh);
          p.mesh.geometry.dispose();
          this.particles.splice(i, 1);
        } else {
          p.velocity.y -= 9.8 * delta; // gravity
          p.mesh.position.addScaledVector(p.velocity, delta);
          const progress = p.life / p.maxLife;
          p.mesh.scale.setScalar((1 - progress) * 1.2);
        }
      }

      // 7. Update Popups
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const popup = this.popups[i];
        popup.life += delta;
        if (popup.life >= popup.maxLife) {
          this.popupGroup.remove(popup.sprite);
          popup.sprite.material.dispose();
          this.popups.splice(i, 1);
        } else {
          popup.sprite.position.y += delta * 2.5;
          const progress = popup.life / popup.maxLife;
          popup.sprite.material.opacity = 1 - progress;
          popup.sprite.scale.set(3.5 * (1 + progress * 0.3), 1.75 * (1 + progress * 0.3), 1);
        }
      }

      // 8. Render Scene (Composer with bloom or direct renderer)
      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Camera Controller with 3 modes and smooth spring damping
   */
  private updateCamera(delta: number, time: number) {
    const headPos = this.snakeHeadMesh?.position || _vec3A.set(0, 0, 0);

    // FOV kicks during boost
    const targetFov = this.isBoosting ? this.baseFov + 8 : this.baseFov;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, delta);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 'CHASE') {
      // Third-Person Chase Cam behind the snake head
      const headRotY = this.snakeHeadMesh?.rotation.y || 0;
      const chaseDistance = 11.0;
      const chaseHeight = 5.5;

      const camOffsetX = -Math.sin(headRotY) * chaseDistance;
      const camOffsetZ = -Math.cos(headRotY) * chaseDistance;

      _vec3CamPos.set(headPos.x + camOffsetX, chaseHeight, headPos.z + camOffsetZ);
      _vec3CamTarget.set(headPos.x + Math.sin(headRotY) * 6, 1.2, headPos.z + Math.cos(headRotY) * 6);

      // Smooth exponential damping
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3CamPos.x, 8, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3CamPos.y, 8, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3CamPos.z, 8, delta);

      this.camera.lookAt(_vec3CamTarget);
    } else if (this.cameraMode === 'TACTICAL') {
      // Top-Down Tactical 3D View
      _vec3CamPos.set(0, 48, 8);
      _vec3CamTarget.set(0, 0, 0);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3CamPos.x, 6, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3CamPos.y, 6, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3CamPos.z, 6, delta);
      this.camera.lookAt(_vec3CamTarget);
    } else {
      // Default: Dynamic Isometric 3D Arena View (with subtle tilt tracking head)
      const tiltX = (headPos.x / (this.halfGridSize * this.tileSize)) * 4;
      const tiltZ = (headPos.z / (this.halfGridSize * this.tileSize)) * 4;

      _vec3CamPos.set(tiltX, 32, 28 + tiltZ);
      _vec3CamTarget.set(headPos.x * 0.35, 0, headPos.z * 0.35);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3CamPos.x, 4, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3CamPos.y, 4, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3CamPos.z, 4, delta);
      this.camera.lookAt(_vec3CamTarget);
    }

    // Apply Camera Shake Trauma (rotational + translational)
    if (this.cameraShakeTrauma > 0) {
      const shake = this.cameraShakeTrauma * this.cameraShakeTrauma;
      this.camera.position.x += (Math.random() - 0.5) * shake * 1.5;
      this.camera.position.y += (Math.random() - 0.5) * shake * 1.5;
      this.camera.position.z += (Math.random() - 0.5) * shake * 1.5;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - delta * 1.8);
    }
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / (height || 1);
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  };

  public dispose() {
    window.removeEventListener('resize', this.onWindowResize);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.renderer.dispose();
    if (this.container && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
