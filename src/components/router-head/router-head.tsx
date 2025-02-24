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
      {/* Dynamiczny tytuł – domyślna wartość, jeśli nie nadpisana */}
      <title>
        {head.title ||
          "Gridfinity Label Generator - Design Custom Storage Labels Online"}
      </title>

      {/* Kanoniczny link na podstawie bieżącego URL */}
      <link rel="canonical" href={loc.url.href} />

      {/* Domyślne meta tagi */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Create custom Gridfinity labels for your storage system online. Free browser-based generator with text, icons, and printer support. No installation needed. Design labels now."
      />

      {/* Favicon – warto ustalić jednolitą ikonę */}
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

      {/* Renderowanie dodatkowych meta tagów, linków, stylów i skryptów, jeśli zostały dodane dynamicznie */}
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
    </>
  );
});
