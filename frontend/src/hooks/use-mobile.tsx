import * as React from 'react';

// ===================== CONFIGURATION =====================

/** Maximum viewport width considered mobile by the responsive hook (px). */
const MOBILE_BREAKPOINT_PX = 768 as const;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
