import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Detection } from '../../types/sonar';
import { Card } from '../common/Card';

interface ConfidenceDistChartProps {
  detections: Detection[];
}

export const ConfidenceDistChart: React.FC<ConfidenceDistChartProps> = ({ detections }) => {
  let high = 0; // >= 80%
  let medium = 0; // 50-79%
  let low = 0; // < 50%

  detections.forEach((d) => {
    const pct = Math.round(d.confidence * 100);
    if (pct >= 80) high++;
    else if (pct >= 50) medium++;
    else low++;
  });

  const data = [
    { name: 'High (≥80%)', count: high, color: '#5E9C7E', desc: 'Auto Accepted' },
    { name: 'Med (50-79%)', count: medium, color: '#C79A4B', desc: 'Review Recommended' },
    { name: 'Low (<50%)', count: low, color: '#BC6A66', desc: 'Requires Verification' },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-text">Confidence Distribution</h3>
          <p className="text-xs text-muted font-normal">Model prediction score breakdown</p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-surface p-2.5 rounded-card border border-border shadow-popover text-xs">
                      <p className="font-semibold text-text">{d.name}</p>
                      <p className="text-muted mt-0.5">{d.desc}</p>
                      <p className="text-muted mt-1">
                        Count: <span className="font-bold text-text">{d.count}</span>
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
