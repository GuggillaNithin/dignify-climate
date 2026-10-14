/**
 * Scientific Earth Texture Generator & Climate Hazard Color Mappers.
 *
 * Generates an offline, guaranteed-visible high-contrast dark scientific
 * equirectangular Earth texture with recognizable continents, coastlines,
 * bathymetry, and graticule lines.
 *
 * Provides documented scientific color palettes for Heatwaves, Droughts,
 * and Heavy Rainfall extremes.
 */

export interface HazardLegendItem {
  label: string;
  color: string;
  rangeText: string;
}

export interface HazardLegendConfig {
  title: string;
  metricName: string;
  units: string;
  items: HazardLegendItem[];
}

export interface SupportedObservatory {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  description: string;
  climateZone: string;
  baselineHeatwaveDays: number;
  baselineDroughtDeficitDays: number;
  baselineHeavyRainDays: number;
}

export const SUPPORTED_OBSERVATORIES: SupportedObservatory[] = [
  {
    name: 'Tokyo',
    country: 'Japan',
    latitude: 35.6895,
    longitude: 139.6917,
    climateZone: 'Humid Subtropical',
    description: 'East Asia temperate urban island',
    baselineHeatwaveDays: 14.2,
    baselineDroughtDeficitDays: 12.0,
    baselineHeavyRainDays: 16.5,
  },
  {
    name: 'London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    climateZone: 'Oceanic',
    description: 'Northwest Europe maritime basin',
    baselineHeatwaveDays: 6.5,
    baselineDroughtDeficitDays: 8.2,
    baselineHeavyRainDays: 7.1,
  },
  {
    name: 'San Francisco',
    country: 'United States',
    latitude: 37.7749,
    longitude: -122.4194,
    climateZone: 'Mediterranean',
    description: 'Pacific coastal upwelling regime',
    baselineHeatwaveDays: 8.1,
    baselineDroughtDeficitDays: 28.4,
    baselineHeavyRainDays: 9.3,
  },
  {
    name: 'Cairo',
    country: 'Egypt',
    latitude: 30.0444,
    longitude: 31.2357,
    climateZone: 'Hyper-Arid',
    description: 'Lower Nile desert transition',
    baselineHeatwaveDays: 24.8,
    baselineDroughtDeficitDays: 52.0,
    baselineHeavyRainDays: 1.2,
  },
  {
    name: 'Sydney',
    country: 'Australia',
    latitude: -33.8688,
    longitude: 151.2093,
    climateZone: 'Humid Subtropical',
    description: 'South Pacific coastal basin',
    baselineHeatwaveDays: 11.4,
    baselineDroughtDeficitDays: 18.2,
    baselineHeavyRainDays: 14.8,
  },
  {
    name: 'São Paulo',
    country: 'Brazil',
    latitude: -23.5505,
    longitude: -46.6333,
    climateZone: 'Subtropical Highland',
    description: 'Atlantic highland plateau',
    baselineHeatwaveDays: 13.0,
    baselineDroughtDeficitDays: 15.6,
    baselineHeavyRainDays: 21.0,
  },
  {
    name: 'Mumbai',
    country: 'India',
    latitude: 19.0760,
    longitude: 72.8777,
    climateZone: 'Tropical Monsoon',
    description: 'Arabian Sea monsoon coastal plain',
    baselineHeatwaveDays: 16.5,
    baselineDroughtDeficitDays: 22.1,
    baselineHeavyRainDays: 29.4,
  },
  {
    name: 'Nairobi',
    country: 'Kenya',
    latitude: -1.2921,
    longitude: 36.8219,
    climateZone: 'Subtropical Highland',
    description: 'East African rift plateau',
    baselineHeatwaveDays: 7.8,
    baselineDroughtDeficitDays: 26.5,
    baselineHeavyRainDays: 12.3,
  },
  {
    name: 'Nuuk',
    country: 'Greenland',
    latitude: 64.1814,
    longitude: -51.6941,
    climateZone: 'Tundra / Polar',
    description: 'Subpolar Arctic coastal fjord',
    baselineHeatwaveDays: 1.1,
    baselineDroughtDeficitDays: 5.0,
    baselineHeavyRainDays: 4.2,
  },
  {
    name: 'Singapore',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    climateZone: 'Tropical Rainforest',
    description: 'Equatorial maritime convection',
    baselineHeatwaveDays: 18.9,
    baselineDroughtDeficitDays: 9.4,
    baselineHeavyRainDays: 26.8,
  },
  {
    name: 'Buenos Aires',
    country: 'Argentina',
    latitude: -34.6037,
    longitude: -58.3816,
    climateZone: 'Humid Subtropical',
    description: 'Río de la Plata estuary',
    baselineHeatwaveDays: 12.6,
    baselineDroughtDeficitDays: 14.1,
    baselineHeavyRainDays: 15.2,
  },
  {
    name: 'Reykjavik',
    country: 'Iceland',
    latitude: 64.1466,
    longitude: -21.9426,
    climateZone: 'Subpolar Oceanic',
    description: 'North Atlantic subarctic transition',
    baselineHeatwaveDays: 2.4,
    baselineDroughtDeficitDays: 6.2,
    baselineHeavyRainDays: 8.7,
  },
];

