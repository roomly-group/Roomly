import { useEffect, useState } from 'react';
import { Redirect } from 'wouter';
import { supabase } from '@/lib/supabase';
import NotFound from '@/pages/not-found';
import { useLanguage } from '@/lib/i18n';

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    async function checkOwnerStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          setIsOwner(false);
          setLoading(false);
          return;
        }

        const { count, error } = await supabase
          .from('annunci')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        setIsOwner((count ?? 0) > 0);
      } catch (err) {
        console.error('Failed to check owner status:', err);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    }

    checkOwnerStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[100vh] items-center justify-center">
        <div className="text-center">
          <p className="mt-2 text-sm text-[#527067]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return <NotFound />;
  }

  return <>{children}</>;
}