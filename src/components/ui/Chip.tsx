interface Props {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, active, onClick, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-[1.5px] rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
        active ? 'bg-sageDeep border-sageDeep text-white' : 'bg-white border-line text-ink'
      } ${className}`}
    >
      {label}
    </button>
  );
}
