import { Button } from './Button';
import { Card } from './Card';

interface Props { title: string; body: string; cta?: string; onCta?: () => void; }

export function EmptyState({ title, body, cta, onCta }: Props) {
  return (
    <Card className="text-center">
      <div className="text-3xl mb-2">🌿</div>
      <div className="font-bold mb-1.5">{title}</div>
      <p className="text-[14.5px] text-stone leading-[1.9] mt-0">{body}</p>
      {cta && onCta && (
        <div className="mt-3.5">
          <Button onClick={onCta}>{cta}</Button>
        </div>
      )}
    </Card>
  );
}
