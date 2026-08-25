import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              404 · {t('notFound.title')}
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {t('notFound.text')}
          </p>

          <Link href="/" className="mt-4 inline-block text-sm font-bold text-[#0F6E56] hover:text-[#085041]">
            {t('notFound.backHome')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
