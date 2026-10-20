import { useEffect } from 'react';

// ===================== CONFIGURATION =====================

/** Portion of an element that must be on screen before it reveals (0–1). */
const REVEAL_THRESHOLD = 0.15 as const;
/** Bottom margin so elements reveal a little before they reach the viewport edge. */
const REVEAL_ROOT_MARGIN = '0px 0px -8% 0px' as const;

/**
 * Page motion for the whole app, mounted once:
 * - `[data-reveal]` elements fade up the first time they enter the viewport
 *   (stagger with `style={{ '--reveal-delay': '120ms' }}`);
 * - `[data-scroll-tilt]` elements straighten as the page scrolls (0 → 1 in `--scroll-tilt`).
 * New elements (route changes) are picked up through a MutationObserver.
 * With reduced motion the CSS shows everything immediately.
 */
export function useScrollMotion() {
  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN },
    );

    const scan = () => {
      document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => reveal.observe(el));
    };

    let frame = 0;
    const tilt = () => {
      frame = 0;
      document.querySelectorAll<HTMLElement>('[data-scroll-tilt]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const progress = Math.min(Math.max(1 - rect.top / window.innerHeight, 0), 1);
        el.style.setProperty('--scroll-tilt', progress.toFixed(3));
      });
      document.querySelectorAll<HTMLElement>('[data-scroll-words]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const progress = Math.min(Math.max((window.innerHeight * 0.85 - rect.top) / (rect.height + window.innerHeight * 0.35), 0), 1);
        el.style.setProperty('--scroll-words', progress.toFixed(3));
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(tilt);
    };

    scan();
    tilt();
    const mutations = new MutationObserver(() => {
      scan();
      onScroll();
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      reveal.disconnect();
      mutations.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
