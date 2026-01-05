import { loadAppMetadata } from '$lib/utils/changelog-parser.server';

export function load() {
	return loadAppMetadata();
}
