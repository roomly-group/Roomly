import { useEffect } from 'react';

// ===================== CONFIGURATION =====================

/** Portion of an element that must be on screen before it reveals (0–1). */
const REVEAL_THRESHOLD = 0.15 as const;
/** Bottom margin so elements reveal a little before they reach the viewport edge. */
const REVEAL_ROOT_MARGIN = '0px 0px -8% 0px' as const;

/**
 * Page motion for the whole app, mounted once:
 * - `[data-reveal]` elements fade up when they enter the viewport and fade out when they leave it
 *   (stagger with `style={{ '--reveal-delay': '120ms' }}`);
 * - `[data-scroll-tilt]` elements straighten as the page scrolls (0 → 1 in `--scroll-tilt`).
 * New elements (route changes) are picked up through a MutationObserver.
 * With reduced motion the CSS shows everything immediately.
 */
export function useScrollMotion() {
  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) => {
        // Enter: show. Leave (either edge): hide again, so the motion plays every time.
        for (const entry of entries) {
          entry.target.classList.toggle('is-visible', entry.isIntersecting);
          // Left through the top edge: exit upwards instead of back down.
          entry.target.classList.toggle('is-above', !entry.isIntersecting && entry.boundingClientRect.top < 0);
        }
      },
      { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN },
    );

    const scan = () => {
      document.querySelectorAll('[data-reveal]:not([data-reveal-bound])').forEach((el) => {
        el.setAttribute('data-reveal-bound', '');
        reveal.observe(el);
      });
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
