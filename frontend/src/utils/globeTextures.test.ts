import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHazardMarkerColor,
  getHazardLegendConfig,
  SUPPORTED_OBSERVATORIES,
} from './globeTextures.ts';

test('getHazardMarkerColor returns correct palette for heatwave', () => {
  assert.equal(getHazardMarkerColor('heatwave', 2), '#eab308'); // < 5: Yellow
  assert.equal(getHazardMarkerColor('heatwave', 8), '#f97316'); // 5-12: Vivid orange
  assert.equal(getHazardMarkerColor('heatwave', 15), '#ea580c'); // 12-20: Red-orange
  assert.equal(getHazardMarkerColor('heatwave', 25), '#dc2626'); // >= 20: Crimson red
});

test('getHazardMarkerColor returns correct palette for drought', () => {
  assert.equal(getHazardMarkerColor('drought', 5), '#d4c38d'); // < 10: Sand/Khaki
  assert.equal(getHazardMarkerColor('drought', 18), '#d97706'); // 10-25: Warm ochre
  assert.equal(getHazardMarkerColor('drought', 35), '#b45309'); // 25-45: Rust brown
  assert.equal(getHazardMarkerColor('drought', 60), '#7f1d1d'); // >= 45: Severe deficit maroon
});

test('getHazardMarkerColor returns correct palette for heavy_rainfall', () => {
  assert.equal(getHazardMarkerColor('heavy_rainfall', 3), '#38bdf8'); // < 5: Sky cyan
  assert.equal(getHazardMarkerColor('heavy_rainfall', 10), '#2563eb'); // 5-15: Royal cobalt
  assert.equal(getHazardMarkerColor('heavy_rainfall', 20), '#6366f1'); // 15-25: Electric indigo
  assert.equal(getHazardMarkerColor('heavy_rainfall', 35), '#9333ea'); // >= 25: Torrential violet
});

test('getHazardMarkerColor handles unknown hazard gracefully', () => {
  assert.equal(getHazardMarkerColor('unknown', 10), '#38bdf8');
});

test('getHazardLegendConfig returns scientific metadata and threshold swatches', () => {
  const hwConfig = getHazardLegendConfig('heatwave');
  assert.equal(hwConfig.title, 'Heatwave Exposure');
  assert.equal(hwConfig.units, 'days/year');
  assert.equal(hwConfig.items.length, 4);
  assert.equal(hwConfig.items[0].color, '#eab308');
  assert.equal(hwConfig.items[3].color, '#dc2626');

  const droughtConfig = getHazardLegendConfig('drought');
  assert.equal(droughtConfig.title, 'Precipitation Deficit');
  assert.equal(droughtConfig.units, 'deficit days/year');
  assert.equal(droughtConfig.items.length, 4);

  const rainConfig = getHazardLegendConfig('heavy_rainfall');
  assert.equal(rainConfig.title, 'Heavy Precipitation');
  assert.equal(rainConfig.units, 'extreme days/year');
  assert.equal(rainConfig.items.length, 4);
});

test('SUPPORTED_OBSERVATORIES contains valid geographic locations and baseline metrics', () => {
  assert.ok(SUPPORTED_OBSERVATORIES.length >= 10);

  SUPPORTED_OBSERVATORIES.forEach((obs) => {
    assert.ok(obs.name.length > 0, 'Station has name');
    assert.ok(obs.country.length > 0, 'Station has country');
    assert.ok(obs.latitude >= -90 && obs.latitude <= 90, `Valid latitude for ${obs.name}`);
    assert.ok(obs.longitude >= -180 && obs.longitude <= 180, `Valid longitude for ${obs.name}`);
    assert.ok(obs.baselineHeatwaveDays >= 0, `Positive heatwave metric for ${obs.name}`);
    assert.ok(obs.baselineDroughtDeficitDays >= 0, `Positive drought metric for ${obs.name}`);
    assert.ok(obs.baselineHeavyRainDays >= 0, `Positive rain metric for ${obs.name}`);
  });
});
