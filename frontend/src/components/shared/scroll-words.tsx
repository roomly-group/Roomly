import type { CSSProperties, ElementType } from 'react';
import { cn } from '@/lib/utils';

/**
 * A sentence whose words light up one after another as it scrolls into view.
 * Progress comes from `--scroll-words` (set by useScrollMotion); each word
 * turns from faded to full colour at its own share of that progress.
 */
export function ScrollWords({ text, as: Tag = 'p', className }: { text: string; as?: ElementType; className?: string }) {
  const words = text.split(' ');
  return (
    <Tag data-scroll-words className={cn('scroll-words', className)} aria-label={text}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden
          className="scroll-word"
          style={{ '--word-start': (index / words.length).toFixed(3) } as CSSProperties}
        >
          {word}{' '}
        </span>
      ))}
    </Tag>
  );
}

export default ScrollWords;
