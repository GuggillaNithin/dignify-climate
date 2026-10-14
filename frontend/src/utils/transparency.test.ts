import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('AI Evidence Badge displays Python Metrics Supplied to AI without numerical score', () => {
  const cardPath = path.resolve(__dirname, '../components/AIBriefingCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  // Must not have hardcoded Fact-Grounded (100%)
  assert.equal(content.includes('Fact-Grounded (100%)'), false, 'Must not contain Fact-Grounded (100%)');
  // Must have Python Metrics Supplied to AI
  assert.equal(content.includes('Python Metrics Supplied to AI'), true, 'Must contain Python Metrics Supplied to AI');
});

test('Spatial metric labels distinguish point mode from multi-cell regional mode', () => {
  const shellPath = path.resolve(__dirname, '../components/DashboardShell.tsx');
  const content = fs.readFileSync(shellPath, 'utf8');

  // Verify single ERA5 grid cell label is present in DashboardShell.tsx
  assert.equal(
    content.includes('Annual Mean — Single ERA5 Grid Cell'),
    true,
    'Must contain Annual Mean — Single ERA5 Grid Cell'
  );
  // Verify spatially weighted regional mean label is present in DashboardShell.tsx
  assert.equal(
    content.includes('Spatially Weighted Regional Mean'),
    true,
    'Must contain Spatially Weighted Regional Mean'
  );
  // Verify column header uses Annual Hazard Days for point mode
  assert.equal(
    content.includes('Annual Hazard Days'),
    true,
    'Must contain Annual Hazard Days'
  );
  assert.equal(
    content.includes('Spatially Weighted Days'),
    true,
    'Must contain Spatially Weighted Days'
  );
});

test('TrendAnalysisView includes operational threshold and sensitivity disclosure', () => {
  const trendViewPath = path.resolve(__dirname, '../components/TrendAnalysisView.tsx');
  const content = fs.readFileSync(trendViewPath, 'utf8');

  assert.equal(
    content.includes('Active Threshold:'),
    true,
    'TrendAnalysisView must display Active Threshold'
  );
  assert.equal(
    content.includes('Sensitivity Disclosure:'),
    true,
    'TrendAnalysisView must display Sensitivity Disclosure'
  );
  assert.equal(
    content.includes('Qualifying Hazard Events Audit'),
    true,
    'TrendAnalysisView must contain Qualifying Hazard Events Audit'
  );
});
