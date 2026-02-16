import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ConfidenceGaugeProps {
  confidence: number;
}

export function ConfidenceGauge({ confidence }: ConfidenceGaugeProps) {
  const data = [
    { value: confidence },
    { value: 100 - confidence }
  ];

  const COLORS = ['#4f46e5', '#e5e7eb'];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={0}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center mt-8">
          <div className="text-4xl font-bold text-primary">{confidence.toFixed(1)}%</div>
          <div className="text-sm text-muted-foreground">Confidence</div>
        </div>
      </div>
    </div>
  );
}
