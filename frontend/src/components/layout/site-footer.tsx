import { Link } from 'wouter';
import { Instagram, Linkedin, Music2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-selector';
import { RoomlyMark } from '@/components/shared/roomly-mark';
import { APP_ROUTES, SOCIAL_PROFILE_URLS, WAITLIST_FAQ_ANCHOR_URL } from '@/lib/constants';

const LINK_CLASS =
  'inline-flex min-h-10 items-center text-[15px] text-mint-mist/85 underline decoration-transparent underline-offset-4 transition-colors hover:text-mint-mist hover:decoration-mint-wash';

/** The pine band that closes every page: mark, purpose, links, legal line and language. */
export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="on-dark bg-pine text-mint-mist">
      <div className="mx-auto max-w-[1320px] px-5 pb-8 pt-12 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <div className="flex items-center gap-2.5">
              <RoomlyMark className="h-8 w-8" />
              <span className="text-lg font-black tracking-[-0.04em]">{t('footer.brand')}</span>
            </div>
            <p className="mt-3 max-w-[280px] text-[15px] leading-6 text-mint-wash">{t('footer.tagline')}</p>
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

        <div className="mt-10 flex flex-col gap-4 border-t border-mint-mist/15 pt-6 text-sm text-mint-wash md:flex-row md:items-center md:justify-between">
          <p>{t('footer.copyright')}</p>
          <ul className="flex flex-wrap gap-x-5" aria-label={t('footer.column.legal')}>
            {[
              { label: t('footer.link.privacy'), href: APP_ROUTES.PRIVACY },
              { label: t('footer.link.termini'), href: APP_ROUTES.TERMS },
              { label: t('footer.link.cookie'), href: APP_ROUTES.COOKIES },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK_CLASS.replace('text-[15px]', 'text-sm')}>
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
    <div className="sm:col-span-3">
      <h2 className="mb-2 text-[13px] font-extrabold text-mint-mist">{title}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.label}>
            {link.href.includes('#') ? (
              // Plain anchor for in-page anchors (e.g. "/#faq"): a wouter <Link>
              // won't reliably trigger a scroll-to-hash when the pathname doesn't
              // change, so a normal navigation (which the browser scrolls after
              // load) is used instead.
              <a href={link.href} className={LINK_CLASS}>
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={LINK_CLASS}>
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
      className="flex h-11 w-11 items-center justify-center rounded-full border border-mint-mist/25 text-mint-mist transition-colors hover:border-mint-mist"
    >
      {icon}
    </a>
  );
}

export default SiteFooter;
