"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface PageTransitionContextValue {
  isTransitioning: boolean;
  navigate: (href: string) => void;
}

const PageTransitionContext = createContext<PageTransitionContextValue>({
  isTransitioning: false,
  navigate: () => {},
});

export function usePageTransition() {
  return useContext(PageTransitionContext);
}

/** Programmatic navigation without transition overlays. */
export function usePageTransitionRouter() {
  const router = useRouter();
  const { navigate } = usePageTransition();

  return {
    ...router,
    push: (href: string) => {
      navigate(href);
    },
    replace: (href: string) => {
      navigate(href);
    },
  };
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  return (
    <PageTransitionContext.Provider
      value={{
        isTransitioning: false,
        navigate,
      }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
}
