import { computeDynamicFontSize, mmToPx } from '~/utils/measurements'
import { shortenUrl, shouldShortenUrl } from '~/utils/urlShortener'
import { logger } from '~/config/logging'

/**
 * Loads required fonts before rendering.
 * Includes verification and fallback mechanisms to prevent race conditions.
 */
async function ensureFontsLoaded(): Promise<void> {
  try {
    // Try to load fonts
    await Promise.all([
      document.fonts.load('400 16px "Noto Sans"'),
      document.fonts.load('900 16px "Noto Sans"'),
      document.fonts.load('400 16px "Oswald"'),
      document.fonts.load('700 16px "Oswald"'),
    ])

    // Verify fonts are actually loaded and ready
    if (
      !document.fonts.check('900 16px "Noto Sans"') ||
      !document.fonts.check('700 16px "Oswald"')
    ) {
      logger.warn('Fonts not fully loaded, waiting for fonts ready event')
      await document.fonts.ready

      // Double-check after fonts.ready
      if (
        !document.fonts.check('900 16px "Noto Sans"') ||
        !document.fonts.check('700 16px "Oswald"')
      ) {
        logger.warn('Fonts still not available after fonts.ready, using fallbacks')
      }
    }
  } catch (error) {
    logger.error('Failed to load fonts:', error)
    // Wait for fonts ready as fallback
    try {
      await document.fonts.ready
    } catch (readyError) {
      logger.error('Failed to wait for fonts.ready:', readyError)
    }
  }
}

/**
 * Returns label texts (top and bottom) based on the provided parameters.
 */
export function getLabelTexts(
  selectedType: string,
  selectedSystem: string,
  threadSize: string,
  length: string,
  hardwareStandard: string,
  notes: string,
  showStandardName: boolean,
  _selectedScrewSubtype?: string
): { topText: string; bottomText: string } {
  let topText: string
  if (selectedType === 'Screw') {
    let displayThreadSize = threadSize

    // Remove "mm" from thread size for metric screws on the label
    if (selectedSystem === 'Metric' && threadSize.endsWith('mm')) {
      displayThreadSize = threadSize.replace('mm', '')
    }

    if (length) {
      // Both Bolt and Screw show thread size and length
      if (selectedSystem === 'Metric') {
        topText = `${displayThreadSize} × ${length}`
      } else {
        topText = `${displayThreadSize} × ${length}″`
      }
    } else {
      // Fallback if no length is provided
      topText = displayThreadSize || 'Default top text'
    }
  } else {
    topText = threadSize || 'Default top text'
  }

  let bottomText: string
  if (showStandardName) {
    if (hardwareStandard) {
      if (notes) {
        bottomText = `${hardwareStandard} ${notes}`
      } else {
        bottomText = hardwareStandard
      }
    } else {
      bottomText = 'Default bottom text'
    }
  } else {
    bottomText = notes || ''
  }

  return { topText, bottomText }
}

/**
 * Loads an image from a given URL. If the original image fails and the URL ends with .svg,
 * attempts to load a JPG fallback.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  // If no URL is provided, return null immediately
  if (!url || url.trim() === '') {
    logger.warn('No image URL provided')
    return null
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'

  try {
    await new Promise<void>(resolve => {
      img.onload = () => {
        logger.debug('Image loaded successfully:', url)
        resolve()
      }
      img.onerror = () => {
        logger.warn(`Failed to load image with original extension: ${url}`)
        resolve()
      }
      img.src = url
    })

    if (img.complete && img.naturalWidth > 0) {
      return img
    }

    // Try with .jpg extension if it's an SVG
    if (url.toLowerCase().endsWith('.svg')) {
      const jpgUrl = url.replace(/\.svg$/i, '.jpg')
      logger.debug('Trying JPG fallback:', jpgUrl)
      const jpgImg = new Image()
      jpgImg.crossOrigin = 'anonymous'

      await new Promise<void>(resolve => {
        jpgImg.onload = () => {
          logger.debug('JPG fallback loaded successfully')
          resolve()
        }
        jpgImg.onerror = () => {
          logger.error(`Failed to load both SVG and JPG: ${url}`)
          resolve()
        }
        jpgImg.src = jpgUrl
      })

      if (jpgImg.complete && jpgImg.naturalWidth > 0) {
        return jpgImg
      }
    }

    // If we couldn't load the image, log an error
    logger.error('Failed to load image:', url)
    return null
  } catch (error) {
    logger.error('Error loading image:', error)
    return null
  }
}

/**
 * Measures text and scales it down if it exceeds maxWidth.
 * Returns an object with the final font size and measurement metrics.
 */
