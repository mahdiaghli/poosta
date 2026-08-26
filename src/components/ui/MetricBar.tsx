interface Props { label: string; value: number; source?: 'model' | 'heuristic'; }

const BANDS: [number, string, string][] = [
  [80, 'عالی', 'text-sageDeep'],
  [60, 'خوب', 'text-sage'],
  [40, 'متوسط', 'text-coral'],
  [0, 'نیاز به توجه', 'text-coral'],
];
function bandFor(value: number) {
  return BANDS.find(([min]) => value >= min) ?? BANDS[BANDS.length - 1];
}

export function MetricBar({ label, value, source }: Props) {
  const [, bandLabel, bandColor] = bandFor(value);
  return (
    <div className="flex items-center gap-3 py-[11px] border-b border-line last:border-none">
      <span className="w-24 flex-none text-[13.5px] font-bold">{label}</span>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-sageMist overflow-hidden">
          <span className="block h-full rounded-full bg-gradient-to-r from-sage to-sageDeep" style={{ width: `${value}%` }} />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[10.5px] font-bold ${bandColor}`}>{bandLabel}</span>
          {source && (
            <span className="text-[9.5px] text-stone bg-creamDeep rounded-full px-1.5 py-0.5">
              {source === 'model' ? '🎯 مدل' : '≈ تخمین'}
            </span>
          )}
        </div>
      </div>
      <span className="num w-8 flex-none text-left text-[13px] font-bold text-sageDeep">{value}</span>
    </div>
  );
}
