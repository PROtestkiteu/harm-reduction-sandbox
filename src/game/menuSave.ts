import type { SaveData } from './saveGame';
import { TutorialProgress } from './tutorial';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Recognize complete save envelopes without importing layout-dependent restoration.
 * Older revision-one saves retain their optional fields; main still normalizes every
 * field with parseSave before restoring. A truncated object must not become a new city.
 */
export function menuSave(raw: unknown): SaveData | null {
  if (!record(raw) || raw.v !== 1 || !finite(raw.clock) || !record(raw.org) || !record(raw.upgrades) || !record(raw.street) || !record(raw.totals)) return null;
  if (!finite(raw.org.budget) || !finite(raw.org.paid) || !finite(raw.org.volunteers) || !finite(raw.totals.helped) || !finite(raw.totals.nights)) return null;
  if (!Array.isArray(raw.team) || !Array.isArray(raw.units) || !Array.isArray(raw.campers)) return null;
  if (!raw.team.every(record) || !raw.units.every(record) || !raw.campers.every(finite)) return null;
  if (raw.tutorial !== undefined && !TutorialProgress.restore(raw.tutorial)) return null;
  return raw as unknown as SaveData;
}

/** Inspect a portable link before committing to a world layout or renderer. */
export async function menuLinkedSave(code: string, compressed: boolean): Promise<SaveData | null> {
  if (!code || code.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const bytes = Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    let decoded: Uint8Array = bytes;
    if (compressed) {
      if (typeof DecompressionStream !== 'undefined') {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 60000) { await reader.cancel(); return null; }
          chunks.push(part.value);
        }
        decoded = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { decoded.set(chunk, offset); offset += chunk.byteLength; }
      } else {
        decoded = (await import('fflate')).inflateSync(bytes);
      }
    }
    if (decoded.byteLength > 60000) return null;
    return menuSave(JSON.parse(new TextDecoder().decode(decoded)));
  } catch { return null; }
}
