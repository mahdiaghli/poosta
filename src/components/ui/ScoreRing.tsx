interface Props {
  size?: number;
  score: number; // 0-100
  strokeWidth?: number;
  trackColor?: string;
  fillColor?: string;
}

/** SVG progress ring shared by the Result page (large) and Home hero (small). */
export function ScoreRing({ size = 190, score, strokeWidth = 14, trackColor = '#EAF0E9', fillColor = '#3C5443' }: Props) {
  const r = size / 2 - strokeWidth;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fillColor} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
}
