import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/shared/button';

// ===================== CONFIGURATION =====================

/** Test selector used by the retry action in the query error panel. */
const QUERY_RETRY_TEST_ID = 'button-retry' as const;

/**
 * Failed-load message with a retry. `inset` drops the sheet for use inside
 * another sheet (the Terracotta heading carries it), so sheets never nest.
 */
export function QueryError({ onRetry, inset = false }: { onRetry?: () => void; inset?: boolean }) {
  const { t } = useLanguage();
  return (
    <div
      role="alert"
      className={
        inset
          ? 'py-6'
          : 'rounded-sheet border border-terracotta/30 bg-terracotta-mist px-6 py-8 sm:px-10'
      }
    >
      <h3 className="text-[17px] font-extrabold text-terracotta">{t('common.somethingWrong')}</h3>
      <p className="mt-1.5 max-w-lg text-[15px] leading-6 text-ink">{t('common.somethingWrongDesc')}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-5" data-testid={QUERY_RETRY_TEST_ID}>
          {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}
