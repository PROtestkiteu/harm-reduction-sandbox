/** Editable controls retain typing and native navigation instead of game shortcuts. */
export function isEditing(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
}

/** Reserve Space before focused controls can turn it into an unrelated click. */
export function bindPauseShortcut(toggle: () => void): void {
  const handle = (event: KeyboardEvent): void => {
    if (event.code !== 'Space' || event.isComposing || isEditing(event.target)) return;
    // Modified Space belongs to the browser/OS, but must not activate game controls.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'keydown' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) toggle();
  };
  window.addEventListener('keydown', handle, true);
  window.addEventListener('keyup', handle, true);
}
