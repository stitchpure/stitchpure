/**
 * Renders a JSON-LD structured-data block for search engines (rich results).
 *
 * The object is serialized on the server and emitted as a
 * <script type="application/ld+json"> tag. It is not user-visible.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is trusted, server-built content. We escape the closing
      // tag sequence to avoid breaking out of the script element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
