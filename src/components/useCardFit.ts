import { useLayoutEffect, type RefObject } from 'react';

/** Fit actual rendered text, after fonts and viewport changes. Never transforms,
 * truncates, clamps lines or removes customer text. Font floors live in CSS. */
export default function useCardFit(ref: RefObject<HTMLDivElement | null>, contentKey: string) {
  useLayoutEffect(() => {
    const card = ref.current;
    const paper = card?.parentElement;
    if (!card || !paper) return;
    let frame = 0;
    let disposed = false;
    const fit = () => {
      if (disposed || !paper.clientHeight || !paper.clientWidth) return;
      const style = getComputedStyle(paper);
      const height = paper.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const width = paper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const fits = () => card.offsetHeight <= height + 1 && card.scrollHeight <= height + 1
        && card.scrollWidth <= width + 1 && card.clientWidth <= width + 1
        && [...card.querySelectorAll<HTMLElement>('.traditional-event dd,.traditional-person,.traditional-wording,.traditional-parents')]
          .every(node => node.scrollWidth <= node.clientWidth + 1);
      card.style.setProperty('--card-density', '1');
      if (!fits()) {
        card.style.setProperty('--card-density', '0');
        if (fits()) {
          let low = 0, high = 1;
          for (let i = 0; i < 9; i++) {
            const density = (low + high) / 2;
            card.style.setProperty('--card-density', String(density));
            if (fits()) low = density; else high = density;
          }
          card.style.setProperty('--card-density', String(Math.max(0, low - .015)));
        }
      }
      // A measurable guard for QA/preview: oversized copy is never silently
      // marked fitted. Text remains intact at the readable minimum.
      card.dataset.fit = fits() ? 'ready' : 'oversize';
      card.dataset.fitSize = JSON.stringify({height,width,actualHeight:card.offsetHeight,actualWidth:card.clientWidth,parent:paper.className});
      paper.scrollTop = 0;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(paper);
    document.fonts?.ready.then(schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    window.addEventListener('resize', schedule);
    fit();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); document.fonts?.removeEventListener('loadingdone', schedule); window.removeEventListener('resize', schedule); };
  }, [ref, contentKey]);
}
