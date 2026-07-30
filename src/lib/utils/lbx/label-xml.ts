/**
 * Generate a Brother P-touch `label.xml` that wraps a rendered label bitmap.
 *
 * The app's label (text, hardware icon, standard, QR — laid out by the same
 * pipeline as the PNG export) is rasterised to a 1-bit BMP and embedded as a
 * single `image:image` object. This gives P-touch a pixel-perfect copy of what
 * the app shows, instead of re-rendering text in a Brother font that does not
 * match. The image structure mirrors a shipped template ("Address2").
 *
 * CRITICAL: the output has NO whitespace between elements. P-touch's parser
 * walks child nodes directly and dereferences a null when it hits a whitespace
 * text node — a pretty-printed `.lbx` crashes P-touch Editor (verified in Phase
 * 0). Keep this compact.
 */
import { TAPE_SPECS, PT_PRINTER_ID, PT_PRINTER_NAME, mmToPt, xmlEscape } from './units';

const NS =
	'xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main"' +
	' xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style"' +
	' xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text"' +
	' xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw"' +
	' xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image"' +
	' xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode"' +
	' xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database"' +
	' xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table"';

/** Placement of the embedded bitmap on the tape, in millimetres. */
export interface LbxImageRect {
	/** File name of the BMP entry inside the `.lbx` ZIP (e.g. `Object0.bmp`). */
	fileName: string;
	/** Offset from the label's leading edge along the tape length (mm). */
	xMm: number;
	/** Offset from the tape edge along its width (mm). */
	yMm: number;
	/** Displayed width along the tape length (mm). */
	widthMm: number;
	/** Displayed height along the tape width (mm). */
	heightMm: number;
}

export interface LbxImageLabelInput {
	/** Tape width in mm (the app's TapeHeight). */
	tapeHeightMm: 9 | 12;
	/** Label length along the tape, in mm (the app's label width). */
	labelLengthMm: number;
	/** The embedded bitmap and where it sits on the tape. */
	image: LbxImageRect;
}

/**
 * Build a compact, P-touch-valid `label.xml` that displays a single embedded
 * bitmap on the given tape.
 */
export function buildImageLabelXml(input: LbxImageLabelInput): string {
	const spec = TAPE_SPECS[input.tapeHeightMm];
	if (!spec) throw new Error(`Unsupported tape height: ${input.tapeHeightMm}mm`);

	const lengthPt = mmToPt(input.labelLengthMm);
	const x = mmToPt(input.image.xMm);
	const y = mmToPt(input.image.yMm);
	const w = mmToPt(input.image.widthMm);
	const h = mmToPt(input.image.heightMm);
	// Trailing margins are the space left after the image, not a mirror of the
	// leading margin — correct for any placement (equals x/y for symmetric ones).
	const marginRight = mmToPt(input.labelLengthMm - input.image.xMm - input.image.widthMm);
	const marginBottom = mmToPt(input.tapeHeightMm - input.image.yMm - input.image.heightMm);

	const paper =
		`<style:paper media="0" width="${spec.paperWidthPt}pt" height="${lengthPt}pt"` +
		` marginLeft="${x}pt" marginTop="${y}pt" marginRight="${marginRight}pt" marginBottom="${marginBottom}pt"` +
		` orientation="landscape" autoLength="false" monochromeDisplay="true" paperColor="#FFFFFF"` +
		` paperInk="#000000" split="1" format="${spec.format}" backgroundTheme="0"` +
		` printerID="${PT_PRINTER_ID}" printerName="${PT_PRINTER_NAME}"/>`;

	const background =
		`<style:backGround x="${x}pt" y="${y}pt" width="${w}pt" height="${h}pt"` +
		` brushStyle="NULL" brushId="0" color="#000000" backColor="#FFFFFF"/>`;

	const imageObject =
		`<image:image>` +
		`<pt:objectStyle x="${x}pt" y="${y}pt" width="${w}pt" height="${h}pt"` +
		` backColor="#FFFFFF" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">` +
		`<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000"/>` +
		`<pt:brush style="NULL" color="#000000" id="0"/>` +
		`<pt:expanded objectName="Bitmap1" ID="0" lock="0" templateMergeTarget="LABELLIST"` +
		` templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/>` +
		`</pt:objectStyle>` +
		`<image:imageStyle originalName="" alignInText="LEFT" firstMerge="true"` +
		` fileName="${xmlEscape(input.image.fileName)}">` +
		`<image:transparent flag="false" color="#FFFFFF"/>` +
		`<image:trimming flag="false" shape="RECTANGLE" trimOrgX="0pt" trimOrgY="0pt"` +
		` trimOrgWidth="0pt" trimOrgHeight="0pt"/>` +
		`<image:orgPos x="${x}pt" y="${y}pt" width="${w}pt" height="${h}pt"/>` +
		`<image:effect effect="NONE" brightness="50" contrast="50" photoIndex="4"/>` +
		`<image:mono operationKind="BINARY" reverse="0" ditherKind="MESH" threshold="128"` +
		` gamma="100" ditherEdge="0" rgbconvProportionRed="30" rgbconvProportionGreen="59"` +
		` rgbconvProportionBlue="11" rgbconvProportionReversed="0"/>` +
		`</image:imageStyle>` +
		`</image:image>`;

	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<pt:document ${NS} version="1.0">` +
		`<pt:body currentSheet="Sheet 1">` +
		`<style:sheet name="Sheet 1">` +
		paper +
		`<style:cutLine regularCut="0pt" freeCut=""/>` +
		background +
		`<pt:objects>${imageObject}</pt:objects>` +
		`</style:sheet>` +
		`</pt:body>` +
		`</pt:document>`
	);
}
