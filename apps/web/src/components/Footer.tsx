const LINKS = ["About", "Guidelines", "Licensing", "Contact", "Terms", "Privacy", "Content policy"];

export function Footer() {
  return (
    <footer className="border-t border-line py-[16px]">
      <div className="wrap flex items-center gap-[10px_22px] flex-wrap">
        <span className="brand__mark text-[20px]">
          R<b>a</b>tat
        </span>
        <nav
          className="flex flex-wrap gap-[6px_18px] [&_a]:text-mist [&_a]:text-[14px] [&_a:hover]:text-paper"
          aria-label="Footer"
        >
          {LINKS.map((label) => (
            <a key={label} href="#">
              {label}
            </a>
          ))}
        </nav>
        <span className="ml-auto font-mono text-[11px] tracking-[0.06em] text-faint">
          © 2026 answer
        </span>
      </div>
    </footer>
  );
}