function measureAndScaleText(
  ctx: CanvasRenderingContext2D,
  text: string,
  desiredPxHeight: number,
  fontFamily: string,
  fontWeight: string,
  maxWidth: number
) {
  let fontSize = computeDynamicFontSize(ctx, desiredPxHeight, text, fontFamily)
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`
  let metrics = ctx.measureText(text)

  if (metrics.width > maxWidth) {
    const scaleFactor = maxWidth / metrics.width
    fontSize *= scaleFactor
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`
    metrics = ctx.measureText(text)
  }

  return { fontSize, metrics }
}

/**
 * Draws the image on the left side of the label while preserving its natural aspect ratio.
 * Limits the image width to a maximum of 40% of the label width.
 * Returns the total horizontal space occupied by the image plus a gap.
 */
function drawImageIfNeeded(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  labelWidthPx: number,
  labelHeightPx: number,
  gapPx: number,
  showImage: boolean
): number {
  if (!showImage || !image) {
    return 0
  }

  // Compute the natural aspect ratio of the image.
  const aspectRatio = image.naturalWidth / image.naturalHeight

  // Calculate image width if drawn with full label height.
  const fullHeightWidth = labelHeightPx * aspectRatio

  // Maximum allowed image width: 40% of label width.
  const maxAllowedWidth = labelWidthPx * 0.4

  let imageWidth: number, imageHeight: number

  if (fullHeightWidth > maxAllowedWidth) {
    // Limit image width to the maximum allowed value.
    imageWidth = maxAllowedWidth
    // Adjust height to maintain exact aspect ratio.
    imageHeight = imageWidth / aspectRatio
    // Center the image vertically.
    const offsetY = (labelHeightPx - imageHeight) / 2
    ctx.drawImage(image, 0, offsetY, imageWidth, imageHeight)
  } else {
    // Use full label height if the resulting width is within the limit.
    imageWidth = fullHeightWidth
    imageHeight = labelHeightPx
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight)
  }

  return imageWidth + gapPx
}

/**
 * Options for generating a label
 */
export interface GenerateLabelOptions {
  standardImgUrl: string
  topText: string
  bottomText: string
  labelWidthMm: number
  labelHeightMm: number
  showImage: boolean
  showQrCode?: boolean
  qrCodeContent?: string
}

// Helper types and interfaces for refactoring
interface LabelDimensions {
  printableWidthMm: number
  printableHeightMm: number
  printableWidthPx: number
  printableHeightPx: number
  conversionFactor: number
}

interface TextDimensions {
  adjustedTextHeightMm: number
  desiredTextHeight: number
  gapPx: number
}

interface QrCodeDimensions {
  qrCodeWidth: number
  qrCodeX: number
}

/**
 * Calculates canvas dimensions based on label dimensions
 */
function calculateCanvasDimensions(labelWidthMm: number, labelHeightMm: number): LabelDimensions {
  const printableWidthMm = labelWidthMm - 4
  const printableHeightMm = labelHeightMm - 2
  const exactAspectRatio = printableWidthMm / printableHeightMm

  logger.debug(`Label size (mm): ${labelWidthMm} × ${labelHeightMm}`)
  logger.debug(`Printable area (mm): ${printableWidthMm} × ${printableHeightMm}`)
  logger.debug(`Exact aspect ratio: ${exactAspectRatio.toFixed(6)}`)

  const printableHeightPx = Math.round(mmToPx(printableHeightMm))
  const printableWidthPx = Math.round(printableHeightPx * exactAspectRatio)
  const conversionFactor = printableWidthPx / printableWidthMm

  logger.debug(`Conversion factor: ${conversionFactor.toFixed(6)} px/mm`)
  logger.debug(`Canvas dimensions (px): ${printableWidthPx} × ${printableHeightPx}`)
  logger.debug(`Canvas aspect ratio: ${(printableWidthPx / printableHeightPx).toFixed(6)}`)

  return {
    printableWidthMm,
    printableHeightMm,
    printableWidthPx,
    printableHeightPx,
    conversionFactor,
  }
}

