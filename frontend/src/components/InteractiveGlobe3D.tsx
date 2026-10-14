import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  MapPin,
  AlertCircle,
  Info,
} from 'lucide-react';
import type { PointCoordinate, BoundingBox, RegionalAnnualMetric, SampledGridPoint } from '../types/api';
import {
  createScientificEarthCanvasTexture,
  getHazardMarkerColor,
  getHazardLegendConfig,
  SUPPORTED_OBSERVATORIES,
  type SupportedObservatory,
} from '../utils/globeTextures';

interface InteractiveGlobe3DProps {
  selectedPoint: PointCoordinate;
  onPointSelect: (pt: PointCoordinate) => void;
  selectedBounds?: BoundingBox | null;
  mode: 'point' | 'bounding_box';
  annualSeries?: RegionalAnnualMetric[];
  sampledPoints?: SampledGridPoint[];
  selectedYear?: number | null;
  onYearSelect?: (year: number) => void;
  hazardType?: string;
  onSwitchTo2DMap?: () => void;
}

export const InteractiveGlobe3D: React.FC<InteractiveGlobe3DProps> = ({
  selectedPoint,
  onPointSelect,
  selectedBounds: _selectedBounds,
  mode,
  annualSeries = [],
  sampledPoints = [],
  selectedYear = null,
  onYearSelect: _onYearSelect,
  hazardType = 'heatwave',
  onSwitchTo2DMap,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return true;
  });
  const isRotatingRef = useRef(isRotating);
  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  const [hoveredStation, setHoveredStation] = useState<SupportedObservatory | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [webglSupported] = useState<boolean>(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch {
      return true;
    }
  });
  const [legendOpen, setLegendOpen] = useState<boolean>(true);
  const [zoomDisplayPercent, setZoomDisplayPercent] = useState<number>(100);

  // References for Three.js objects
  const initialPointRef = useRef(selectedPoint);
  const targetZoomZRef = useRef<number>(230);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const stationsGroupRef = useRef<THREE.Group | null>(null);
  const targetBeaconGroupRef = useRef<THREE.Group | null>(null);
  const sampledGridGroupRef = useRef<THREE.Group | null>(null);
  const interactiveHitMeshesRef = useRef<Array<{ mesh: THREE.Mesh; observatory: SupportedObservatory }>>([]);

  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Convert lat/long to 3D Cartesian coordinates on sphere of radius R
  const latLongToVector3 = useCallback((lat: number, lon: number, radius: number): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }, []);


  // Derive observation metric for a given station and hazard type
  const getObservatoryMetricValue = useCallback(
    (obs: SupportedObservatory): { value: number; formatted: string } => {
      let val = 0;
      if (hazardType === 'heatwave') {
        val = obs.baselineHeatwaveDays;
        return { value: val, formatted: `${val.toFixed(1)} days/yr` };
      }
      if (hazardType === 'drought') {
        val = obs.baselineDroughtDeficitDays;
        return { value: val, formatted: `${val.toFixed(1)} deficit days/yr` };
      }
      // heavy_rainfall
      val = obs.baselineHeavyRainDays;
      return { value: val, formatted: `${val.toFixed(1)} extreme days/yr` };
    },
    [hazardType]
  );

  // Initialize Three.js 3D Scene
  useEffect(() => {
    if (!webglSupported || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 230;
    cameraRef.current = camera;

    // 2. High-Performance Antialiased WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020617, 0); // Transparent blend with slate dark dashboard
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Globe Root Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const RADIUS = 80;

    // 4. Base Earth Sphere with Guaranteed Scientific Canvas Texture
    const sphereGeometry = new THREE.SphereGeometry(RADIUS, 64, 64);

    // Create high-contrast scientific offline canvas texture
    const canvasTextureElement = createScientificEarthCanvasTexture(2048, 1024);
    const canvasTexture = new THREE.CanvasTexture(canvasTextureElement);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping;

    const sphereMaterial = new THREE.MeshStandardMaterial({
      map: canvasTexture,
      roughness: 0.6,
      metalness: 0.12,
    });
    const globeMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    globeGroup.add(globeMesh);

    // Progressive High-Res Texture Upgrade with Graceful Offline Fallback
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        sphereMaterial.map = loadedTexture;
        sphereMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback: procedural canvas texture remains active!
      }
    );

    // 5. High-Precision Graticule Lines (Parallels & Meridians)
    const graticuleGeometry = new THREE.WireframeGeometry(new THREE.SphereGeometry(RADIUS + 0.12, 36, 18));
    const graticuleMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
    });
    const graticuleMesh = new THREE.LineSegments(graticuleGeometry, graticuleMaterial);
    globeGroup.add(graticuleMesh);

    // 6. Atmospheric Cyan Glow Outer Shell
    const atmosphereGeometry = new THREE.SphereGeometry(RADIUS * 1.12, 48, 48);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Cyan atmospheric glow
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globeGroup.add(atmosphereMesh);

    // 7. Balanced Scientific Lighting
    // Strong ambient light ensures dark side of Earth remains visible and recognizable
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    // Primary solar directional light
    const dirLight1 = new THREE.DirectionalLight(0xe0f2fe, 2.2);
    dirLight1.position.set(180, 100, 160);
    scene.add(dirLight1);

    // Counter rim light for dimensional depth
    const dirLight2 = new THREE.DirectionalLight(0x0284c7, 0.9);
    dirLight2.position.set(-160, -90, -120);
    scene.add(dirLight2);

    // 8. Station Markers Group
    const stationsGroup = new THREE.Group();
    globeGroup.add(stationsGroup);
    stationsGroupRef.current = stationsGroup;

    // 9. Target Beacon Group (Selected Study Location)
    const targetBeaconGroup = new THREE.Group();
    globeGroup.add(targetBeaconGroup);
    targetBeaconGroupRef.current = targetBeaconGroup;

    // 10. Sampled Grid Points Group (Regional Bounding Box)
    const sampledGridGroup = new THREE.Group();
    globeGroup.add(sampledGridGroup);
    sampledGridGroupRef.current = sampledGridGroup;

    // 11. Starfield Background Particle Dust
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 350;
    const starCoords = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starCoords[i] = (Math.random() - 0.5) * 850;
      starCoords[i + 1] = (Math.random() - 0.5) * 850;
      starCoords[i + 2] = -180 - Math.random() * 250;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starCoords, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 1.2,
      transparent: true,
      opacity: 0.5,
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // 12. Initial Rotation towards target coordinate
    const targetPhi = (90 - initialPointRef.current.latitude) * (Math.PI / 180);
    const targetTheta = (initialPointRef.current.longitude + 180) * (Math.PI / 180);
    globeGroup.rotation.y = -targetTheta + Math.PI / 2;
    globeGroup.rotation.x = Math.max(-0.8, Math.min(0.8, targetPhi - Math.PI / 2));

    // 13. Smooth Animation Loop with Inertial Damping
    let pulseAngle = 0;
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (isRotatingRef.current && !isDraggingRef.current && globeGroupRef.current) {
        globeGroupRef.current.rotation.y += 0.0022; // Smooth auto rotation
      }

      // Inertial damping after user drag release
      if (!isDraggingRef.current && globeGroupRef.current) {
        globeGroupRef.current.rotation.y += mouseVelocityRef.current.x;
        globeGroupRef.current.rotation.x += mouseVelocityRef.current.y;
        mouseVelocityRef.current.x *= 0.92;
        mouseVelocityRef.current.y *= 0.92;
      }

      // Animate pulsing radar rings on target location beacon
      if (targetBeaconGroupRef.current) {
        pulseAngle += 0.06;
        const scale1 = 1.0 + Math.sin(pulseAngle) * 0.3;
        const scale2 = 1.0 + Math.cos(pulseAngle) * 0.25;
        const ring1 = targetBeaconGroupRef.current.getObjectByName('radarRing1');
        const ring2 = targetBeaconGroupRef.current.getObjectByName('radarRing2');
        if (ring1) ring1.scale.set(scale1, scale1, 1);
        if (ring2) ring2.scale.set(scale2, scale2, 1);
      }

      // Smooth camera zoom interpolation towards targetZoomZRef
      if (cameraRef.current) {
        const currentZ = cameraRef.current.position.z;
        const targetZ = targetZoomZRef.current;
        const diffZ = targetZ - currentZ;
        if (Math.abs(diffZ) > 0.04) {
          cameraRef.current.position.z += diffZ * 0.16;
        } else {
          cameraRef.current.position.z = targetZ;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 14. Responsive Resize Handler via ResizeObserver
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      if (newWidth === 0 || newHeight === 0) return;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Clean up on unmount
    return () => {
      resizeObserver.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      canvasTexture.dispose();
      graticuleGeometry.dispose();
      graticuleMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
      renderer.dispose();
    };
  }, [webglSupported, latLongToVector3]);

  // Update Station Markers whenever hazardType changes
  useEffect(() => {
    if (!stationsGroupRef.current) return;
    const stationsGroup = stationsGroupRef.current;

    // Clear previous station meshes
    while (stationsGroup.children.length > 0) {
      const child = stationsGroup.children[0];
      stationsGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    interactiveHitMeshesRef.current = [];
    const RADIUS = 80;

    SUPPORTED_OBSERVATORIES.forEach((obs) => {
      const pos = latLongToVector3(obs.latitude, obs.longitude, RADIUS + 0.8);
      const metricInfo = getObservatoryMetricValue(obs);
      const colorHex = getHazardMarkerColor(hazardType, metricInfo.value);
      const threeColor = new THREE.Color(colorHex);

      // 1. Station Observation Core Sphere
      const dotGeo = new THREE.SphereGeometry(1.6, 16, 16);
      const dotMat = new THREE.MeshStandardMaterial({
        color: threeColor,
        emissive: threeColor,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      stationsGroup.add(dotMesh);

      // 2. Surrounding Observation Halo Ring
      const ringGeo = new THREE.RingGeometry(2.2, 3.0, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: threeColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
      stationsGroup.add(ringMesh);

      // 3. Invisible Hit Target Sphere for easy Raycasting & Tooltip Triggering
      const hitGeo = new THREE.SphereGeometry(4.2, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(pos);
      stationsGroup.add(hitMesh);

      interactiveHitMeshesRef.current.push({ mesh: hitMesh, observatory: obs });
    });
  }, [hazardType, latLongToVector3, getObservatoryMetricValue]);

  // Update Target Study Location Beacon when selectedPoint changes
  useEffect(() => {
    if (!targetBeaconGroupRef.current) return;
    const targetGroup = targetBeaconGroupRef.current;

    // Clear previous beacon meshes
    while (targetGroup.children.length > 0) {
      const child = targetGroup.children[0];
      targetGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    const RADIUS = 80;
    const surfacePos = latLongToVector3(selectedPoint.latitude, selectedPoint.longitude, RADIUS + 0.2);
    const elevatedPos = latLongToVector3(selectedPoint.latitude, selectedPoint.longitude, RADIUS + 5.5);

    // 1. Radar Pulse Ring 1 (Surface)
    const ring1Geo = new THREE.RingGeometry(3.5, 4.6, 32);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Amber highlight
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring1Mesh = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1Mesh.name = 'radarRing1';
    ring1Mesh.position.copy(surfacePos);
    ring1Mesh.lookAt(new THREE.Vector3(0, 0, 0));
    targetGroup.add(ring1Mesh);

    // 2. Radar Pulse Ring 2 (Outer Ripple)
    const ring2Geo = new THREE.RingGeometry(5.2, 6.2, 32);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2Mesh.name = 'radarRing2';
    ring2Mesh.position.copy(surfacePos);
    ring2Mesh.lookAt(new THREE.Vector3(0, 0, 0));
    targetGroup.add(ring2Mesh);

    // 3. Elevated Target Pin Marker (Elevated Head Sphere)
    const headGeo = new THREE.SphereGeometry(2.4, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.9,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.copy(elevatedPos);
    targetGroup.add(headMesh);

    // 4. Vertical Beacon Stem Line
    const stemGeo = new THREE.BufferGeometry().setFromPoints([surfacePos, elevatedPos]);
    const stemMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    const stemLine = new THREE.Line(stemGeo, stemMat);
    targetGroup.add(stemLine);

    // Smoothly re-orient globe towards selected location
    if (globeGroupRef.current) {
      const targetPhi = (90 - selectedPoint.latitude) * (Math.PI / 180);
      const targetTheta = (selectedPoint.longitude + 180) * (Math.PI / 180);
      globeGroupRef.current.rotation.y = -targetTheta + Math.PI / 2;
      globeGroupRef.current.rotation.x = Math.max(-0.8, Math.min(0.8, targetPhi - Math.PI / 2));
    }
  }, [selectedPoint, latLongToVector3]);

  // Update Sampled Grid Points (Bounding Box regional mode)
  useEffect(() => {
    if (!sampledGridGroupRef.current) return;
    const gridGroup = sampledGridGroupRef.current;

    while (gridGroup.children.length > 0) {
      const child = gridGroup.children[0];
      gridGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    if (mode !== 'bounding_box' || !sampledPoints || sampledPoints.length === 0) return;

    const RADIUS = 80;
    const yearMetric = annualSeries?.find((s) => s.year === selectedYear);

    sampledPoints.forEach((pt) => {
      const pos = latLongToVector3(pt.latitude, pt.longitude, RADIUS + 0.6);
      const pointContrib = yearMetric?.point_contributions?.find((pc) => pc.grid_key === pt.grid_key);
      const val = pointContrib?.hazard_days ?? pointContrib?.primary_metric;
      const cellColorHex = val !== null && val !== undefined
        ? getHazardMarkerColor(hazardType, val)
        : '#06b6d4';
      const threeColor = new THREE.Color(cellColorHex);

      const dotGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
      const dotMat = new THREE.MeshStandardMaterial({
        color: threeColor,
        emissive: threeColor,
        emissiveIntensity: 0.6,
      });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      dotMesh.lookAt(new THREE.Vector3(0, 0, 0));
      gridGroup.add(dotMesh);
    });
  }, [mode, sampledPoints, annualSeries, selectedYear, hazardType, latLongToVector3]);

  // Raycasting Helper for Detecting Marker Hover and Click
  const performRaycast = useCallback(
    (clientX: number, clientY: number): SupportedObservatory | null => {
      if (!cameraRef.current || !rendererRef.current || interactiveHitMeshesRef.current.length === 0) {
        return null;
      }
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const hitMeshes = interactiveHitMeshesRef.current.map((item) => item.mesh);
      const intersects = raycaster.intersectObjects(hitMeshes, false);

      if (intersects.length > 0) {
        const found = interactiveHitMeshesRef.current.find((item) => item.mesh === intersects[0].object);
        return found ? found.observatory : null;
      }
      return null;
    },
    []
  );

  // Mouse drag handlers with pointer raycasting
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    mouseVelocityRef.current = { x: 0, y: 0 };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current && globeGroupRef.current) {
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      globeGroupRef.current.rotation.y += deltaX * 0.0055;
      globeGroupRef.current.rotation.x += deltaY * 0.0055;
      globeGroupRef.current.rotation.x = Math.max(-1.1, Math.min(1.1, globeGroupRef.current.rotation.x));

      mouseVelocityRef.current = { x: deltaX * 0.003, y: deltaY * 0.003 };
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // Hover detection
      const hovered = performRaycast(e.clientX, e.clientY);
      setHoveredStation(hovered);
      if (hovered && mountRef.current) {
        const rect = mountRef.current.getBoundingClientRect();
        setHoverPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        setHoverPosition(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      // If drag delta was minimal, treat as a direct click
      const moveDistance = Math.hypot(
        e.clientX - previousMousePositionRef.current.x,
        e.clientY - previousMousePositionRef.current.y
      );
      if (moveDistance < 4) {
        const clickedObs = performRaycast(e.clientX, e.clientY);
        if (clickedObs) {
          onPointSelect({ latitude: clickedObs.latitude, longitude: clickedObs.longitude });
        }
      }
    }
    isDraggingRef.current = false;
  };

  // Zoom Controls with Smooth Clamping
  const applyZoom = useCallback((delta: number) => {
    const current = targetZoomZRef.current;
    const next = Math.max(105, Math.min(380, current + delta));
    targetZoomZRef.current = next;
    setZoomDisplayPercent(Math.round((230 / next) * 100));
  }, []);

  const handleZoomIn = useCallback((step = 32) => {
    applyZoom(-step);
  }, [applyZoom]);

  const handleZoomOut = useCallback((step = 32) => {
    applyZoom(step);
  }, [applyZoom]);

  const handleResetView = useCallback(() => {
    targetZoomZRef.current = 230;
    setZoomDisplayPercent(100);
    if (!globeGroupRef.current) return;
    const targetPhi = (90 - selectedPoint.latitude) * (Math.PI / 180);
    const targetTheta = (selectedPoint.longitude + 180) * (Math.PI / 180);
    globeGroupRef.current.rotation.y = -targetTheta + Math.PI / 2;
    globeGroupRef.current.rotation.x = Math.max(-0.8, Math.min(0.8, targetPhi - Math.PI / 2));
    mouseVelocityRef.current = { x: 0, y: 0 };
  }, [selectedPoint]);

  // Bind Native Non-Passive Event Listeners for Trackpad Pinch & Pan, Touch, and Double-Click
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let touchStartDist = 0;
    let touchStartPos = { x: 0, y: 0 };
    let isTouchDragging = false;

    // High-Precision Trackpad & Mouse Wheel Handler
    const onWheelNative = (e: WheelEvent) => {
      // Prevent browser page zoom on trackpad pinch and prevent page scrolling when interacting over globe
      e.preventDefault();

      if (e.ctrlKey) {
        // Trackpad Pinch-to-Zoom Gesture (ctrlKey is true during precision trackpad pinch)
        // deltaY is negative when pinching out (zoom in), positive when pinching in (zoom out)
        const pinchDelta = e.deltaY * 0.85;
        applyZoom(pinchDelta);
      } else {
        // Trackpad Two-Finger Pan / Orbit or Mouse Wheel
        // Horizontal trackpad swipe rotates the globe horizontally
        if (Math.abs(e.deltaX) > 1.2 && globeGroupRef.current) {
          globeGroupRef.current.rotation.y += e.deltaX * 0.0035;
        }

        // Vertical scroll zooms camera smoothly
        if (Math.abs(e.deltaY) > 0.3) {
          // deltaMode 1 = line mode (discrete mouse wheel click), deltaMode 0 = pixel mode (trackpad)
          const factor = e.deltaMode === 1 ? 16 : 0.45;
          applyZoom(e.deltaY * factor);
        }
      }
    };

    // Touch Event Handlers for Mobile and Touchpad Pinch-to-Zoom
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.hypot(dx, dy);
      } else if (e.touches.length === 1) {
        isTouchDragging = true;
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        if (touchStartDist > 0) {
          const pinchDelta = (touchStartDist - currentDist) * 0.75;
          applyZoom(pinchDelta);
        }
        touchStartDist = currentDist;
      } else if (e.touches.length === 1 && isTouchDragging && globeGroupRef.current) {
        const deltaX = e.touches[0].clientX - touchStartPos.x;
        const deltaY = e.touches[0].clientY - touchStartPos.y;
        globeGroupRef.current.rotation.y += deltaX * 0.006;
        globeGroupRef.current.rotation.x = Math.max(
          -1.1,
          Math.min(1.1, globeGroupRef.current.rotation.x + deltaY * 0.006)
        );
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchEnd = () => {
      touchStartDist = 0;
      isTouchDragging = false;
    };

    // Double-click to zoom in, Shift + double-click to zoom out
    const onDoubleClick = (e: MouseEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        handleZoomOut(45);
      } else {
        handleZoomIn(45);
      }
    };

    container.addEventListener('wheel', onWheelNative, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('dblclick', onDoubleClick);

    return () => {
      container.removeEventListener('wheel', onWheelNative);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('dblclick', onDoubleClick);
    };
  }, [applyZoom, handleZoomIn, handleZoomOut]);

  // Global Keyboard Shortcuts for Zoom and Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if (e.key === '+' || e.key === '=') {
        handleZoomIn(30);
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut(30);
      } else if (e.key === '0' || e.key === 'r' || e.key === 'R') {
        handleResetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetView]);

  const legendConfig = getHazardLegendConfig(hazardType);

  if (!webglSupported) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-300 space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-100">WebGL Context Unavailable</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Your browser or display environment does not currently have WebGL hardware acceleration enabled.
          Dygnify seamlessly provides a complete 2D Leaflet map experience.
        </p>
        {onSwitchTo2DMap && (
          <button
            onClick={onSwitchTo2DMap}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
          >
            Switch to 2D Regional Map View
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 select-none">
      {/* 3D WebGL Canvas Layer */}
      <div
        ref={mountRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Tooltip when Hovering an Observatory Marker */}
      {hoveredStation && hoverPosition && (
        <div
          className="absolute pointer-events-none z-30 bg-slate-950/95 border border-cyan-500/60 rounded-lg p-2.5 shadow-2xl text-[11px] font-mono space-y-1 transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: hoverPosition.x, top: hoverPosition.y - 12 }}
        >
          <div className="text-cyan-300 font-bold flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span>
              {hoveredStation.name}, {hoveredStation.country}
            </span>
          </div>
          <div className="text-slate-400 text-[10px]">
            {hoveredStation.latitude.toFixed(2)}°N, {hoveredStation.longitude.toFixed(2)}°E •{' '}
            {hoveredStation.climateZone}
          </div>
          <div className="text-amber-400 text-[10px] pt-1 border-t border-slate-800">
            {hazardType.replace('_', ' ').toUpperCase()}:{' '}
            {getObservatoryMetricValue(hoveredStation).formatted}
          </div>
          <div className="text-slate-500 text-[9px]">Click marker to analyze this location</div>
        </div>
      )}

      {/* Dynamic Scientific Legend Overlay (Right Edge / Collapsible) */}
      <div className="absolute top-16 sm:top-20 right-3 sm:right-4 z-20 bg-slate-950/85 border border-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl text-[11px] font-mono transition-all max-w-[220px]">
        <div
          onClick={() => setLegendOpen(!legendOpen)}
          className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer border-b border-slate-800/60 hover:bg-slate-900/50"
        >
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px] uppercase">
            <Info className="w-3.5 h-3.5" />
            <span>{legendConfig.title} Scale</span>
            {selectedYear && (
              <span className="text-slate-400 font-normal lowercase tracking-normal">
                ({selectedYear})
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">{legendOpen ? '▲' : '▼'}</span>
        </div>

        {legendOpen && (
          <div className="p-3 space-y-2">
            <div className="text-[10px] text-slate-400 italic leading-tight">
              {legendConfig.metricName} ({legendConfig.units})
            </div>

            <div className="space-y-1.5 pt-1">
              {legendConfig.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-[10px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-300 truncate">{item.label}</span>
                  </div>
                  <span className="text-slate-500 font-semibold shrink-0">{item.rangeText}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-300 shrink-0" />
              <span className="text-amber-300 font-semibold">Active Study Site</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating On-Globe Zoom & Navigation Control Dock (Bottom-Right) */}
      <div className="absolute bottom-4 sm:bottom-6 right-3 sm:right-6 flex flex-col items-center gap-1.5 bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-xl p-1.5 shadow-2xl z-20">
        {/* Zoom In */}
        <button
          onClick={() => handleZoomIn(35)}
          className="p-2 rounded-lg bg-slate-900 hover:bg-cyan-950/80 hover:text-cyan-300 text-slate-300 border border-slate-800 hover:border-cyan-700/60 transition shadow-xs group"
          title="Zoom In (Key '+' or Double-Click)"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>

        {/* Zoom Level Indicator */}
        <button
          onClick={handleResetView}
          className="w-11 py-1 text-[10px] font-mono font-bold text-center text-cyan-400 bg-slate-900/80 hover:bg-cyan-950/80 rounded border border-slate-800/80 transition"
          title="Current zoom level • Click to reset to 100%"
        >
          {zoomDisplayPercent}%
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => handleZoomOut(35)}
          className="p-2 rounded-lg bg-slate-900 hover:bg-cyan-950/80 hover:text-cyan-300 text-slate-300 border border-slate-800 hover:border-cyan-700/60 transition shadow-xs group"
          title="Zoom Out (Key '-' or Shift+Double-Click)"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>

        <div className="w-6 h-px bg-slate-800/80 my-0.5" />

        {/* Reset Camera View */}
        <button
          onClick={handleResetView}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition shadow-xs group"
          title="Center Target Coordinate (Key 'R' or '0')"
          aria-label="Reset View"
        >
          <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
        </button>

        {/* Auto-Rotation Toggle */}
        <button
          onClick={() => setIsRotating(!isRotating)}
          className={`p-2 rounded-lg border transition shadow-xs group ${isRotating
              ? 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          title={isRotating ? 'Pause auto-rotation' : 'Resume auto-rotation'}
          aria-label="Toggle auto-rotation"
        >
          {isRotating ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
        </button>
      </div>

      {/* Data Provenance & Interactive Trackpad/Gesture Hint Notice */}
      <div className="absolute bottom-24 sm:bottom-6 left-4 sm:left-[360px] md:left-[420px] bg-slate-950/85 border border-slate-800/80 backdrop-blur rounded-lg px-3 py-1.5 shadow-xl text-[10px] font-mono text-slate-400 hidden lg:flex items-center gap-2 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">ECMWF ERA5</span>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-2 text-slate-400">
          <span>
            <strong className="text-cyan-300">Trackpad:</strong> Pinch / swipe
          </span>
          <span className="text-slate-600">|</span>
          <span>
            <strong className="text-slate-300">Mouse:</strong> Scroll to zoom • Drag to orbit
          </span>
        </div>
      </div>
    </div>
  );
};
