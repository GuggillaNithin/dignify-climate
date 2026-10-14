import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';

export interface AnnualChartPoint {
  year: number;
  observed: number | null;
  fitted: number | null;
  rolling: number | null;
  isValid: boolean;
}

export interface D3HazardTrendChartProps {
  data: AnnualChartPoint[];
  metricName: string;
  metricUnits: string;
  olsSlope?: number | null;
  olsPValue?: number | null;
  selectedYear?: number | null;
  onYearSelect?: (year: number) => void;
  thresholdValue?: number | null;
  thresholdLabel?: string;
}

export const D3HazardTrendChart: React.FC<D3HazardTrendChartProps> = ({
  data,
  metricName,
  metricUnits,
  olsSlope,
  olsPValue,
  selectedYear,
  onYearSelect,
  thresholdValue,
  thresholdLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [activeSeries, setActiveSeries] = useState<{
    observed: boolean;
    ols: boolean;
    rolling: boolean;
    threshold: boolean;
  }>({
    observed: true,
    ols: true,
    rolling: true,
    threshold: true,
  });

  // Track brush range (years)
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null);

  // Responsive resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filtered data based on optional brush range
  const filteredData = useMemo(() => {
    if (!brushRange) return data;
    return data.filter((d) => d.year >= brushRange[0] && d.year <= brushRange[1]);
  }, [data, brushRange]);

  // Render D3 visualization
  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean container on redraw

    const height = 300;
    const margin = { top: 24, right: 30, bottom: 44, left: 52 };
    const width = Math.max(containerWidth, 320);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Define defs (gradients and patterns)
    const defs = svg.append('defs');

    // Observed bar gradient
    const barGradient = defs
      .append('linearGradient')
      .attr('id', 'd3-bar-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    barGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f97316').attr('stop-opacity', 0.9);
    barGradient.append('stop').attr('offset', '100%').attr('stop-color', '#ea580c').attr('stop-opacity', 0.6);

    // Selected bar gradient
    const selectedGradient = defs
      .append('linearGradient')
      .attr('id', 'd3-bar-selected-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    selectedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#0d9488').attr('stop-opacity', 1);
    selectedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#042f2e').attr('stop-opacity', 0.8);

    // Excluded striped pattern
    const pattern = defs
      .append('pattern')
      .attr('id', 'd3-excluded-stripe')
      .attr('width', 6)
      .attr('height', 6)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('patternTransform', 'rotate(45)');
    pattern.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#64748b').attr('stroke-width', 2);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Quantitative scales
    const years = filteredData.map((d) => d.year);
    const minYear = d3.min(years) ?? 2015;
    const maxYear = d3.max(years) ?? 2023;

    // X Scale: continuous linear scale for seamless lines, with bar positioning
    const xScale = d3.scaleLinear()
      .domain([minYear - 0.5, maxYear + 0.5])
      .range([0, innerWidth]);

    // Compute max observed / fitted / rolling value
    const allValues: number[] = [];
    filteredData.forEach((d) => {
      if (d.observed !== null) allValues.push(d.observed);
      if (d.fitted !== null) allValues.push(d.fitted);
      if (d.rolling !== null) allValues.push(d.rolling);
    });
    if (thresholdValue !== null && thresholdValue !== undefined) {
      allValues.push(thresholdValue);
    }
    const maxVal = allValues.length ? (d3.max(allValues) ?? 10) : 10;
    const yMax = maxVal === 0 ? 5 : maxVal * 1.15;

    const yScale = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.15)
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call((grid) => grid.select('.domain').remove());

    // X Axis
    const tickYears = years.filter((_, idx) => {
      if (years.length <= 12) return true;
      if (years.length <= 25) return idx % 2 === 0;
      return idx % 5 === 0;
    });

    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(tickYears)
      .tickFormat((d) => `${d}`);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((axis) => {
        axis.select('.domain').attr('stroke', '#475569');
        axis.selectAll('.tick line').attr('stroke', '#475569');
        axis
          .selectAll('.tick text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '11px')
          .attr('font-family', 'monospace');
      });

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(5);

    g.append('g')
      .call(yAxis)
      .call((axis) => {
        axis.select('.domain').attr('stroke', '#475569');
        axis.selectAll('.tick line').attr('stroke', '#475569');
        axis
          .selectAll('.tick text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '11px')
          .attr('font-family', 'monospace');
      });

    // Y Axis Title
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -38)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '11px')
      .attr('font-family', 'sans-serif')
      .text(`${metricName} (${metricUnits})`);

    // Reference Threshold Line (if provided and toggled)
    if (activeSeries.threshold && thresholdValue !== null && thresholdValue !== undefined && thresholdValue <= yMax) {
      const threshY = yScale(thresholdValue);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', threshY)
        .attr('y2', threshY)
        .attr('stroke', '#eab308')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.85);

      g.append('text')
        .attr('x', innerWidth - 4)
        .attr('y', threshY - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#fde047')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(thresholdLabel || `Threshold: ${thresholdValue} ${metricUnits}`);
    }

    // 1. Observed Annual Bars
    if (activeSeries.observed) {
      const barWidth = Math.max(8, Math.min(32, (innerWidth / filteredData.length) * 0.65));

      filteredData.forEach((d) => {
        const xPos = xScale(d.year) - barWidth / 2;
        const isSelected = selectedYear === d.year;

        if (d.isValid && d.observed !== null) {
          const yPos = yScale(d.observed);
          const barHeight = Math.max(2, innerHeight - yPos);

          const bar = g
            .append('rect')
            .attr('x', xPos)
            .attr('y', yPos)
            .attr('width', barWidth)
            .attr('height', barHeight)
            .attr('rx', 3)
            .attr('fill', isSelected ? 'url(#d3-bar-selected-gradient)' : 'url(#d3-bar-gradient)')
            .attr('stroke', isSelected ? '#14b8a6' : '#ea580c')
            .attr('stroke-width', isSelected ? 2 : 1)
            .attr('class', 'cursor-pointer transition-all duration-150')
            .style('filter', isSelected ? 'drop-shadow(0 0 6px rgba(20, 184, 166, 0.6))' : 'none');

          // Hover interaction
          bar
            .on('mouseenter', (event) => {
              bar.attr('opacity', 0.85);
              showTooltip(event, d);
            })
            .on('mousemove', (event) => {
              showTooltip(event, d);
            })
            .on('mouseleave', () => {
              bar.attr('opacity', 1);
              hideTooltip();
            })
            .on('click', () => {
              onYearSelect?.(d.year);
            });
        } else {
          // Incomplete or excluded year placeholder
          const placeholderHeight = 12;
          const yPos = innerHeight - placeholderHeight;

          const bar = g
            .append('rect')
            .attr('x', xPos)
            .attr('y', yPos)
            .attr('width', barWidth)
            .attr('height', placeholderHeight)
            .attr('rx', 2)
            .attr('fill', 'url(#d3-excluded-stripe)')
            .attr('stroke', '#64748b')
            .attr('stroke-dasharray', '2 2')
            .attr('class', 'cursor-pointer opacity-70');

          bar
            .on('mouseenter', (event) => showTooltip(event, d))
            .on('mousemove', (event) => showTooltip(event, d))
            .on('mouseleave', hideTooltip)
            .on('click', () => onYearSelect?.(d.year));
        }
      });
    }

    // 2. 3-Year Rolling Average Line (Cyan solid)
    if (activeSeries.rolling) {
      const rollingPoints = filteredData.filter((d) => d.rolling !== null);
      if (rollingPoints.length >= 2) {
        const lineGenerator = d3
          .line<AnnualChartPoint>()
          .x((d) => xScale(d.year))
          .y((d) => yScale(d.rolling!))
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(rollingPoints)
          .attr('fill', 'none')
          .attr('stroke', '#22d3ee')
          .attr('stroke-width', 2.2)
          .attr('d', lineGenerator)
          .style('filter', 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.4))');

        // Circular dots on rolling line
        g.selectAll('.d3-rolling-dot')
          .data(rollingPoints)
          .enter()
          .append('circle')
          .attr('class', 'd3-rolling-dot')
          .attr('cx', (d) => xScale(d.year))
          .attr('cy', (d) => yScale(d.rolling!))
          .attr('r', 3)
          .attr('fill', '#0891b2')
          .attr('stroke', '#a5f3fc')
          .attr('stroke-width', 1.5);
      }
    }

    // 3. OLS Fitted Trend Line (Amber dashed)
    if (activeSeries.ols) {
      const fittedPoints = filteredData.filter((d) => d.fitted !== null);
      if (fittedPoints.length >= 2) {
        const olsLineGenerator = d3
          .line<AnnualChartPoint>()
          .x((d) => xScale(d.year))
          .y((d) => yScale(d.fitted!));

        g.append('path')
          .datum(fittedPoints)
          .attr('fill', 'none')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5 4')
          .attr('d', olsLineGenerator);
      }
    }

    // Tooltip functions
    function showTooltip(event: MouseEvent, d: AnnualChartPoint) {
      if (!tooltipRef.current) return;
      const tooltip = tooltipRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      tooltip.style.display = 'block';
      tooltip.style.left = `${Math.min(mouseX + 12, innerWidth - 80)}px`;
      tooltip.style.top = `${Math.max(10, mouseY - 70)}px`;

      tooltip.innerHTML = `
        <div class="font-bold text-slate-100 border-b border-slate-800 pb-1 flex justify-between items-center">
          <span>Year ${d.year}</span>
          <span class="text-[10px] ${d.isValid ? 'text-emerald-400 font-normal' : 'text-amber-400 font-normal'}">
            ${d.isValid ? 'Valid' : 'Excluded (<90%)'}
          </span>
        </div>
        <div class="flex justify-between gap-3 text-orange-400 pt-1">
          <span>Observed:</span>
          <span class="font-bold">${d.observed !== null ? `${d.observed} ${metricUnits}` : 'Excluded'}</span>
        </div>
        ${d.rolling !== null ? `
          <div class="flex justify-between gap-3 text-cyan-400">
            <span>3-Yr Rolling:</span>
            <span class="font-bold">${d.rolling} ${metricUnits}</span>
          </div>` : ''}
        ${d.fitted !== null ? `
          <div class="flex justify-between gap-3 text-amber-300">
            <span>OLS Fitted:</span>
            <span class="font-bold">${d.fitted} ${metricUnits}</span>
          </div>` : ''}
      `;
    }

    function hideTooltip() {
      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'none';
      }
    }
  }, [data, filteredData, containerWidth, activeSeries, selectedYear, metricName, metricUnits, thresholdValue, thresholdLabel, onYearSelect]);

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Chart Top Controls & Interactive Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {/* Observed Annual Toggle */}
          <button
            type="button"
            onClick={() => setActiveSeries((prev) => ({ ...prev, observed: !prev.observed }))}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition border ${
              activeSeries.observed
                ? 'bg-orange-950/40 text-orange-300 border-orange-700/60'
                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 inline-block" />
            <span>Observed Annual</span>
          </button>

          {/* OLS Fit Toggle */}
          <button
            type="button"
            onClick={() => setActiveSeries((prev) => ({ ...prev, ols: !prev.ols }))}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition border ${
              activeSeries.ols
                ? 'bg-amber-950/40 text-amber-300 border-amber-700/60'
                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
            }`}
          >
            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-amber-400 inline-block" />
            <span>OLS Fit {olsSlope !== undefined && olsSlope !== null ? `(${olsSlope > 0 ? '+' : ''}${olsSlope.toFixed(2)}/yr${olsPValue !== undefined && olsPValue !== null ? `, p=${olsPValue.toFixed(3)}` : ''})` : ''}</span>
          </button>

          {/* 3-Yr Rolling Mean Toggle */}
          <button
            type="button"
            onClick={() => setActiveSeries((prev) => ({ ...prev, rolling: !prev.rolling }))}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition border ${
              activeSeries.rolling
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-700/60'
                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
            }`}
          >
            <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
            <span>3-Yr Rolling</span>
          </button>

          {/* Reference Threshold Toggle */}
          {thresholdValue !== null && thresholdValue !== undefined && (
            <button
              type="button"
              onClick={() => setActiveSeries((prev) => ({ ...prev, threshold: !prev.threshold }))}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition border ${
                activeSeries.threshold
                  ? 'bg-yellow-950/40 text-yellow-300 border-yellow-700/60'
                  : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
              }`}
            >
              <span className="w-3.5 h-0.5 border-t border-dashed border-yellow-400 inline-block" />
              <span>Reference Threshold</span>
            </button>
          )}
        </div>

        {/* Reset Range if brushed */}
        {brushRange && (
          <button
            type="button"
            onClick={() => setBrushRange(null)}
            className="text-[11px] text-teal-400 hover:text-teal-300 underline font-sans"
          >
            Reset Range ({brushRange[0]}–{brushRange[1]})
          </button>
        )}
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-hidden bg-slate-950/60 rounded-xl border border-slate-800/80 p-2">
        <svg
          ref={svgRef}
          width={containerWidth}
          height={300}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`D3 Climate Hazard Trend Visualization for ${metricName}`}
        />

        {/* Floating HTML Tooltip */}
        <div
          ref={tooltipRef}
          className="absolute hidden pointer-events-none z-20 bg-slate-950/95 border border-slate-700 rounded-lg p-2.5 shadow-2xl text-xs font-mono text-slate-300 backdrop-blur-xs min-w-[150px]"
          style={{ transition: 'top 0.05s ease, left 0.05s ease' }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono px-1">
        <span>Click on any bar to inspect annual distribution on map / globe</span>
        <span>Engine: D3.js v7 SVG</span>
      </div>
    </div>
  );
};
