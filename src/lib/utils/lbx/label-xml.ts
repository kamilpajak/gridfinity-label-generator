/**
 * Generate a Brother P-touch `label.xml` for a single text label.
 *
 * CRITICAL: the output has NO whitespace between elements. P-touch's parser
 * walks child nodes directly and dereferences a null when it hits a whitespace
 * text node — a pretty-printed `.lbx` crashes P-touch Editor (verified in Phase
 * 0). Keep this compact.
 *
 * The structure mirrors a real shipped template ("Bin Box"): one `text:text`
 * object with `shrink="true"` so P-touch auto-fits the text to its frame.
 */
import { TAPE_SPECS, PT_PRINTER_ID, PT_PRINTER_NAME, mmToPt, xmlEscape, charLength } from './units';

const NS =
	'xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main"' +
	' xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style"' +
	' xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text"' +
	' xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw"' +
	' xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image"' +
	' xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode"' +
	' xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database"' +
	' xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table"';

/** Font info reused for the object default and its single string run (Helsinki is a Brother built-in). */
function fontInfo(fontPt: number): string {
	return (
		`<text:logFont name="Helsinki Narrow" width="0" italic="false" weight="700" charSet="0" pitchAndFamily="34"/>` +
		`<text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${fontPt}pt" orgSize="28.8pt" textColor="#000000"/>`
	);
}

export interface LbxLabelInput {
	/** The single line of text on the label. */
	text: string;
	/** Tape width in mm (the app's TapeHeight). */
	tapeHeightMm: 9 | 12;
	/** Label length along the tape, in mm (the app's label width). */
	labelLengthMm: number;
	/** Optional font size in points (default 10). */
	fontPt?: number;
}

/**
 * Build a compact, P-touch-valid `label.xml` string for a one-line text label.
 */
export function buildLabelXml(input: LbxLabelInput): string {
	const spec = TAPE_SPECS[input.tapeHeightMm];
	if (!spec) throw new Error(`Unsupported tape height: ${input.tapeHeightMm}mm`);

	const fontPt = input.fontPt ?? 10;
	const lengthPt = mmToPt(input.labelLengthMm);
	const text = xmlEscape(input.text);
	const len = charLength(input.text);

	// Length axis (paper.height): margins on left/right; tape-width axis (paper.width): the printable band.
	const bgX = spec.marginLengthPt;
	const bgWidth = Math.round((lengthPt - spec.marginLengthPt * 2) * 10) / 10;
	const boxX = spec.marginLengthPt + 1;
	const boxWidth = Math.round((lengthPt - spec.marginLengthPt * 2 - 2) * 10) / 10;
	const boxY = Math.round((spec.bandYPt + 0.2) * 10) / 10;
	const boxHeight = Math.round((spec.bandHeightPt - 0.4) * 10) / 10;

	const paper =
		`<style:paper media="0" width="${spec.paperWidthPt}pt" height="${lengthPt}pt"` +
		` marginLeft="${spec.marginLengthPt}pt" marginTop="${spec.marginWidthPt}pt"` +
		` marginRight="${spec.marginLengthPt}pt" marginBottom="${spec.marginWidthPt}pt"` +
		` orientation="landscape" autoLength="false" monochromeDisplay="true" paperColor="#FFFFFF"` +
		` paperInk="#000000" split="1" format="${spec.format}" backgroundTheme="0"` +
		` printerID="${PT_PRINTER_ID}" printerName="${PT_PRINTER_NAME}"/>`;

	const background =
		`<style:backGround x="${bgX}pt" y="${spec.bandYPt}pt" width="${bgWidth}pt" height="${spec.bandHeightPt}pt"` +
		` brushStyle="NULL" brushId="0" color="#000000" backColor="#FFFFFF"/>`;

	const textObject =
		`<text:text>` +
		`<pt:objectStyle x="${boxX}pt" y="${boxY}pt" width="${boxWidth}pt" height="${boxHeight}pt"` +
		` backColor="#FFFFFF" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">` +
		`<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#FF0000"/>` +
		`<pt:brush style="NULL" color="#FF0000" id="1"/>` +
		`<pt:expanded objectName="Text1" ID="0" lock="0" templateMergeTarget="LABLELIST"` +
		` templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/>` +
		`</pt:objectStyle>` +
		`<text:ptFontInfo>${fontInfo(fontPt)}</text:ptFontInfo>` +
		`<text:textControl control="FIXEDFRAME" clipFrame="false" aspectNormal="true" shrink="true"` +
		` autoLF="false" avoidImage="false"/>` +
		`<text:textAlign horizontalAlignment="CENTER" verticalAlignment="CENTER" inLineAlignment="BASELINE"/>` +
		`<text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="${fontPt}pt" combinedChars="false"/>` +
		`<pt:data>${text}</pt:data>` +
		`<text:stringItem charLen="${len}"><text:ptFontInfo>${fontInfo(fontPt)}</text:ptFontInfo></text:stringItem>` +
		`</text:text>`;

	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<pt:document ${NS} version="1.0">` +
		`<pt:body currentSheet="Sheet 1">` +
		`<style:sheet name="Sheet 1">` +
		paper +
		`<style:cutLine regularCut="0pt" freeCut=""/>` +
		background +
		`<pt:objects>${textObject}</pt:objects>` +
		`</style:sheet>` +
		`</pt:body>` +
		`</pt:document>`
	);
}
