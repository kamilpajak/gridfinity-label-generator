import {useDocumentHead, useLocation} from "@builder.io/qwik-city";
import {component$, useVisibleTask$} from "@builder.io/qwik";

/**
 * The global window._paq array for Matomo
 */
declare global {
  interface Window {
    _paq: any[];
  }
}

/**
 * RouterHead component renders dynamic meta tags, title, links, etc.
 * It is placed inside the document's <head> element.
 */
export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();

  // Initialize Matomo with SPA tracking
  useVisibleTask$(() => {
    // Initialize Matomo
    const _paq = window._paq = window._paq || [];
    _paq.push(['trackPageView']);
    _paq.push(['enableLinkTracking']);
    
    const u = "//statistics.gridfinitylabels.com/";
    _paq.push(['setTrackerUrl', u + 'matomo.php']);
    _paq.push(['setSiteId', '1']);
    
    // Add the tracking script
    const d = document;
    const g = d.createElement('script');
    const s = d.getElementsByTagName('script')[0];
    g.async = true;
    g.src = u + 'matomo.js';
    if (s && s.parentNode) {
      s.parentNode.insertBefore(g, s);
    } else {
      d.head.appendChild(g);
    }
    
    // Track SPA navigation - override history.pushState
    const originalPushState = history.pushState;
    // @ts-ignore - Ignore type mismatch for history.pushState override
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      _paq.push(['setCustomUrl', window.location.pathname]);
      _paq.push(['setDocumentTitle', document.title]);
      _paq.push(['trackPageView']);
    };
    
    // Handle popstate event (back/forward buttons)
    window.addEventListener('popstate', function() {
      _paq.push(['setCustomUrl', window.location.pathname]);
      _paq.push(['setDocumentTitle', document.title]);
      _paq.push(['trackPageView']);
    });
  });

  return (
    <>
      <title>
        {head.title ||
          "Gridfinity Label Generator - Print-Ready Storage Labels Online"}
      </title>
      <link rel="canonical" href={loc.url.href} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Create custom Gridfinity labels for your storage system online. Free browser-based generator with text, icons, and printer support. No installation needed. Design labels now."
      />
      <meta http-equiv="Content-Language" content="en" />
      <meta property="og:title" content="Gridfinity Label Generator - Print-Ready Storage Labels Online" />
      <meta property="og:description" content="Create custom Gridfinity labels for your storage system online. Free browser-based generator with text, icons, and printer support." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={loc.url.href} />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      {/* Use local fonts instead of Google Fonts */}
      <link rel="stylesheet" href="/fonts/fonts.css" />
      {head.meta.map((m) => (
        <meta key={m.key} {...m} />
      ))}
      {head.links.map((l) => (
        <link key={l.key} {...l} />
      ))}
      {head.styles.map((s) => (
        <style
          key={s.key}
          {...s.props}
          {...(s.props?.dangerouslySetInnerHTML
            ? {}
            : { dangerouslySetInnerHTML: s.style })}
        />
      ))}
      {head.scripts.map((s) => (
        <script
          key={s.key}
          {...s.props}
          {...(s.props?.dangerouslySetInnerHTML
            ? {}
            : { dangerouslySetInnerHTML: s.script })}
        />
      ))}
      <script 
        type="text/javascript" 
        src="https://platform-api.sharethis.com/js/sharethis.js#property=67d6a61cbc169300120859df&product=inline-share-buttons&source=platform" 
        async={true}
      ></script>
    </>
  );
});
