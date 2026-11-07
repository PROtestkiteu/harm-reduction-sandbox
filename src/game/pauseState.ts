export type PauseReason = 'tutorial' | 'welcome' | 'placement' | 'detail' | 'confirmation' | 'event' | 'report' | 'queue' | 'organisation';

/** Manual intent and independent windows share one effective clock state. */
export class PauseState {
  private manual = false;
  private readonly windows = new Set<PauseReason>();
  private effective = false;
  constructor(private readonly changed: (paused: boolean) => void) {}
  get paused(): boolean { return this.effective; }
  get manuallyPaused(): boolean { return this.manual; }
  setManual(paused: boolean): void { this.manual = paused; this.sync(); }
  setWindow(reason: PauseReason, open: boolean): void {
    if (open) this.windows.add(reason);
    else this.windows.delete(reason);
    this.sync();
  }
  private sync(): void {
    const next = this.manual || this.windows.size > 0;
    if (next === this.effective) return;
    this.effective = next;
    this.changed(next);
  }
}
