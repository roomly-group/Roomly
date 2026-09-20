import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-[hsl(var(--primary))] overflow-hidden">
      {/* Yellow circles on edges */}
      <div className="absolute -top-16 -left-16 h-32 w-32 rounded-full bg-[hsl(var(--accent))]/40" />
      <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-[hsl(var(--accent))]/35" />
      <div className="absolute -top-24 -right-20 h-24 w-24 rounded-full bg-[hsl(var(--accent))]/45" />
      <div className="absolute bottom-20 left-20 h-20 w-20 rounded-full bg-[hsl(var(--accent))]/50" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        <h1 className="text-5xl font-bold text-white">
          {t('notFound.heading')}
        </h1>
        <p className="text-lg text-white/90">
          {t('notFound.text')}
        </p>
        <Link href="/home" className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-white font-semibold hover:bg-white/25 transition-all duration-200">
          {t('notFound.backHome')}
          <ArrowRight size={16} className="text-white" />
        </Link>
      </div>
    </div>
  );
}