/**
 * Maps a numerical hazard metric to a documented color hex string.
 *
 * @param hazardType 'heatwave' | 'drought' | 'heavy_rainfall'
 * @param value Metric value (e.g. days/yr or mm)
 */
export function getHazardMarkerColor(hazardType: string, value: number): string {
  switch (hazardType) {
    case 'heatwave':
      // Yellow -> Orange -> Deep Red
      if (value < 5) return '#eab308'; // Moderate yellow
      if (value < 12) return '#f97316'; // Vivid orange
      if (value < 20) return '#ea580c'; // Red-orange
      return '#dc2626'; // Deep crimson red

    case 'drought':
      // Sand / Khaki -> Ochre -> Rust -> Dark Desiccation Crimson
      if (value < 10) return '#d4c38d'; // Pale dry sand
      if (value < 25) return '#d97706'; // Warm ochre
      if (value < 45) return '#b45309'; // Rust brown-red
      return '#7f1d1d'; // Severe deficit maroon

    case 'heavy_rainfall':
      // Sky Cyan -> Royal Cobalt -> Electric Indigo -> Violet Purple
      if (value < 5) return '#38bdf8'; // Sky cyan
      if (value < 15) return '#2563eb'; // Royal blue
      if (value < 25) return '#6366f1'; // Electric indigo
      return '#9333ea'; // Torrential violet purple

    default:
      return '#38bdf8';
  }
}

/**
 * Returns legend definitions, units, and threshold swatches for the selected hazard.
 */
export function getHazardLegendConfig(hazardType: string): HazardLegendConfig {
  switch (hazardType) {
    case 'heatwave':
      return {
        title: 'Heatwave Exposure',
        metricName: 'Annual Heatwave Days strictly exceeding 95th percentile',
        units: 'days/year',
        items: [
          { label: 'Low (< 5d)', color: '#eab308', rangeText: '< 5 days' },
          { label: 'Moderate (5–12d)', color: '#f97316', rangeText: '5–12 days' },
          { label: 'High (12–20d)', color: '#ea580c', rangeText: '12–20 days' },
          { label: 'Severe (> 20d)', color: '#dc2626', rangeText: '> 20 days' },
        ],
      };

    case 'drought':
      return {
        title: 'Precipitation Deficit',
        metricName: '90-Day Rolling Deficit Days relative to seasonal norm',
        units: 'deficit days/year',
        items: [
          { label: 'Mild (< 10d)', color: '#d4c38d', rangeText: '< 10 days' },
          { label: 'Moderate (10–25d)', color: '#d97706', rangeText: '10–25 days' },
          { label: 'Severe (25–45d)', color: '#b45309', rangeText: '25–45 days' },
          { label: 'Extreme (> 45d)', color: '#7f1d1d', rangeText: '> 45 days' },
        ],
      };

    case 'heavy_rainfall':
      return {
        title: 'Heavy Precipitation',
        metricName: 'Extreme Wet-Day Exceedance (P ≥ 95th wet percentile)',
        units: 'extreme days/year',
        items: [
          { label: 'Moderate (< 5d)', color: '#38bdf8', rangeText: '< 5 days' },
          { label: 'Heavy (5–15d)', color: '#2563eb', rangeText: '5–15 days' },
          { label: 'Intense (15–25d)', color: '#6366f1', rangeText: '15–25 days' },
          { label: 'Torrential (> 25d)', color: '#9333ea', rangeText: '> 25 days' },
        ],
      };

    default:
      return {
        title: 'Climate Hazard Indicator',
        metricName: 'Observed Hazard Days',
        units: 'days/year',
        items: [
          { label: 'Baseline', color: '#38bdf8', rangeText: 'Normal' },
          { label: 'Elevated', color: '#f59e0b', rangeText: 'Exceedance' },
        ],
      };
  }
}

