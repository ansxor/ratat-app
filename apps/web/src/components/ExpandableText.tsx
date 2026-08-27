import { useEffect, useRef, useState } from "react";

import { ChevronDownIcon, ChevronUpIcon } from "#/components/ui/icons.tsx";
import { cn } from "#/lib/utils.ts";

export function ExpandableText({
  description,
  id,
  className,
  collapsedClassName,
}: {
  description: string;
  id: string;
  className?: string;
  collapsedClassName?: string;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setCanExpand(false);
  }, [description]);

  useEffect(() => {
    const text = textRef.current;
    if (!text || expanded) return;
    const checkOverflow = () => setCanExpand(text.scrollHeight > text.clientHeight + 1);
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(text);
    return () => observer.disconnect();
  }, [description, expanded]);

  return (
    <>
      <p ref={textRef} id={id} className={cn(className, !expanded && collapsedClassName)}>
        {description}
      </p>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-[3px] inline-flex cursor-pointer items-center gap-[2px] border-0 bg-transparent p-0 text-faint text-[12px] font-bold underline hover:text-paper"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUpIcon className="size-[12px]" aria-hidden="true" /> : <ChevronDownIcon className="size-[12px]" aria-hidden="true" />}
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}
