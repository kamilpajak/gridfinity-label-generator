/**
 * Type declarations for scripts/standards-build.js (maintainer-only build script).
 *
 * Only the exports used by unit tests are declared. Keep in sync with the
 * `export` statement at the bottom of standards-build.js.
 */

export interface StandardImageMapping {
	image?: string;
	hardwareType?: string;
}

export interface BuildStandard {
	id: string;
	description: string;
	hardwareType?: string;
	image?: string;
}

export interface Designation {
	system: string;
	code: string;
}

export function addImageToStandard(
	standard: BuildStandard,
	standardId: string,
	imageMappings: Record<string, string | StandardImageMapping>,
	designations: Designation[]
): void;

export interface DinMediaData {
	mappings: Record<string, unknown>;
	cache: Record<string, unknown>;
}

export function assertDinMediaData(dinMediaData: DinMediaData | null, allowFallback: boolean): void;
