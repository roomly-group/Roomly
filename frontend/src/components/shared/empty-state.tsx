/** Honest empty state: a hairline sheet that says what is missing and what to do next. */
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
    <div className="rounded-sheet border border-hairline bg-paper px-6 py-10 sm:px-10">
      <h3 className="text-[17px] font-extrabold text-pine">{title}</h3>
      <p className="mt-1.5 max-w-lg text-[15px] leading-6 text-sage">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
