/**
 * Package `.lbx` files (label.xml + prop.xml + optional bitmaps) into a ZIP
 * archive Blob. A `.lbx` is a plain ZIP; fflate produces it in-browser.
 */
import { zipSync, strToU8 } from 'fflate';

/** A `.lbx` entry: a UTF-8 XML string, or raw bytes (e.g. an embedded BMP). */
export type LbxFile = string | Uint8Array;

/**
 * Build an `.lbx` Blob from a map of file name -> content. String values are
 * encoded as UTF-8; `Uint8Array` values (bitmaps) are stored verbatim.
 */
export function buildLbxBlob(files: Record<string, LbxFile>): Blob {
	const entries: Record<string, Uint8Array> = {};
	for (const [name, content] of Object.entries(files)) {
		entries[name] = typeof content === 'string' ? strToU8(content) : content;
	}
	const zipped = zipSync(entries, { level: 6 });
	// Copy into a fresh ArrayBuffer so the Blob owns tightly-sized bytes.
	return new Blob([zipped.slice()], { type: 'application/octet-stream' });
}
