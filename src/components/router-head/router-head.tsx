import {useDocumentHead, useLocation} from "@builder.io/qwik-city";
import {component$} from "@builder.io/qwik";

/**
 * RouterHead component renders dynamic meta tags, title, links, etc.
 * It is placed inside the document's <head> element.
 */
export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();

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
