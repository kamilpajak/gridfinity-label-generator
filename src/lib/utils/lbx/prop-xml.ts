/**
 * Generate the `prop.xml` metadata manifest for a `.lbx`.
 * Compact (no inter-element whitespace), modelled on a real shipped template.
 */
import { xmlEscape } from './units';

export interface LbxPropInput {
	/** Human-readable label title. */
	title: string;
	/** ISO timestamp (created/modified); pass a fixed value for deterministic output. */
	timestamp?: string;
}

export function buildPropXml(input: LbxPropInput): string {
	const title = xmlEscape(input.title);
	const ts = input.timestamp ?? '2000-01-01T00:00:00Z';
	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<meta:properties xmlns:meta="http://schemas.brother.info/ptouch/2007/lbx/meta"` +
		` xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">` +
		`<meta:appName>Gridfinity Label Generator</meta:appName>` +
		`<dc:title>${title}</dc:title>` +
		`<dc:subject/>` +
		`<dc:creator>Gridfinity Label Generator</dc:creator>` +
		`<meta:keyword/>` +
		`<dc:description/>` +
		`<meta:template/>` +
		`<dcterms:created>${ts}</dcterms:created>` +
		`<dcterms:modified>${ts}</dcterms:modified>` +
		`<meta:lastPrinted/>` +
		`<meta:modifiedBy/>` +
		`<meta:revision>1</meta:revision>` +
		`<meta:editTime>0</meta:editTime>` +
		`<meta:numPages>1</meta:numPages>` +
		`<meta:numWords>0</meta:numWords>` +
		`<meta:numChars>0</meta:numChars>` +
		`<meta:security>0</meta:security>` +
		`</meta:properties>`
	);
}
