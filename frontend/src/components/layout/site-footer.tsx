import { Link } from 'wouter';
import { Instagram, Linkedin, Music2 } from 'lucide-react';
import roomlyMark from '@assets/logo_no_background.png';
import { useLanguage } from '@/lib/i18n';

export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-[#0850411a] bg-white">
      <div className="mx-auto max-w-[1040px] px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src={roomlyMark} alt="Roomly" className="h-7 w-7 object-contain" />
              <span className="text-base font-black tracking-[-0.03em] text-[#085041]">{t('footer.brand')}</span>
            </div>
            <p className="mt-3 max-w-[220px] text-sm text-[#527067]">
              {t('footer.tagline')}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <FooterSocial
                icon={<Instagram size={16} />}
                label={t('footer.social.instagram')}
                href="https://www.instagram.com/roomlygroup"
              />
              <FooterSocial
                icon={<Linkedin size={16} />}
                label={t('footer.social.linkedin')}
                href="https://www.linkedin.com/in/daniele-vinciguerra-6588773a8/"
              />
              <FooterSocial
                icon={<Music2 size={16} />}
                label={t('footer.social.tiktok')}
                href="https://www.tiktok.com/@roomlygroup"
              />
            </div>
          </div>

          <FooterColumn
            title={t('footer.column.prodotto')}
            links={[
              { label: t('footer.link.beta'), href: '/' },
              { label: t('footer.link.faq'), href: '/#faq' },
            ]}
          />
          <FooterColumn
            title={t('footer.column.empresa')}
            links={[
              { label: t('footer.link.chi-siamo'), href: '/chi-siamo' },
              { label: t('footer.link.contatti'), href: '/contatti' },
            ]}
          />
          <FooterColumn
            title={t('footer.column.legal')}
            links={[
              { label: t('footer.link.privacy'), href: '/privacy' },
              { label: t('footer.link.termini'), href: '/termini' },
              { label: t('footer.link.cookie'), href: '/cookie' },
            ]}
          />
        </div>

        <div className="mt-12 border-t border-[#0850411a] pt-6 text-xs text-[#527067]">
          {t('footer.copyright')}
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
      <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#085041]">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.href.includes('#') ? (
              // Plain anchor for in-page anchors (e.g. "/#faq"): a wouter <Link>
              // won't reliably trigger a scroll-to-hash when the pathname doesn't
              // change, so a normal navigation (which the browser scrolls after
              // load) is used instead.
              <a href={link.href} className="text-sm text-[#527067] hover:text-[#085041]">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="text-sm text-[#527067] hover:text-[#085041]">
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
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0850411a] text-[#085041] hover:bg-[#E1F5EE]"
    >
      {icon}
    </a>
  );
}

export default SiteFooter;
