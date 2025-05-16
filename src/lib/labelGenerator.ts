import { computeDynamicFontSize, mmToPx } from '~/utils/measurements'
import { shortenUrl, shouldShortenUrl } from '~/utils/urlShortener'

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
      console.warn('Fonts not fully loaded, waiting for fonts ready event')
      await document.fonts.ready

      // Double-check after fonts.ready
      if (
        !document.fonts.check('900 16px "Noto Sans"') ||
        !document.fonts.check('700 16px "Oswald"')
      ) {
        console.warn('Fonts still not available after fonts.ready, using fallbacks')
      }
    }
  } catch (error) {
    console.error('Failed to load fonts:', error)
    // Wait for fonts ready as fallback
    try {
      await document.fonts.ready
    } catch (readyError) {
      console.error('Failed to wait for fonts.ready:', readyError)
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
  selectedScrewSubtype?: string
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
  const img = new Image()
  img.crossOrigin = 'anonymous'

  try {
    await new Promise<void>(resolve => {
      img.onload = () => resolve()
      img.onerror = () => {
        console.warn(`Failed to load image with original extension: ${url}`)
        resolve()
      }
      img.src = url
    })

    if (img.complete && img.naturalWidth > 0) {
      return img
    }

    if (url.toLowerCase().endsWith('.svg')) {
      const jpgUrl = url.replace(/\.svg$/i, '.jpg')
      const jpgImg = new Image()
      jpgImg.crossOrigin = 'anonymous'

      await new Promise<void>(resolve => {
        jpgImg.onload = () => resolve()
        jpgImg.onerror = () => {
          console.error(`Failed to load both SVG and JPG: ${url}`)
          resolve()
        }
        jpgImg.src = jpgUrl
      })

      if (jpgImg.complete && jpgImg.naturalWidth > 0) {
        return jpgImg
      }
    }
    return null
  } catch (error) {
    console.error('Error loading image:', error)
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
 * Generates a label image as a PNG DataURL.
 * The QR code has highest priority and is positioned on the right side of the label.
 * The image is drawn on the left at its natural aspect ratio.
 * The remaining space is allocated for text.
 * In two-line mode, the top text is drawn so that its top edge touches the top of the label,
 * and the bottom text is drawn so that its bottom edge touches the bottom of the label.
 * Logs are added to output dimensions in millimeters.
 */
export async function generateLabel(
  standardImgUrl: string,
  topText: string,
  bottomText: string,
  labelWidthMm: number,
  labelHeightMm: number,
  showImage: boolean,
  showQrCode: boolean = false,
  qrCodeContent: string = '',
  textSizePercent: number = 100
): Promise<string | null> {
  await ensureFontsLoaded()
  const standardImg = await loadImage(standardImgUrl)
  // Calculate printable area width (tape width - 4mm margins)
  const printableWidthMm = labelWidthMm - 4

  // Calculate printable height (total height - 2mm margins)
  const printableHeightMm = labelHeightMm - 2

  // Calculate the exact aspect ratio of the printable area
  const exactAspectRatio = printableWidthMm / printableHeightMm

  console.log(`Label size (mm): ${labelWidthMm} × ${labelHeightMm}`)
  console.log(`Printable area (mm): ${printableWidthMm} × ${printableHeightMm}`)
  console.log(`Exact aspect ratio: ${exactAspectRatio.toFixed(6)}`)

  // Convert printable height from mm to pixels
  const printableHeightPx = Math.round(mmToPx(printableHeightMm))

  // Calculate width in pixels based on the exact aspect ratio
  const printableWidthPx = Math.round(printableHeightPx * exactAspectRatio)

  // Calculate the actual conversion factor used
  const conversionFactor = printableWidthPx / printableWidthMm

  console.log(`Conversion factor: ${conversionFactor.toFixed(6)} px/mm`)
  console.log(`Canvas dimensions (px): ${printableWidthPx} × ${printableHeightPx}`)
  console.log(`Canvas aspect ratio: ${(printableWidthPx / printableHeightPx).toFixed(6)}`)

  // Baseline text height and gap in mm
  const baseTextHeightMm = 4.5
  // Apply the text size percentage
  const adjustedTextHeightMm = baseTextHeightMm * (textSizePercent / 100)
  const baselineGap = 2
  console.log(`Base text height (mm): ${baseTextHeightMm}`)
  console.log(`Adjusted text height (mm): ${adjustedTextHeightMm.toFixed(2)}`)
  console.log(`Text size percentage: ${textSizePercent}%`)
  console.log(`Baseline gap (mm): ${baselineGap}`)

  // Compute gap in pixels (only if image is to be shown)
  const gapPx = showImage && standardImg ? mmToPx(baselineGap) : 0
  console.log(`Computed gap (mm): ${(gapPx / conversionFactor).toFixed(2)}`)

  // Create canvas and fill background with white
  const canvas = document.createElement('canvas')
  canvas.width = printableWidthPx
  canvas.height = printableHeightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('Could not get canvas context.')
    return null
  }
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, printableWidthPx, printableHeightPx)

  // QR code has highest priority - position it first if enabled
  let qrCodeWidth = 0
  let qrCodeX = 0
  if (showQrCode && qrCodeContent) {
    try {
      // QR code size: 10mm x 10mm
      const qrSizeMm = 10
      const qrSizePx = mmToPx(qrSizeMm)
      qrCodeWidth = qrSizePx

      // Position QR code on the right side of the printable area
      qrCodeX = printableWidthPx - qrSizePx
      const qrY = (printableHeightPx - qrSizePx) / 2 // Centered vertically

      // Shorten URL if necessary for better QR code readability
      let finalQrContent = qrCodeContent
      if (shouldShortenUrl(qrCodeContent)) {
        try {
          finalQrContent = await shortenUrl(qrCodeContent)
          console.log(`URL shortened: ${qrCodeContent} → ${finalQrContent}`)
        } catch (error) {
          console.error('Error shortening URL:', error)
        }
      }

      // Generate QR code using the qrcode library
      const QRCode = await import('qrcode')
      const qrDataUrl = await QRCode.default.toDataURL(finalQrContent, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: qrSizePx,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })

      // Load the QR code as an image
      const qrImg = new Image()
      await new Promise<void>(resolve => {
        qrImg.onload = () => resolve()
        qrImg.onerror = () => {
          console.error('Failed to load QR code image')
          resolve()
        }
        qrImg.src = qrDataUrl
      })

      // Draw the QR code on the label
      if (qrImg.complete && qrImg.naturalWidth > 0) {
        ctx.drawImage(qrImg, qrCodeX, qrY, qrSizePx, qrSizePx)
      }

      console.log(
        `QR code positioned at x=${(qrCodeX / conversionFactor).toFixed(2)}mm, width=${qrSizeMm}mm`
      )
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  // Calculate available width for image and text (with 1mm gap between text and QR code)
  const gapBetweenTextAndQrMm = qrCodeWidth > 0 ? 1 : 0 // 1mm gap if QR code is present
  const gapBetweenTextAndQrPx = mmToPx(gapBetweenTextAndQrMm)
  const availableWidthForImageAndText =
    qrCodeWidth > 0 ? qrCodeX - gapBetweenTextAndQrPx : printableWidthPx

  // Draw image on the left if enabled
  const imageUsedWidth = drawImageIfNeeded(
    ctx,
    standardImg,
    availableWidthForImageAndText, // Only use width up to QR code
    printableHeightPx,
    gapPx,
    showImage
  )
  const imageUsedWidthMm = imageUsedWidth / conversionFactor
  console.log(`Image used width (mm): ${imageUsedWidthMm.toFixed(2)}`)

  // Calculate text area dimensions
  const textAreaX = imageUsedWidth
  const textAreaWidth = availableWidthForImageAndText - textAreaX
  console.log(`Text area starts at (mm): ${(textAreaX / conversionFactor).toFixed(2)}`)
  console.log(`Text area width (mm): ${(textAreaWidth / conversionFactor).toFixed(2)}`)

  // Set text color and baseline
  ctx.fillStyle = 'black'
  ctx.textBaseline = 'alphabetic'

  const desiredTextHeight = mmToPx(adjustedTextHeightMm)
  const isSingleLine = bottomText.trim() === ''

  if (isSingleLine) {
    // Single-line mode: center text vertically
    const { fontSize, metrics } = measureAndScaleText(
      ctx,
      topText,
      desiredTextHeight,
      'Noto Sans',
      '900',
      textAreaWidth
    )
    ctx.font = `900 ${fontSize}px "Noto Sans", serif`
    const textX = textAreaX + (textAreaWidth - metrics.width) / 2
    // Compute vertical center using "alphabetic" baseline.
    const textY =
      (labelHeightPx + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
    ctx.fillText(topText, textX, textY)
    console.log(
      `Single-line text dimensions (mm): width=${(metrics.width / conversionFactor).toFixed(2)}`
    )
  } else {
    // Two-line mode: align top text to top edge and bottom text to bottom edge.
    // For top text: use "alphabetic" baseline and adjust Y so that actualBoundingBoxAscent equals 0.
    const topResult = measureAndScaleText(
      ctx,
      topText,
      desiredTextHeight,
      'Noto Sans',
      '900',
      textAreaWidth
    )
    ctx.font = `900 ${topResult.fontSize}px "Noto Sans", serif`
    const topX = textAreaX + (textAreaWidth - topResult.metrics.width) / 2
    // Draw top text so that its top edge touches y = 0.
    // Using "alphabetic" baseline, the top edge is at y = actualBoundingBoxAscent.
    const topY = topResult.metrics.actualBoundingBoxAscent
    ctx.fillText(topText, topX, topY)
    console.log(
      `Top text dimensions (mm): width=${(topResult.metrics.width / conversionFactor).toFixed(2)}`
    )

    // For bottom text: use "alphabetic" baseline and adjust Y so that bottom edge touches y = labelHeightPx.
    const bottomResult = measureAndScaleText(
      ctx,
      bottomText,
      desiredTextHeight,
      'Oswald',
      '700',
      textAreaWidth
    )
    ctx.font = `700 ${bottomResult.fontSize}px "Oswald", sans-serif`
    const bottomX = textAreaX + (textAreaWidth - bottomResult.metrics.width) / 2
    // Bottom edge should touch the bottom, so we position at:
    // y = labelHeightPx - actualBoundingBoxDescent
    const bottomY = labelHeightPx - bottomResult.metrics.actualBoundingBoxDescent
    ctx.fillText(bottomText, bottomX, bottomY)
    console.log(
      `Bottom text dimensions (mm): width=${(bottomResult.metrics.width / conversionFactor).toFixed(2)}`
    )
  }

  // Log final exported PNG dimensions in mm.
  console.log(
    `Exported PNG dimensions (mm): width=${labelWidthMm.toFixed(2)}mm, height=${labelHeightMm.toFixed(2)}mm`
  )

  return canvas.toDataURL('image/png')
}
