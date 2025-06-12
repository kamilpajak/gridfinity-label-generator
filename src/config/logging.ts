/**
 * Logging configuration for the application
 */

// Enable debug logs only in development
export const DEBUG = import.meta.env.DEV

// Create a no-op logger for production
const noop = () => {}

// Development logger that passes through to console
const devLogger = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
  group: console.group.bind(console),
  groupEnd: console.groupEnd.bind(console),
}

// Production logger that only allows errors and warnings
const prodLogger = {
  log: noop,
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: noop,
  debug: noop,
  group: noop,
  groupEnd: noop,
}

// Export the appropriate logger based on environment
export const logger = DEBUG ? devLogger : prodLogger
