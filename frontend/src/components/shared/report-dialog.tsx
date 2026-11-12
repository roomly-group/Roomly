import { useEffect, useId, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Flag, Loader2, X } from 'lucide-react';
import {
  REPORT_DESCRIPTION_MAX_LENGTH,
  REPORT_REASONS_BY_TARGET,
  type CreateReportInput,
  type ReportReason,
} from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCreateReport } from '@/hooks/use-safety';

// Report dialog (audit finding RMY-12), shared by the chat (a person or one
// message) and the listing page. The person picks a reason and may add a few
// words; the report goes to the admin queue only. Bottom sheet on phones,
// centred card from 640px, like the contact dialog on the listing page.

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** HTTP status of the rate-limit answer (too many reports). */
const TOO_MANY_REQUESTS_STATUS = 429 as const;

/** Stable selectors for the report dialog. */
const REPORT_TEST_IDS = {
  DIALOG: 'dialog-report',
  REASON_PREFIX: 'radio-report-reason-',
  INPUT_DESCRIPTION: 'input-report-description',
  BUTTON_SEND: 'button-send-report',
  BUTTON_CLOSE: 'button-close-report',
} as const;

/** What is being reported: the ids the backend needs (never a user id). */
export type ReportSubject =
  | { target: 'user'; conversationId: number }
  | { target: 'message'; messageId: number }
  | { target: 'listing'; listingId: number };

// ===================== COMPONENT =====================

export function ReportDialog({
  open,
  onOpenChange,
  subject,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: ReportSubject;
  /** Dialog heading, e.g. "Report Marco" or "Report this listing". */
  title: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const createReport = useCreateReport();
  const reasons = REPORT_REASONS_BY_TARGET[subject.target];
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [failed, setFailed] = useState<TranslationKey | null>(null);
  const descriptionId = useId();

  // A fresh form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setReason(null);
    setDescription('');
    setFailed(null);
    createReport.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason || createReport.isPending) return;
    setFailed(null);
    const input = { ...subject, reason, description: description.trim() || undefined } as CreateReportInput;
    try {
      await createReport.mutateAsync(input);
      onOpenChange(false);
      toast({ title: t('safety.reportSent'), description: t('safety.reportSentText') });
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      setFailed(status === TOO_MANY_REQUESTS_STATUS ? 'safety.reportTooMany' : 'safety.reportError');
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={descriptionId}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[20px] bg-paper p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-float data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-6"
          data-testid={REPORT_TEST_IDS.DIALOG}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="mt-1 flex items-center gap-2 text-2xl font-black tracking-[-0.04em] text-pine">
              <Flag size={20} className="shrink-0 text-terracotta" aria-hidden />
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t('safety.cancel')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sage transition-colors hover:bg-mint-mist hover:text-pine"
              data-testid={REPORT_TEST_IDS.BUTTON_CLOSE}
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>
          <p id={descriptionId} className="mt-3 text-sm leading-6 text-sage">
            {t('safety.reportIntro')}
          </p>

          <form onSubmit={(event) => void submit(event)} className="mt-5">
            <fieldset>
              <legend className="text-sm font-extrabold text-pine">{t('safety.reasonLabel')}</legend>
              <div className="mt-3 space-y-2" role="radiogroup">
                {reasons.map((value) => (
                  <label
                    key={value}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition-colors',
                      reason === value ? 'border-shutter bg-mint-mist text-pine' : 'border-field bg-paper text-ink hover:bg-cream',
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="h-4 w-4 accent-shutter"
                      data-testid={`${REPORT_TEST_IDS.REASON_PREFIX}${value}`}
                    />
                    {t(`safety.reason.${value}` as TranslationKey)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="report-description" className="mt-5 block text-sm font-extrabold text-pine">
              {t('safety.descriptionLabel')}
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={REPORT_DESCRIPTION_MAX_LENGTH}
              placeholder={t('safety.descriptionPlaceholder')}
              className="mt-2 w-full resize-none rounded-xl border border-field bg-cream p-3 text-base text-ink outline-none placeholder:text-sage focus:border-shutter focus:ring-[3px] focus:ring-mint-wash/40 sm:text-sm"
              data-testid={REPORT_TEST_IDS.INPUT_DESCRIPTION}
            />

            {failed ? (
              <p className="mt-2 text-sm font-bold text-terracotta" role="alert">
                {t(failed)}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!reason || createReport.isPending}
              className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-terracotta text-[15px] font-black text-paper transition-colors hover:bg-terracotta/90 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={REPORT_TEST_IDS.BUTTON_SEND}
            >
              {createReport.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Flag size={16} aria-hidden />}
              {t('safety.sendReport')}
            </button>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