/**
 * Calculates text dimensions based on label height
 */
function calculateTextDimensions(
  labelHeightMm: number,
  showImage: boolean,
  standardImg: HTMLImageElement | null,
  conversionFactor: number
): TextDimensions {
  const textHeightPercentage = 0.375
  const adjustedTextHeightMm = labelHeightMm * textHeightPercentage
  const gapPercentage = 0.167
  const baselineGap = labelHeightMm * gapPercentage

  logger.debug(
    `Text height (mm): ${adjustedTextHeightMm.toFixed(2)} (${(textHeightPercentage * 100).toFixed(1)}% of label height)`
  )
  logger.debug(
    `Baseline gap (mm): ${baselineGap.toFixed(2)} (${(gapPercentage * 100).toFixed(1)}% of label height)`
  )

  const gapPx = showImage && standardImg ? mmToPx(baselineGap) : 0
  logger.debug(`Computed gap (mm): ${(gapPx / conversionFactor).toFixed(2)}`)

  return {
    adjustedTextHeightMm,
    desiredTextHeight: mmToPx(adjustedTextHeightMm),
    gapPx,
  }
}

/**
 * Creates and initializes canvas
 */
function createCanvas(dimensions: LabelDimensions): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  canvas.width = dimensions.printableWidthPx
  canvas.height = dimensions.printableHeightPx
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    logger.error('Could not get canvas context.')
    return null
  }

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, dimensions.printableWidthPx, dimensions.printableHeightPx)
  return ctx
}

/**
 * Draws QR code on the label
 */
async function drawQrCode(
  ctx: CanvasRenderingContext2D,
  showQrCode: boolean,
  qrCodeContent: string,
  labelHeightMm: number,
  dimensions: LabelDimensions
): Promise<QrCodeDimensions> {
  const result: QrCodeDimensions = { qrCodeWidth: 0, qrCodeX: 0 }

  const minHeightForQRMm = 12
  const qrCodeAllowed = labelHeightMm >= minHeightForQRMm

  if (!qrCodeAllowed && showQrCode) {
    logger.debug(
      `QR code disabled for ${labelHeightMm}mm label (minimum ${minHeightForQRMm}mm required for readability)`
    )
    return result
  }

  if (!showQrCode || !qrCodeContent || !qrCodeAllowed) {
    return result
  }

  try {
    const maxQrSizeMm = 15
    const maxQrSizePx = mmToPx(maxQrSizeMm)
    const qrSizePx = Math.min(dimensions.printableHeightPx, maxQrSizePx)
    const qrSizeMm = qrSizePx / dimensions.conversionFactor

    result.qrCodeWidth = qrSizePx
    result.qrCodeX = dimensions.printableWidthPx - qrSizePx
    const qrY = (dimensions.printableHeightPx - qrSizePx) / 2

    let finalQrContent = qrCodeContent
    if (shouldShortenUrl(qrCodeContent)) {
      try {
        finalQrContent = await shortenUrl(qrCodeContent)
        logger.debug(`URL shortened: ${qrCodeContent} → ${finalQrContent}`)
      } catch (error) {
        logger.error('Error shortening URL:', error)
      }
    }

    const QRCode = await import('qrcode')
    const qrDataUrl = await QRCode.default.toDataURL(finalQrContent, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: qrSizePx,
      color: { dark: '#000000', light: '#FFFFFF' },
    })

    const qrImg = new Image()
    await new Promise<void>(resolve => {
      qrImg.onload = () => resolve()
      qrImg.onerror = () => {
        logger.error('Failed to load QR code image')
        resolve()
      }
      qrImg.src = qrDataUrl
    })

    if (qrImg.complete && qrImg.naturalWidth > 0) {
      ctx.drawImage(qrImg, result.qrCodeX, qrY, qrSizePx, qrSizePx)
    }

    logger.debug(
      `QR code positioned at x=${(result.qrCodeX / dimensions.conversionFactor).toFixed(2)}mm, y=${(qrY / dimensions.conversionFactor).toFixed(2)}mm, size=${qrSizeMm.toFixed(2)}mm (max ${maxQrSizeMm}mm)`
    )
  } catch (error) {
    logger.error('Error generating QR code:', error)
  }

  return result
}

interface DrawTextParams {
  ctx: CanvasRenderingContext2D
  textAreaX: number
  textAreaWidth: number
  desiredTextHeight: number
  printableHeightPx: number
  conversionFactor: number
}

