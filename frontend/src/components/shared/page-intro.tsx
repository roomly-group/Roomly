export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="display-heading max-w-2xl text-4xl text-pine sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-sage">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
