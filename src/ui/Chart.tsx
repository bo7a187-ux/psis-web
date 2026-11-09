import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

export function Chart({ option, height = 280, label }: { option: Record<string, unknown>; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    inst.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); inst.current = null; };
  }, []);
  useEffect(() => { inst.current?.setOption(option, true); }, [option]);
  return <div ref={el} role="img" aria-label={label} style={{ width: '100%', height }} />;
}

export const C = { planned: '#8aa4d6', actual: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', text: '#c9d4e8', grid: 'rgba(255,255,255,0.08)', navy: '#0e1c36' };
