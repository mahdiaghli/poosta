interface Props { label: string; value: number; }

export function MetricBar({ label, value }: Props) {
  return (
    <div className="flex items-center gap-3 py-[11px] border-b border-line last:border-none">
      <span className="w-24 flex-none text-[13.5px] font-bold">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-sageMist overflow-hidden">
        <span className="block h-full rounded-full bg-gradient-to-r from-sage to-sageDeep" style={{ width: `${value}%` }} />
      </div>
      <span className="num w-8 flex-none text-left text-[13px] font-bold text-sageDeep">{value}</span>
    </div>
  );
}
