import { Home as HomeIcon } from 'lucide-react';

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
      <div className="mb-4 rounded-[1.25rem] bg-[#E1F5EE] p-4 text-[#0F6E56]">
        <HomeIcon size={26} />
      </div>
      <h3 className="font-black text-[#085041]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[#527067]">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