/**
 * Polygon definitions for world continents in [lon, lat] degrees.
 * Used for drawing recognizable continents on an equirectangular canvas.
 */
const WORLD_LANDMASS_POLYGONS: Array<Array<[number, number]>> = [
  // 1. Africa
  [
    [-17, 15], [-17, 21], [-13, 28], [-5, 36], [10, 37], [12, 33], [25, 32], [32, 31],
    [34, 28], [36, 22], [43, 13], [51, 12], [49, 10], [44, 4], [40, -4], [36, -11],
    [33, -27], [28, -33], [19, -35], [18, -34], [14, -23], [12, -15], [9, -4], [4, 5],
    [-4, 5], [-8, 4], [-12, 8], [-17, 11], [-17, 15]
  ],
  // 2. Eurasia (Europe & Asia mainland)
  [
    [-9, 36], [-9, 43], [-1, 44], [-4, 48], [2, 51], [8, 54], [5, 58], [10, 60],
    [18, 60], [25, 71], [30, 70], [40, 68], [60, 73], [75, 73], [90, 77], [105, 77],
    [130, 73], [150, 71], [170, 67], [180, 65], [170, 60], [160, 55], [140, 53],
    [130, 42], [122, 30], [118, 22], [108, 18], [105, 10], [100, 2], [97, 18],
    [88, 22], [80, 13], [77, 8], [72, 19], [68, 24], [60, 25], [55, 23], [51, 26],
    [48, 30], [36, 32], [36, 36], [30, 41], [26, 38], [20, 37], [15, 41], [12, 44],
    [5, 43], [3, 42], [-3, 36], [-9, 36]
  ],
  // 3. North America
  [
    [-168, 65], [-160, 56], [-150, 60], [-135, 54], [-125, 49], [-122, 37], [-117, 32],
    [-110, 23], [-105, 20], [-97, 18], [-90, 16], [-83, 9], [-77, 8], [-80, 22],
    [-82, 25], [-80, 31], [-75, 35], [-70, 42], [-65, 45], [-60, 47], [-64, 50],
    [-60, 55], [-64, 60], [-75, 62], [-85, 65], [-95, 70], [-115, 70], [-135, 70],
    [-155, 71], [-165, 68], [-168, 65]
  ],
  // 4. South America
  [
    [-77, 8], [-72, 11], [-60, 8], [-52, 4], [-44, -2], [-35, -5], [-35, -10],
    [-40, -22], [-48, -28], [-55, -34], [-65, -42], [-66, -54], [-73, -53], [-75, -45],
    [-72, -35], [-70, -20], [-77, -10], [-80, -2], [-79, 4], [-77, 8]
  ],
  // 5. Australia
  [
    [114, -22], [113, -26], [115, -34], [120, -34], [130, -32], [138, -35], [140, -38],
    [148, -38], [151, -33], [153, -28], [150, -20], [143, -11], [136, -12], [130, -13],
    [123, -16], [117, -20], [114, -22]
  ],
  // 6. Greenland
  [
    [-52, 60], [-42, 60], [-35, 65], [-20, 70], [-18, 77], [-25, 82], [-45, 83],
    [-60, 81], [-60, 76], [-53, 70], [-52, 60]
  ],
  // 7. Antarctica
  [
    [-180, -78], [-120, -74], [-60, -65], [-40, -74], [0, -69], [40, -68],
    [80, -66], [120, -66], [160, -70], [180, -78], [180, -90], [-180, -90], [-180, -78]
  ],
  // 8. Great Britain
  [
    [-5, 50], [0, 51], [1, 53], [0, 55], [-2, 57], [-5, 58], [-6, 56], [-4, 53], [-5, 50]
  ],
  // 9. Japan
  [
    [130, 32], [131, 34], [136, 35], [140, 36], [141, 40], [144, 44], [142, 45],
    [140, 42], [137, 37], [133, 34], [130, 32]
  ],
  // 10. Madagascar
  [
    [44, -13], [50, -15], [50, -20], [47, -25], [44, -25], [44, -18], [44, -13]
  ],
  // 11. New Zealand
  [
    [168, -46], [172, -43], [174, -41], [178, -38], [175, -36], [173, -35],
    [174, -39], [171, -42], [166, -46], [168, -46]
  ],
  // 12. Scandinavia / Baltic Area
  [
    [5, 58], [10, 60], [18, 60], [20, 65], [28, 70], [20, 71], [12, 65], [5, 62], [5, 58]
  ],
];

