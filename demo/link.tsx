import type { AnchorHTMLAttributes } from "react";
export default function Link({
  href,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...props}
      href={`#${href}`}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          window.location.hash = href;
          window.scrollTo(0, 0);
        }
      }}
    />
  );
}
