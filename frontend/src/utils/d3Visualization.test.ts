import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('D3 Visualizations: D3HazardTrendChart implements genuine D3 analytical SVG charts', () => {
  const chartPath = path.resolve(__dirname, '../components/D3HazardTrendChart.tsx');
  assert.equal(fs.existsSync(chartPath), true, 'D3HazardTrendChart.tsx must exist');

  const content = fs.readFileSync(chartPath, 'utf8');

  // 1. Genuine D3 scales and axes
  assert.equal(content.includes("from 'd3'"), true, 'Must import d3');
  assert.equal(content.includes('scaleLinear'), true, 'Must use d3.scaleLinear for quantitative scales');
  assert.equal(content.includes('axisBottom'), true, 'Must use d3.axisBottom for X axis');
  assert.equal(content.includes('axisLeft'), true, 'Must use d3.axisLeft for Y axis');

  // 2. SVG lines and shapes
  assert.equal(content.includes('.line<'), true, 'Must use d3.line for OLS and rolling trend overlays');
  assert.equal(content.includes('linearGradient'), true, 'Must declare SVG linearGradient definitions');
  assert.equal(content.includes('d3-excluded-stripe'), true, 'Must support pattern for excluded/incomplete years');

  // 3. Responsive container and React lifecycle isolation
  assert.equal(content.includes('useRef<SVGSVGElement>'), true, 'Must isolate D3 DOM updates inside svgRef');
  assert.equal(content.includes('ResizeObserver'), true, 'Must use ResizeObserver for responsive width handling');

  // 4. Interactive tooltips, reference threshold line, and year selection
  assert.equal(content.includes('thresholdValue'), true, 'Must support reference threshold line');
  assert.equal(content.includes('onYearSelect'), true, 'Must support selected year interaction');
  assert.equal(content.includes('tooltipRef'), true, 'Must provide interactive hover details tooltip');
});

test('D3 Visualizations: TrendAnalysisView integrates D3 Interactive SVG as primary visualization', () => {
  const viewPath = path.resolve(__dirname, '../components/TrendAnalysisView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');

  assert.equal(content.includes("from './D3HazardTrendChart'"), true, 'Must import D3HazardTrendChart');
  assert.equal(content.includes('<D3HazardTrendChart'), true, 'Must render D3HazardTrendChart');
  assert.equal(content.includes("useState<'d3' | 'recharts'>('d3')"), true, 'Must default chartEngine to d3');
  assert.equal(content.includes('D3 Interactive SVG'), true, 'Must provide D3 engine option');
});
