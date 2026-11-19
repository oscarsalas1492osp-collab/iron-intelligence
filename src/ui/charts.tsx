// Envoltorios de Recharts con el estilo de la app.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axis = { stroke: '#8b919c', fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: '#17191d', border: '1px solid #2a2d34', borderRadius: 12, fontSize: 12 }, labelStyle: { color: '#8b919c' }, cursor: { stroke: '#2a2d34', fill: '#ffffff08' } } as const;

export function LineC({ data, x, y, color = '#3b9dff', unit = '', height = 220 }: { data: Record<string, unknown>[]; x: string; y: string; color?: string; unit?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#2a2d34" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={24} />
        <YAxis {...axis} domain={['auto', 'auto']} />
        <Tooltip {...tip} formatter={(v) => [`${v}${unit}`, '']} separator="" />
        <Line type="monotone" dataKey={y} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarC({ data, x, bars, height = 220 }: { data: Record<string, unknown>[]; x: string; bars: { key: string; color: string; name: string; stack?: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#2a2d34" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={x} {...axis} minTickGap={8} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} />
        {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} stackId={b.stack} radius={[5, 5, 0, 0]} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

