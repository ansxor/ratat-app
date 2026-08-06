import { cn } from "#/lib/utils.ts";

export function SettingRow({
  label,
  status,
  emphasised = false,
  children,
}: {
  label: string;
  status: string;
  emphasised?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-[12px] pt-[10px] pb-[11px] border-b border-line-soft">
      <div className="flex items-baseline gap-[8px]">
        <b className="text-[12.5px] font-[700] tracking-[0.01em] text-paper">{label}</b>
        <span
          className={cn(
            "ml-auto text-[10.5px] tracking-[0.06em] uppercase",
            emphasised ? "text-primary" : "text-faint",
          )}
        >
          {status}
        </span>
      </div>
      {children}
    </div>
  );
}
