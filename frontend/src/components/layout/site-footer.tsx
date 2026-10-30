import { Link } from 'wouter';
import { Instagram, Linkedin, Music2 } from 'lucide-react';
import roomlyMark from '@assets/logo_no_background.png';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { APP_ROUTES, SOCIAL_PROFILE_URLS, WAITLIST_FAQ_ANCHOR_URL } from '@/lib/constants';

export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1320px] px-5 pb-8 pt-12 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <img src={roomlyMark} alt="" className="h-8 w-8 object-contain" />
              <span className="text-lg font-black tracking-[-0.04em] text-pine">{t('footer.brand')}</span>
            </div>
            <p className="mt-3 max-w-[260px] text-sm leading-6 text-sage">{t('footer.tagline')}</p>
            <div className="mt-5 flex items-center gap-2">
              <FooterSocial icon={<Instagram size={17} />} label={t('footer.social.instagram')} href={SOCIAL_PROFILE_URLS.INSTAGRAM} />
              <FooterSocial icon={<Linkedin size={17} />} label={t('footer.social.linkedin')} href={SOCIAL_PROFILE_URLS.LINKEDIN} />
              <FooterSocial icon={<Music2 size={17} />} label={t('footer.social.tiktok')} href={SOCIAL_PROFILE_URLS.TIKTOK} />
            </div>
          </div>

          <FooterColumn
            title={t('footer.column.prodotto')}
            links={[
              { label: t('footer.link.beta'), href: APP_ROUTES.ROOT },
              { label: t('footer.link.faq'), href: WAITLIST_FAQ_ANCHOR_URL },
            ]}
          />
          <FooterColumn
            title={t('footer.column.empresa')}
            links={[
              { label: t('footer.link.chi-siamo'), href: APP_ROUTES.ABOUT },
              { label: t('footer.link.contatti'), href: APP_ROUTES.CONTACT },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 text-sm text-sage md:flex-row md:items-center md:justify-between">
          <p>{t('footer.copyright')}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label={t('footer.column.legal')}>
            {[
              { label: t('footer.link.privacy'), href: APP_ROUTES.PRIVACY },
              { label: t('footer.link.termini'), href: APP_ROUTES.TERMS },
              { label: t('footer.link.cookie'), href: APP_ROUTES.COOKIES },
              // Always-visible way to change or withdraw analytics consent (preferences are at the top of the cookie page).
              { label: t('footer.link.manageCookies'), href: APP_ROUTES.COOKIES },
            ].map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="inline-flex min-h-11 items-center hover:text-pine hover:underline hover:underline-offset-4">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <LanguagePicker className="self-start md:self-auto" />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-extrabold text-pine">{title}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.label}>
            {link.href.includes('#') ? (
              // Plain anchor for in-page anchors (e.g. "/#faq"): a wouter <Link>
              // won't reliably trigger a scroll-to-hash when the pathname doesn't
              // change, so a normal navigation (which the browser scrolls after
              // load) is used instead.
              <a href={link.href} className="inline-flex min-h-10 items-center text-sm text-ink hover:text-shutter hover:underline hover:underline-offset-4">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="inline-flex min-h-10 items-center text-sm text-ink hover:text-shutter hover:underline hover:underline-offset-4">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterSocial({
  icon,
  label,
  href = '#',
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      target={href !== '#' ? '_blank' : undefined}
      rel={href !== '#' ? 'noopener noreferrer' : undefined}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-pine/10 text-pine transition-colors hover:bg-mint-mist"
    >
      {icon}
    </a>
  );
}
