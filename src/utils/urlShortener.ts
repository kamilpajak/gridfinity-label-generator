import isURL from 'validator/lib/isURL'
import { logger } from '~/config/logging'

// Test function to directly verify URL shortening functionality
// This can be called from the browser console: window.testUrlShortening("example.com/very/long/path")
;(globalThis as any).testUrlShortening = async (url: string) => {
  logger.group('URL Shortening Test')
  logger.log('Testing URL:', url)

  // Check if protocol needs to be added
  const hasProtocol = url.match(/^https?:\/\//)
  const urlWithProtocol = hasProtocol ? url : `https://${url}`

  if (!hasProtocol) {
    logger.log('Protocol added:', urlWithProtocol)
  }

  logger.log('Is valid URL:', isValidUrl(url))
  logger.log('Should shorten:', shouldShortenUrl(url))

  let result: string | null
  if (shouldShortenUrl(url)) {
    try {
      const shortened = await shortenUrl(url)
      logger.log('Original URL:', url)
      logger.log('URL with protocol:', urlWithProtocol)
      logger.log('Shortened URL:', shortened)
      logger.log('Shortening successful:', shortened !== urlWithProtocol)
      result = shortened
    } catch (error) {
      logger.error('Error during test:', error)
      result = null
    }
  } else {
    logger.log('URL does not meet criteria for shortening')
    result = null
  }
  logger.groupEnd()
  return result
}

/**
 * Checks if the provided text is a valid URL.
 * Uses validator.js library for validation.
 * Automatically adds https:// protocol if missing.
 */
export function isValidUrl(text: string): boolean {
  // If URL already has a protocol, validate it as is
  if (text.match(/^https?:\/\//)) {
    const isValid = isURL(text, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
    })
    logger.debug(`URL validation check: "${text}" is ${isValid ? 'valid' : 'invalid'}`)
    return isValid
  }

  // If URL doesn't have a protocol, add https:// and validate
  const urlWithProtocol = `https://${text}`
  const isValid = isURL(urlWithProtocol, {
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true,
  })

  logger.debug(`URL validation check: "${text}" is ${isValid ? 'valid with https://' : 'invalid'}`)
  return isValid
}

/**
 * Determines if a URL should be shortened based on its length.
 * Works with URLs with or without protocol.
 */
export function shouldShortenUrl(url: string): boolean {
  // For length check, consider the URL without protocol to be fair
  const urlWithoutProtocol = url.replace(/^https?:\/\//, '')
  const effectiveLength = urlWithoutProtocol.length

  const shouldShorten = isValidUrl(url) && effectiveLength > 28
  if (isValidUrl(url)) {
    logger.debug(
      `URL length check: ${effectiveLength} characters (without protocol), ${shouldShorten ? 'should be shortened' : 'no need to shorten'}`
    )
  }
  return shouldShorten
}

/**
 * Shortens a URL using the TinyURL API.
 * Returns the original URL in case of an error.
 * Automatically adds https:// protocol if missing.
 */
export async function shortenUrl(url: string): Promise<string> {
  // Add protocol if missing
  const urlToShorten = url.match(/^https?:\/\//) ? url : `https://${url}`

  logger.debug(`Attempting to shorten URL: ${urlToShorten}`)

  if (!isValidUrl(url)) {
    logger.debug(`Not a valid URL, returning original: ${url}`)
    return url // Return original text if not a valid URL
  }

  try {
    logger.debug(`Calling TinyURL API for: ${urlToShorten}`)
    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(urlToShorten)}`
    )

    if (!response.ok) {
      throw new Error(`URL shortening failed with status: ${response.status}`)
    }

    const shortUrl = await response.text()
    logger.debug(`URL shortened successfully: ${urlToShorten} → ${shortUrl}`)
    return shortUrl
  } catch (error) {
    logger.error('Error shortening URL:', error)
    return url // Return original URL in case of error
  }
}
