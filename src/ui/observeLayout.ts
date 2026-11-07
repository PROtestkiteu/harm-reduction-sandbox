/** Coalesce geometry updates outside resize delivery, using the latest layout. */
export function observeLayout(elements: readonly Element[], update: () => void): () => void {
  let frame = 0;
  const observer = new ResizeObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; update(); });
  });
  for (const element of elements) observer.observe(element);
  return () => { observer.disconnect(); cancelAnimationFrame(frame); frame = 0; };
}
