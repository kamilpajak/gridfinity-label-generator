/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the Express HTTP server when building for production.
 *
 * Learn more about Node.js server integrations here:
 * - https://qwik.dev/docs/deployments/node/
 *
 */
import {createQwikCity, type PlatformNode,} from "@builder.io/qwik-city/middleware/node";
import "dotenv/config";
import qwikCityPlan from "@qwik-city-plan";
import {manifest} from "@qwik-client-manifest";
import render from "./entry.ssr";
import express from "express";
import compression from "compression";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

declare global {
  interface QwikCityPlatform extends PlatformNode {}
}

// Directories where the static assets are located
const distDir = join(fileURLToPath(import.meta.url), "..", "..", "dist");
const buildDir = join(distDir, "build");

// Allow for dynamic port
const PORT = process.env.PORT ?? 3000;

// Create the Qwik City Node middleware
const { router, notFound } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
  // getOrigin(req) {
  //   // If deploying under a proxy, you may need to build the origin from the request headers
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Proto
  //   const protocol = req.headers["x-forwarded-proto"] ?? "http";
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host
  //   const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  //   return `${protocol}://${host}`;
  // }
});

// Create the express server
// https://expressjs.com/
const app = express();

// Middleware to redirect HTTP to HTTPS (only in production)
app.use((req, res, next) => {
  // Only redirect in production and when not already using HTTPS
  // Skip redirect for localhost (development environment)
  const host = req.headers.host || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  
  if (process.env.NODE_ENV === 'production' && !isLocalhost && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Middleware to add security headers
app.use((req, res, next) => {
  // Protection against XSS
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://scripts.simpleanalyticscdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://cdn.buymeacoffee.com; connect-src 'self'");
  
  // Protection against clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Protection against MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Additional security headers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
});

// Enable gzip compression
app.use(compression());

// Static asset handlers
// https://expressjs.com/en/starter/static-files.html
app.use(`/build`, express.static(buildDir, { immutable: true, maxAge: "1y" }));
app.use(express.static(distDir, { redirect: false }));

// Use Qwik City's page and endpoint request handler
app.use(router);

// Use Qwik City's 404 handler
app.use(notFound);

// Start the express server
app.listen(PORT, () => {
  /* eslint-disable */
  console.log(`Server started: http://localhost:${PORT}/`);
});
