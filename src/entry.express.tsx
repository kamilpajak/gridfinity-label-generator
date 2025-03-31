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
import {createServer as createHttpServer} from "node:http";
import {createServer as createHttpsServer} from "node:https";
import {readFileSync} from "node:fs";

declare global {
  interface QwikCityPlatform extends PlatformNode {}
}

// Directories where the static assets are located
const distDir = join(fileURLToPath(import.meta.url), "..", "..", "dist");
const buildDir = join(distDir, "build");

// Allow for dynamic port
const HTTP_PORT = process.env.HTTP_PORT ?? 80;
const HTTPS_PORT = process.env.HTTPS_PORT ?? 443;

// SSL Configuration
const useHttps = process.env.NODE_ENV === "production";
let httpsOptions = {};

if (useHttps) {
  try {
    httpsOptions = {
      key: readFileSync("/etc/ssl/gridfinitylabels.com/private.key"),
      cert: readFileSync("/etc/ssl/gridfinitylabels.com/certificate.pem"),
    };
    console.log("SSL certificates loaded successfully");
  } catch (error) {
    console.error("Cannot load SSL certificates:", error);
    // Continue without HTTPS if certificates cannot be loaded
  }
}

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

// Middleware to handle Cloudflare headers
app.use((req, res, next) => {
  // Check for Cloudflare headers
  const cfVisitor = req.headers["cf-visitor"]
    ? JSON.parse(req.headers["cf-visitor"] as string)
    : {};
  const isCloudflareHTTPS = cfVisitor.scheme === "https";
  const xForwardedProto = req.headers["x-forwarded-proto"];

  // Skip redirect for localhost or if already using HTTPS or if Cloudflare is handling HTTPS
  const host = req.headers.host || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");

  // Only redirect if:
  // 1. In production
  // 2. Not localhost
  // 3. Not already secure
  // 4. Not coming from Cloudflare HTTPS
  if (
    process.env.NODE_ENV === "production" &&
    !isLocalhost &&
    !req.secure &&
    xForwardedProto !== "https" &&
    !isCloudflareHTTPS
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Middleware to add security headers
app.use((req, res, next) => {
  // Protection against XSS
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://statistics.gridfinitylabels.com https://*.sharethis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://cdn.buymeacoffee.com https://*.sharethis.com; connect-src 'self' https://*.sharethis.com https://tinyurl.com https://statistics.gridfinitylabels.com",
  );

  // Protection against clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Protection against MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Additional security headers
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

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

// Start the server(s)
if (useHttps && Object.keys(httpsOptions).length > 0) {
  // Create HTTPS server
  const httpsServer = createHttpsServer(httpsOptions, app);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS Server started: https://localhost:${HTTPS_PORT}/`);
  });

  // Create HTTP server that redirects to HTTPS
  const httpServer = createHttpServer((req, res) => {
    const host = req.headers.host || "localhost";
    res.writeHead(301, { Location: `https://${host}${req.url}` });
    res.end();
  });

  httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Server redirecting to HTTPS on port ${HTTP_PORT}`);
  });
} else {
  // Fallback to HTTP only if HTTPS is not configured
  app.listen(HTTP_PORT, () => {
    console.log(`Server started: http://localhost:${HTTP_PORT}/`);
  });
}
