import { CircleAlert } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/shared/button';

export function QueryError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="surface flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
      <span className="mb-3 rounded-full bg-[#f7ddd1] p-3 text-[#a74b32]">
        <CircleAlert size={22} />
      </span>
      <h3 className="font-black text-[#085041]">{t('common.somethingWrong')}</h3>
      <p className="mt-1 max-w-sm text-sm text-[#527067]">
        {t('common.somethingWrongDesc')}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-5" data-testid="button-retry">
          {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}
