import assert from "node:assert/strict";
import test from "node:test";
import { FILE_POLICY, OFFICE_MIME_TYPES, declaredTypeMatches, detectFileType } from "../lib/file-policy.mjs";
import { parseOfficePreview } from "../lib/office-preview.mjs";
import { readOfficeZipDirectory } from "../lib/office-archive.mjs";

const encoder = new TextEncoder();
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}
const limits = { maxEntries: FILE_POLICY.officeMaxArchiveEntries, maxExpandedBytes: FILE_POLICY.officeMaxExpandedBytes, maxRatio: FILE_POLICY.officeMaxCompressionRatio, maxXmlPartBytes: FILE_POLICY.officeMaxXmlPartBytes, maxXmlNodes: FILE_POLICY.officeMaxXmlNodes, maxDocxBlocks: FILE_POLICY.officeMaxDocxBlocks, maxSheets: FILE_POLICY.officeMaxSheets, maxPreviewRowsPerSheet: FILE_POLICY.officeMaxPreviewRowsPerSheet, maxPreviewColumnsPerSheet: FILE_POLICY.officeMaxPreviewColumnsPerSheet, maxSlides: FILE_POLICY.officeMaxSlides };

function zip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const filename = encoder.encode(name);
    const body = typeof content === "string" ? encoder.encode(content) : content;
    const checksum = crc32(body);
    const local = new Uint8Array(30 + filename.length + body.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true); localView.setUint32(18, body.length, true); localView.setUint32(22, body.length, true); localView.setUint16(26, filename.length, true);
    local.set(filename, 30); local.set(body, 30 + filename.length);
    localParts.push(local);
    const central = new Uint8Array(46 + filename.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, body.length, true); centralView.setUint32(24, body.length, true); centralView.setUint16(28, filename.length, true); centralView.setUint32(42, offset, true);
    central.set(filename, 46); centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) { output.set(part, cursor); cursor += part.length; }
  return output;
}

const docxFixture = () => zip([
  ["[Content_Types].xml", "<Types/>"] ,
  ["word/document.xml", "<w:document xmlns:w=\"w\"><w:body><w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>Offre &amp; prix</w:t></w:r></w:p><w:p><w:r><w:t>Texte lisible</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cellule</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"]
]);

const xlsxFixture = () => zip([
  ["[Content_Types].xml", "<Types/>"] ,
  ["xl/workbook.xml", "<workbook xmlns:r=\"r\"><sheets><sheet name=\"Données\" sheetId=\"1\" r:id=\"rId1\"/><sheet name=\"Archive\" sheetId=\"2\" state=\"veryHidden\" r:id=\"rId2\"/></sheets></workbook>"] ,
  ["xl/_rels/workbook.xml.rels", "<Relationships><Relationship Id=\"rId1\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Target=\"worksheets/sheet2.xml\"/></Relationships>"] ,
  ["xl/sharedStrings.xml", "<sst><si><t>Chiffre</t></si></sst>"] ,
  ["xl/worksheets/sheet1.xml", "<worksheet><sheetData><row r=\"1\"><c r=\"A1\" t=\"s\"><v>0</v></c><c r=\"B1\"><f>2+3</f><v>5</v></c></row></sheetData></worksheet>"] ,
  ["xl/worksheets/sheet2.xml", "<worksheet><sheetData><row r=\"1\"><c r=\"A1\"><v>99</v></c></row></sheetData></worksheet>"]
]);

const pptxFixture = () => zip([
  ["[Content_Types].xml", "<Types/>"] ,
  ["ppt/presentation.xml", "<p:presentation xmlns:p=\"p\" xmlns:r=\"r\"><p:sldIdLst><p:sldId id=\"1\" r:id=\"rId1\"/></p:sldIdLst></p:presentation>"] ,
  ["ppt/_rels/presentation.xml.rels", "<Relationships><Relationship Id=\"rId1\" Target=\"slides/slide1.xml\"/></Relationships>"] ,
  ["ppt/slides/slide1.xml", "<p:sld xmlns:p=\"p\" xmlns:a=\"a\"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Résultats du trimestre</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>Hausse de 12 %</a:t></a:r></a:p></p:txBody></p:sp><p:pic/></p:spTree></p:cSld></p:sld>"]
]);

