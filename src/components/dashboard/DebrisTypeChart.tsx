import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Detection } from '../../types/sonar';
import { Card } from '../common/Card';
import { useSonarContext } from '../../context/SonarContext';

interface DebrisTypeChartProps {
  detections: Detection[];
}

export const DebrisTypeChart: React.FC<DebrisTypeChartProps> = ({ detections }) => {
  const { settings } = useSonarContext();

  const countMap: Record<string, number> = {};
  detections.forEach((d) => {
    countMap[d.class] = (countMap[d.class] || 0) + 1;
  });

  const data = settings.debrisClasses.map((cls) => ({
    name: cls.name,
    count: countMap[cls.name] || 0,
    color: cls.color,
  }));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-text">Debris Distribution by Class</h3>
          <p className="text-xs text-muted">Total detected targets grouped by material category</p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748B' }}
              interval={0}
              angle={-25}
              textAnchor="end"
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-surface p-2.5 rounded-card border border-border shadow-popover text-xs">
                      <p className="font-semibold text-text">{d.name}</p>
                      <p className="text-muted mt-0.5">
                        Detections: <span className="font-bold text-primary">{d.count}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