interface DrawSingleLineTextParams extends DrawTextParams {
  topText: string
  bottomText: string
}

interface DrawTwoLineTextParams extends DrawTextParams {
  topText: string
  bottomText: string
}

/**
 * Draws text on the label (single line mode)
 */
function drawSingleLineText(params: DrawSingleLineTextParams): void {
  const {
    ctx,
    topText,
    bottomText,
    textAreaX,
    textAreaWidth,
    desiredTextHeight,
    printableHeightPx,
    conversionFactor,
  } = params
  const combinedText =
    bottomText.trim() && bottomText !== topText ? `${topText} ${bottomText}` : topText

  const { fontSize, metrics } = measureAndScaleText(
    ctx,
    combinedText,
    desiredTextHeight,
    'Noto Sans',
    '900',
    textAreaWidth
  )

  ctx.font = `900 ${fontSize}px "Noto Sans", serif`
  const textX = textAreaX + (textAreaWidth - metrics.width) / 2
  const textY =
    (printableHeightPx + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
  ctx.fillText(combinedText, textX, textY)

  logger.debug(
    `Single-line text dimensions (mm): width=${(metrics.width / conversionFactor).toFixed(2)}`
  )
  if (bottomText.trim() && bottomText !== topText) {
    logger.debug(`Combined text due to height constraint: "${combinedText}"`)
  }
}

/**
 * Draws text on the label (two line mode)
 */
function drawTwoLineText(params: DrawTwoLineTextParams): void {
  const {
    ctx,
    topText,
    bottomText,
    textAreaX,
    textAreaWidth,
    desiredTextHeight,
    printableHeightPx,
    conversionFactor,
  } = params
  const topResult = measureAndScaleText(
    ctx,
    topText,
    desiredTextHeight,
    'Noto Sans',
    '900',
    textAreaWidth
  )

  const bottomResult = measureAndScaleText(
    ctx,
    bottomText,
    desiredTextHeight,
    'Oswald',
    '700',
    textAreaWidth
  )

  let textGapMm = 2.5
  let textGapPx = mmToPx(textGapMm)

  const topTextHeight =
    topResult.metrics.actualBoundingBoxAscent + topResult.metrics.actualBoundingBoxDescent
  const bottomTextHeight =
    bottomResult.metrics.actualBoundingBoxAscent + bottomResult.metrics.actualBoundingBoxDescent
  let totalTextHeight = topTextHeight + textGapPx + bottomTextHeight

  if (totalTextHeight > printableHeightPx) {
    const minGapMm = 0.5
    const minGapPx = mmToPx(minGapMm)
    textGapPx = Math.max(minGapPx, printableHeightPx - topTextHeight - bottomTextHeight)
    textGapMm = textGapPx / conversionFactor
    totalTextHeight = topTextHeight + textGapPx + bottomTextHeight
  }

  let groupY = (printableHeightPx - totalTextHeight) / 2
  groupY = Math.max(0, Math.min(groupY, printableHeightPx - totalTextHeight))

  ctx.font = `900 ${topResult.fontSize}px "Noto Sans", serif`
  const topX = textAreaX + (textAreaWidth - topResult.metrics.width) / 2
  const topY = groupY + topResult.metrics.actualBoundingBoxAscent
  ctx.fillText(topText, topX, topY)

  ctx.font = `700 ${bottomResult.fontSize}px "Oswald", sans-serif`
  const bottomX = textAreaX + (textAreaWidth - bottomResult.metrics.width) / 2
  const bottomY = groupY + topTextHeight + textGapPx + bottomResult.metrics.actualBoundingBoxAscent
  ctx.fillText(bottomText, bottomX, bottomY)

  logger.debug(`Two-line text with ${textGapMm}mm gap, centered vertically`)
  logger.debug(
    `Top text dimensions (mm): width=${(topResult.metrics.width / conversionFactor).toFixed(2)}`
  )
  logger.debug(
    `Bottom text dimensions (mm): width=${(bottomResult.metrics.width / conversionFactor).toFixed(2)}`
  )
}

/**
 * Generates a label image as a PNG DataURL.
 * The QR code has highest priority and is positioned on the right side of the label.
 * The image is drawn on the left at its natural aspect ratio.
 * The remaining space is allocated for text.
 * In two-line mode, the top text is drawn so that its top edge touches the top of the label,
 * and the bottom text is drawn so that its bottom edge touches the bottom of the label.
 * Logs are added to output dimensions in millimeters.
 */
export async function generateLabel(options: GenerateLabelOptions): Promise<string | null> {
  const {
    standardImgUrl,
    topText,
    bottomText,
    labelWidthMm,
    labelHeightMm,
    showImage,
    showQrCode = false,
    qrCodeContent = '',
  } = options

  await ensureFontsLoaded()
  logger.debug('Loading image from:', standardImgUrl)
  const standardImg = await loadImage(standardImgUrl)
  logger.debug('Image loaded:', standardImg ? 'success' : 'failed')

  const dimensions = calculateCanvasDimensions(labelWidthMm, labelHeightMm)
  const textDimensions = calculateTextDimensions(
    labelHeightMm,
    showImage,
    standardImg,
    dimensions.conversionFactor
  )

  const ctx = createCanvas(dimensions)
  if (!ctx) return null

  const qrDimensions = await drawQrCode(ctx, showQrCode, qrCodeContent, labelHeightMm, dimensions)

  // Calculate available width for image and text
  const gapBetweenTextAndQrMm = qrDimensions.qrCodeWidth > 0 ? 1 : 0
  const gapBetweenTextAndQrPx = mmToPx(gapBetweenTextAndQrMm)
  const availableWidthForImageAndText =
    qrDimensions.qrCodeWidth > 0
      ? qrDimensions.qrCodeX - gapBetweenTextAndQrPx
      : dimensions.printableWidthPx

  // Draw image on the left if enabled
  const imageUsedWidth = drawImageIfNeeded(
    ctx,
    standardImg,
    availableWidthForImageAndText,
    dimensions.printableHeightPx,
    textDimensions.gapPx,
    showImage
  )
  const imageUsedWidthMm = imageUsedWidth / dimensions.conversionFactor
  logger.debug(`Image used width (mm): ${imageUsedWidthMm.toFixed(2)}`)

  // Calculate text area dimensions
  const textAreaX = imageUsedWidth
  const textAreaWidth = availableWidthForImageAndText - textAreaX
  logger.debug(`Text area starts at (mm): ${(textAreaX / dimensions.conversionFactor).toFixed(2)}`)
  logger.debug(`Text area width (mm): ${(textAreaWidth / dimensions.conversionFactor).toFixed(2)}`)

  // Set text color and baseline
  ctx.fillStyle = 'black'
  ctx.textBaseline = 'alphabetic'

  // Determine if single-line mode should be used
  let forceSingleLine = bottomText.trim() === ''
  if (!forceSingleLine) {
    const minGapBetweenTextsMm = 1
    const minSpaceNeeded = textDimensions.adjustedTextHeightMm * 2 + minGapBetweenTextsMm
    if (minSpaceNeeded > dimensions.printableHeightMm) {
      logger.debug(
        `Two-line text would overlap (needs ${minSpaceNeeded.toFixed(2)}mm, have ${dimensions.printableHeightMm.toFixed(2)}mm). Switching to single-line mode.`
      )
      forceSingleLine = true
    }
  }

  // Draw text
  if (forceSingleLine) {
    drawSingleLineText({
      ctx,
      topText,
      bottomText,
      textAreaX,
      textAreaWidth,
      desiredTextHeight: textDimensions.desiredTextHeight,
      printableHeightPx: dimensions.printableHeightPx,
      conversionFactor: dimensions.conversionFactor,
    })
  } else {
    drawTwoLineText({
      ctx,
      topText,
      bottomText,
      textAreaX,
      textAreaWidth,
      desiredTextHeight: textDimensions.desiredTextHeight,
      printableHeightPx: dimensions.printableHeightPx,
      conversionFactor: dimensions.conversionFactor,
    })
  }

  logger.debug(
    `Exported PNG dimensions (mm): width=${dimensions.printableWidthMm.toFixed(2)}mm, height=${dimensions.printableHeightMm.toFixed(2)}mm`
  )

  // Return the PNG data URL
  try {
    const dataUrl = ctx.canvas.toDataURL('image/png')
    logger.debug('Successfully generated data URL')
    return dataUrl
  } catch (error) {
    logger.error('Error generating data URL:', error)
    return null
  }
}
