import { loadAppMetadata } from '#lib/utils/changelog-parser.server.ts';

export function load() {
	return loadAppMetadata();
}