/**
 * Creates an HTML5 Canvas containing an equirectangular dark-scientific Earth texture
 * with recognizable continents, bathymetry, coastlines, and graticule lines.
 *
 * Guaranteed 100% offline, zero latency, and zero chance of a black sphere.
 */
export function createScientificEarthCanvasTexture(
  width = 2048,
  height = 1024
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Deep Ocean Base (Gradient: polar deep navy to equatorial slate-blue)
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#040918'); // Arctic deep abyss
  oceanGrad.addColorStop(0.3, '#071228'); // Temperate deep
  oceanGrad.addColorStop(0.5, '#0a1936'); // Equatorial oceanic navy
  oceanGrad.addColorStop(0.7, '#071228');
  oceanGrad.addColorStop(1, '#040918'); // Antarctic abyss
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Helper: Convert [lon, lat] degrees to canvas [x, y] pixels
  const toX = (lon: number) => ((lon + 180) / 360) * width;
  const toY = (lat: number) => ((90 - lat) / 180) * height;

  // 2. Continental Shelf / Coastal Bathymetry Glow
  ctx.save();
  ctx.fillStyle = '#0f2744';
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 18;

  WORLD_LANDMASS_POLYGONS.forEach((poly) => {
    if (poly.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  });
  ctx.restore();

  // 3. Continental Landmass Fill (Deep emerald-slate terrestrial topography)
  ctx.save();
  WORLD_LANDMASS_POLYGONS.forEach((poly) => {
    if (poly.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    ctx.closePath();

    // Subtle continent gradient
    const yMin = Math.min(...poly.map((p) => toY(p[1])));
    const yMax = Math.max(...poly.map((p) => toY(p[1])));
    const landGrad = ctx.createLinearGradient(0, yMin, 0, yMax || yMin + 10);
    landGrad.addColorStop(0, '#102830'); // Subpolar tundra / boreal slate
    landGrad.addColorStop(0.5, '#16383e'); // Temperate / tropical deep green-slate
    landGrad.addColorStop(1, '#0e242b');

    ctx.fillStyle = landGrad;
    ctx.fill();

    // Sharp Coastline Stroke
    ctx.strokeStyle = '#38bdf8'; // Glowing cyan coastline
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;
    ctx.stroke();
  });
  ctx.restore();

  // 4. Subtle Latitude Parallels (Equator, Tropics, Polar Circles)
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1.0;
  ctx.setLineDash([4, 6]);

  const parallels = [0, 23.436, -23.436, 66.5, -66.5];
  parallels.forEach((lat) => {
    const y = toY(lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });

  // Prime Meridian & 60-degree Meridians
  const meridians = [-120, -60, 0, 60, 120];
  meridians.forEach((lon) => {
    const x = toX(lon);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });
  ctx.restore();

  // 5. Equator Bold Accent
  ctx.save();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)'; // Cyan accent equator
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  const eqY = toY(0);
  ctx.moveTo(0, eqY);
  ctx.lineTo(width, eqY);
  ctx.stroke();
  ctx.restore();

  return canvas;
}