test("office preview policy centralizes archive and reader limits", () => {
  assert.equal(FILE_POLICY.officeMaxExpandedBytes, 200 * 1024 * 1024);
  assert.equal(FILE_POLICY.officeMaxCompressionRatio, 100);
  assert.equal(FILE_POLICY.officeMaxArchiveEntries, 5_000);
  assert.equal(FILE_POLICY.officeMaxSheets, 20);
  assert.equal(FILE_POLICY.officeMaxPreviewRowsPerSheet, 2_000);
  assert.equal(FILE_POLICY.officeMaxPreviewColumnsPerSheet, 100);
  assert.equal(FILE_POLICY.officeMaxSlides, 50);
  assert.equal(FILE_POLICY.officeMaxProcessingMs, 30_000);
  assert.equal(FILE_POLICY.extractMaxRowsPerSheet, 1_000);
  assert.equal(FILE_POLICY.extractMaxColsPerSheet, 50);
});

test("Office types are detected from OOXML package paths and require a matching declaration", () => {
  for (const [bytes, mime] of [[docxFixture(), OFFICE_MIME_TYPES.docx], [xlsxFixture(), OFFICE_MIME_TYPES.xlsx], [pptxFixture(), OFFICE_MIME_TYPES.pptx]]) {
    assert.equal(detectFileType(bytes), mime);
    assert.equal(declaredTypeMatches(mime, mime), true);
    assert.equal(declaredTypeMatches(OFFICE_MIME_TYPES.docx, mime), mime === OFFICE_MIME_TYPES.docx);
  }
  assert.equal(detectFileType(zip([["notes.txt", "ordinary archive"]])), null);
});

test("DOCX renders text, headings and tables as structured content without HTML interpretation", async () => {
  const result = await parseOfficePreview(docxFixture(), OFFICE_MIME_TYPES.docx);
  assert.equal(result.kind, "docx");
  assert.deepEqual(result.blocks.map(block => block.type), ["heading", "paragraph", "table"]);
  assert.equal(result.blocks[0].text, "Offre & prix");
  assert.deepEqual(result.blocks[2].rows, [["Cellule"]]);
});

test("XLSX tabs include hidden state, use cached formula values, and never evaluate formulas", async () => {
  const result = await parseOfficePreview(xlsxFixture(), OFFICE_MIME_TYPES.xlsx);
  assert.deepEqual(result.sheets.map(sheet => [sheet.name, sheet.hidden]), [["Données", false], ["Archive", true]]);
  assert.deepEqual(result.sheets[0].rows[0].cells, ["Chiffre", "5"]);
});

test("PPTX shows ordered slide text without including notes", async () => {
  const result = await parseOfficePreview(pptxFixture(), OFFICE_MIME_TYPES.pptx);
  assert.equal(result.slides.length, 1);
  assert.equal(result.slides[0].title, "Résultats du trimestre");
  assert.deepEqual(result.slides[0].paragraphs, ["Résultats du trimestre", "Hausse de 12 %"]);
  assert.equal(result.slides[0].hasImages, true);
});

test("archive path traversal and nested archives are rejected before extraction", () => {
  for (const name of ["../escape.xml", "word/../escape.xml", "word/embeddings/archive.zip"]) {
    assert.throws(() => readOfficeZipDirectory(zip([[name, "x"]]), limits), /FILE_REJECTED_SECURITY/u);
  }
  assert.throws(() => readOfficeZipDirectory(zip([["x.xml", "x"]]), { ...limits, maxRatio: 0.5 }), /FILE_REJECTED_SECURITY/u);
  assert.throws(() => readOfficeZipDirectory(zip([["x.xml", "x"], ["y.xml", "y"]]), { ...limits, maxEntries: 1 }), /FILE_REJECTED_SECURITY/u);
});

test("XML entities are decoded while DTD and external entity declarations are rejected", async () => {
  const bytes = zip([["[Content_Types].xml", "<Types/>"] , ["word/document.xml", "<!DOCTYPE w:document [<!ENTITY x SYSTEM 'https://example.invalid/'>]><w:document><w:body><w:p><w:r><w:t>&x;</w:t></w:r></w:p></w:body></w:document>"]]);
  await assert.rejects(parseOfficePreview(bytes, OFFICE_MIME_TYPES.docx), /FILE_REJECTED_SECURITY/u);
});

test("corrupt Office archives fail with a stable corruption code", async () => {
  await assert.rejects(parseOfficePreview(encoder.encode("not a zip"), OFFICE_MIME_TYPES.docx), /FILE_CORRUPT/u);
  const bytes = docxFixture().slice(0, -4);
  await assert.rejects(parseOfficePreview(bytes, OFFICE_MIME_TYPES.docx), /FILE_CORRUPT/u);
});
