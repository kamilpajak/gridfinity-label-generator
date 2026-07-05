/**
 * Package `.lbx` files (label.xml + prop.xml) into a ZIP archive Blob.
 * A `.lbx` is a plain ZIP of XML; fflate produces it in-browser.
 */
import { zipSync, strToU8 } from 'fflate';

/**
 * Build an `.lbx` Blob from a map of file name -> UTF-8 string content.
 */
export function buildLbxBlob(files: Record<string, string>): Blob {
	const entries: Record<string, Uint8Array> = {};
	for (const [name, content] of Object.entries(files)) {
		entries[name] = strToU8(content);
	}
	const zipped = zipSync(entries, { level: 6 });
	// Copy into a fresh ArrayBuffer so the Blob owns tightly-sized bytes.
	return new Blob([zipped.slice()], { type: 'application/octet-stream' });
}
