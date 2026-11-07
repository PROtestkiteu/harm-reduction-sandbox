/** Lightweight object portraits share the face frame without another renderer or image request. */
const symbols = {
  person: '<circle cx="32" cy="22" r="10"/><path d="M12 66V55a20 20 0 0 1 40 0v11"/>',
  location: '<path d="M8 30 32 12l24 18M14 27v39h36V27M26 66V46h12v20M22 34h4m12 0h4"/>',
  building: '<path d="M12 66V14h40v52M24 66V52h16v14M22 25h4m12 0h4M22 36h4m12 0h4M8 66h48"/>',
  vehicle: '<path d="m10 40 6-18h32l6 18v19H10zM12 40h40M20 59v7m24-7v7M18 49h5m18 0h5"/>',
};
export type SelectionPortraitKind = keyof typeof symbols;

export function selectionPortrait(): { root: HTMLElement; show(kind: SelectionPortraitKind): void } {
  const root = document.createElement('span');
  root.className = 'portrait-object portrait-view';
  root.setAttribute('aria-hidden', 'true');
  let current: SelectionPortraitKind | null = null;
  return { root, show(kind) {
    if (kind === current) return;
    current = kind;
    root.innerHTML = `<svg viewBox="0 0 64 80" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${symbols[kind]}</svg>`;
  } };
}
