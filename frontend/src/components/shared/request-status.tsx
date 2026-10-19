import type { Conversation } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Legend swatch and text colour for each request status, as on the map legend. */
const STATUS_STYLE: Record<string, { swatch: string; text: string }> = {
  in_attesa: { swatch: 'bg-sun', text: 'text-ink' },
  accettata: { swatch: 'bg-shutter', text: 'text-ink' },
  rifiutata: { swatch: 'bg-terracotta', text: 'text-terracotta' },
  annullata: { swatch: 'bg-outline', text: 'text-sage' },
};

/** A request status written like a legend entry: a square swatch and its name. */
export function RequestStatus({ status, className }: { status: Conversation['requestStatus']; className?: string }) {
  const { t } = useLanguage();
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.annullata;
  const label = STATUS_STYLE[status] ? t(`messages.status.${status}` as TranslationKey) : status;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-extrabold', style.text, className)}>
      <span className={cn('h-2 w-2 shrink-0', style.swatch)} aria-hidden />
      {label}
    </span>
  );
}

export default RequestStatus;
