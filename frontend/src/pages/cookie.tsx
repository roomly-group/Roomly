import { LegalPage } from '@/components/layout/legal-page';
import { CookiePreferences } from '@/components/shared/cookie-consent';

export function CookiePage() {
  return (
    <LegalPage kind="cookies">
      {/* Lets visitors change their analytics choice at any time. */}
      <CookiePreferences />
    </LegalPage>
  );
}

export default CookiePage;
