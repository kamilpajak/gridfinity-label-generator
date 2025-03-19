import isURL from 'validator/lib/isURL';

// Test function to directly verify URL shortening functionality
// This can be called from the browser console: window.testUrlShortening("example.com/very/long/path")
(globalThis as any).testUrlShortening = async (url: string) => {
  console.group('URL Shortening Test');
  console.log('Testing URL:', url);
  
  // Check if protocol needs to be added
  const hasProtocol = url.match(/^https?:\/\//);
  const urlWithProtocol = hasProtocol ? url : `https://${url}`;
  
  if (!hasProtocol) {
    console.log('Protocol added:', urlWithProtocol);
  }
  
  console.log('Is valid URL:', isValidUrl(url));
  console.log('Should shorten:', shouldShortenUrl(url));
  
  if (shouldShortenUrl(url)) {
    try {
      const shortened = await shortenUrl(url);
      console.log('Original URL:', url);
      console.log('URL with protocol:', urlWithProtocol);
      console.log('Shortened URL:', shortened);
      console.log('Shortening successful:', shortened !== urlWithProtocol);
      return shortened;
    } catch (error) {
      console.error('Error during test:', error);
      return null;
    }
  } else {
    console.log('URL does not meet criteria for shortening');
    return null;
  }
  console.groupEnd();
};

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
      require_valid_protocol: true
    });
    console.log(`URL validation check: "${text}" is ${isValid ? 'valid' : 'invalid'}`);
    return isValid;
  }
  
  // If URL doesn't have a protocol, add https:// and validate
  const urlWithProtocol = `https://${text}`;
  const isValid = isURL(urlWithProtocol, {
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true
  });
  
  console.log(`URL validation check: "${text}" is ${isValid ? 'valid with https://' : 'invalid'}`);
  return isValid;
}

/**
 * Determines if a URL should be shortened based on its length.
 * Works with URLs with or without protocol.
 */
export function shouldShortenUrl(url: string): boolean {
  // For length check, consider the URL without protocol to be fair
  const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
  const effectiveLength = urlWithoutProtocol.length;
  
  const shouldShorten = isValidUrl(url) && effectiveLength > 30;
  if (isValidUrl(url)) {
    console.log(`URL length check: ${effectiveLength} characters (without protocol), ${shouldShorten ? 'should be shortened' : 'no need to shorten'}`);
  }
  return shouldShorten;
}

/**
 * Shortens a URL using the TinyURL API.
 * Returns the original URL in case of an error.
 * Automatically adds https:// protocol if missing.
 */
export async function shortenUrl(url: string): Promise<string> {
  // Add protocol if missing
  const urlToShorten = url.match(/^https?:\/\//) ? url : `https://${url}`;
  
  console.log(`Attempting to shorten URL: ${urlToShorten}`);
  
  if (!isValidUrl(url)) {
    console.log(`Not a valid URL, returning original: ${url}`);
    return url; // Return original text if not a valid URL
  }
  
  try {
    console.log(`Calling TinyURL API for: ${urlToShorten}`);
    const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(urlToShorten)}`);
    
    if (!response.ok) {
      throw new Error(`URL shortening failed with status: ${response.status}`);
    }
    
    const shortUrl = await response.text();
    console.log(`URL shortened successfully: ${urlToShorten} → ${shortUrl}`);
    return shortUrl;
  } catch (error) {
    console.error('Error shortening URL:', error);
    return url; // Return original URL in case of error
  }
}
