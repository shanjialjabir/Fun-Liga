import { useSyncExternalStore } from "react";
const subscribe = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
const snapshot = () => window.location.hash.slice(1).split("?")[0] || "/";
export function usePathname() {
  return useSyncExternalStore(subscribe, snapshot, () => "/");
}
const router = {
  push: (href: string) => {
    window.location.hash = href;
    window.scrollTo(0, 0);
  },
};
export function useRouter() {
  return router;
}
