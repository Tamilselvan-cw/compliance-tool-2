

/**
 * SparklineWithAxes - lightweight mini chart with labeled axes and grid
 *
 * Props:
 * - data: number[] (values)
 * - labels?: string[] (x-axis labels)
 * - height?: number
 * - width?: number
 * - yTicks?: number[]
 * - color?: string
 */
export function SparklineWithAxes({
  data,
  labels,
  height = 100,
  width = 260,
  yTicks = [0, 50, 100],
  color = "#FFB74D",
}: {
  data: number[];
  labels?: string[];
  height?: number;
  width?: number;
  yTicks?: number[];
  color?: string;
}) {
  if (!data || data.length === 0) return null;

  const leftGutter = 30;
  const bottomGutter = 18;
  const rightGutter = 6;
  const topGutter = 8;

  const plotW = width - leftGutter - rightGutter;
  const plotH = height - topGutter - bottomGutter;

  const minY = 0;
  const maxY = 100;

  const stepX = plotW / Math.max(1, data.length - 1);
  const yScale = (v: number) =>
    topGutter + (maxY - v) * (plotH / (maxY - minY));
  const xScale = (i: number) => leftGutter + i * stepX;

  const pathD = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(v)}`)
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* gridlines + y-axis labels */}
      {yTicks.map((t, idx) => {
        const y = yScale(t);
        return (
          <g key={idx}>
            <line
              x1={leftGutter}
              x2={width - rightGutter}
              y1={y}
              y2={y}
              stroke="rgba(0,0,0,0.12)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text
              x={leftGutter - 6}
              y={y + 3}
              textAnchor="end"
              fontSize="10"
              fill="rgba(0,0,0,0.6)"
            >
              {t}
            </text>
          </g>
        );
      })}

      {/* axes */}
      <line
        x1={leftGutter}
        x2={leftGutter}
        y1={topGutter}
        y2={topGutter + plotH}
        stroke="rgba(0,0,0,0.6)"
        strokeWidth={1}
      />
      <line
        x1={leftGutter}
        x2={leftGutter + plotW}
        y1={topGutter + plotH}
        y2={topGutter + plotH}
        stroke="rgba(0,0,0,0.6)"
        strokeWidth={1}
      />

      {/* x-axis labels */}
      {labels &&
        labels.map((lab, i) => {
          const x = xScale(i);
          const show = labels.length <= 7 ? true : i % 2 === 0;
          return show ? (
            <text
              key={i}
              x={x}
              y={height - 3}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(0,0,0,0.6)"
            >
              {lab}
            </text>
          ) : null;
        })}

      {/* data line */}
      <path d={pathD} stroke={color} strokeWidth={2} fill="none" />

      {/* last-point marker */}
      {data.length > 0 && (
        <circle
          cx={xScale(data.length - 1)}
          cy={yScale(data[data.length - 1])}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}
