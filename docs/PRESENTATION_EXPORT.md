# Private editable presentation export

`export_deliverable` and the existing report download menu now accept `pptx`.
The saved current-version report is the source. No model call rewrites it and no
remote content is fetched. The Workers-compatible writer uses native editable
PresentationML text, a 16:9 layout, section headings and bounded pagination.
Sources are included in the slides and the original text in package metadata.

The existing document path keeps workspace isolation, source version checks,
private R2 storage, byte-based storage metering, audit records and deterministic
same-workspace deduplication. Exports exceeding 40 slides fail explicitly rather
than silently dropping content. No new dependency, service or migration.

This is a text presentation export. Markdown tables remain editable text;
it does not generate charts, render slides on the server, edit uploaded decks,
evaluate formulas or guarantee font availability in a recipient's Office app.
Unicode is preserved; RTL paragraphs carry alignment/direction. Wide scripts
wrap conservatively, with the final font renderer controlled by the recipient.

Automated checks cover native package identification, relationship resolution,
text escaping, multilingual content, source retention, pagination, size limits,
current source version, tenant access, private storage and deduplication.
Independent package integrity and layout inspection of a fixture are additional
local checks, not proof of operation in Microsoft PowerPoint or Google Slides.
