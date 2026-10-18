import { FILE_POLICY, OFFICE_MIME_TYPES } from "./file-policy.mjs";
import { inflateOfficeEntry, readOfficeZipDirectory } from "./office-archive.mjs";

const officeLimits = () => ({
  maxEntries: FILE_POLICY.officeMaxArchiveEntries,
  maxExpandedBytes: FILE_POLICY.officeMaxExpandedBytes,
  maxRatio: FILE_POLICY.officeMaxCompressionRatio,
  maxXmlPartBytes: FILE_POLICY.officeMaxXmlPartBytes,
  maxXmlNodes: FILE_POLICY.officeMaxXmlNodes,
});

function localName(value) {
  const colon = value.indexOf(":");
  return colon < 0 ? value : value.slice(colon + 1);
}

function decodeXmlText(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (entity, code) => {
    if (code === "amp") return "&";
    if (code === "lt") return "<";
    if (code === "gt") return ">";
    if (code === "quot") return '"';
    if (code === "apos") return "'";
    const numeric = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0x10ffff || (numeric >= 0xd800 && numeric <= 0xdfff)) throw new Error("FILE_CORRUPT");
    return String.fromCodePoint(numeric);
  }).replace(/&[^;\s]+;/gu, () => { throw new Error("FILE_CORRUPT"); });
}

function parseAttributes(source) {
  const attrs = Object.create(null);
  let cursor = 0;
  while (cursor < source.length) {
    while (/\s/u.test(source[cursor] || "")) cursor++;
    if (cursor >= source.length) break;
    const nameMatch = /^[A-Za-z_][\w.:-]*/u.exec(source.slice(cursor));
    if (!nameMatch) throw new Error("FILE_CORRUPT");
    const rawName = nameMatch[0];
    const name = localName(rawName).toLowerCase();
    cursor += nameMatch[0].length;
    while (/\s/u.test(source[cursor] || "")) cursor++;
    if (source[cursor] !== "=") throw new Error("FILE_CORRUPT");
    cursor++;
    while (/\s/u.test(source[cursor] || "")) cursor++;
    const quote = source[cursor];
    if (quote !== '"' && quote !== "'") throw new Error("FILE_CORRUPT");
    const end = source.indexOf(quote, cursor + 1);
    if (end < 0) throw new Error("FILE_CORRUPT");
    if (!rawName.toLowerCase().startsWith("xmlns")) attrs[name] = decodeXmlText(source.slice(cursor + 1, end));
    cursor = end + 1;
  }
  return attrs;
}

function parseXml(xml, limits) {
  if (/<!\s*(?:DOCTYPE|ENTITY)/iu.test(xml)) throw new Error("FILE_REJECTED_SECURITY");
  const root = { name: "#document", attrs: Object.create(null), children: [] };
  const stack = [root];
  let index = 0;
  let nodeCount = 0;
  while (index < xml.length) {
    const lt = xml.indexOf("<", index);
    if (lt < 0) {
      if (index < xml.length) stack.at(-1).children.push(decodeXmlText(xml.slice(index)));
      break;
    }
    if (lt > index) stack.at(-1).children.push(decodeXmlText(xml.slice(index, lt)));
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      if (end < 0) throw new Error("FILE_CORRUPT");
      index = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      if (end < 0) throw new Error("FILE_CORRUPT");
      stack.at(-1).children.push(xml.slice(lt + 9, end));
      index = end + 3;
      continue;
    }
    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      if (end < 0) throw new Error("FILE_CORRUPT");
      index = end + 2;
      continue;
    }
    if (xml.startsWith("<!", lt)) throw new Error("FILE_REJECTED_SECURITY");
    let end = lt + 1;
    let quote = "";
    while (end < xml.length) {
      const character = xml[end];
      if (quote) { if (character === quote) quote = ""; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === ">") break;
      end++;
    }
    if (end >= xml.length) throw new Error("FILE_CORRUPT");
    const tag = xml.slice(lt + 1, end).trim();
    if (tag.startsWith("/")) {
      const name = localName(tag.slice(1).trim());
      if (stack.length <= 1 || stack.at(-1).name !== name) throw new Error("FILE_CORRUPT");
      stack.pop();
    } else {
      const selfClosing = tag.endsWith("/");
      const body = selfClosing ? tag.slice(0, -1).trimEnd() : tag;
      const nameMatch = /^[A-Za-z_][\w.:-]*/u.exec(body);
      if (!nameMatch) throw new Error("FILE_CORRUPT");
      const node = { name: localName(nameMatch[0]), attrs: parseAttributes(body.slice(nameMatch[0].length)), children: [] };
      stack.at(-1).children.push(node);
      nodeCount++;
      if (nodeCount > limits.remainingXmlNodes) throw new Error("FILE_TOO_LARGE");
      if (!selfClosing) stack.push(node);
    }
    index = end + 1;
  }
  if (stack.length !== 1) throw new Error("FILE_CORRUPT");
  limits.remainingXmlNodes -= nodeCount;
  return root;
}

function children(node, name) {
  return (node?.children || []).filter(child => typeof child !== "string" && child.name === name);
}

function first(node, name) {
  return children(node, name)[0] || null;
}

function descendants(node, name, output = []) {
  for (const child of node?.children || []) {
    if (typeof child === "string") continue;
    if (child.name === name) output.push(child);
    descendants(child, name, output);
  }
  return output;
}

function textContent(node) {
  if (!node) return "";
  let result = "";
  for (const child of node.children || []) result += typeof child === "string" ? child : textContent(child);
  return result;
}

function textRun(node) {
  if (!node) return "";
  let result = "";
  for (const child of node.children || []) {
    if (typeof child === "string") result += child;
    else if (child.name === "t") result += textContent(child);
    else if (child.name === "tab") result += "\t";
    else if (child.name === "br" || child.name === "cr") result += "\n";
    else result += textRun(child);
  }
  return result;
}

function decodeXml(bytes, limits) {
  let xml;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("FILE_CORRUPT"); }
  return parseXml(xml, limits);
}

function archiveIndex(bytes, limits) {
  const directory = readOfficeZipDirectory(bytes, limits);
  const entries = new Map(directory.entries.map(entry => [entry.name, entry]));
  return { directory, entries };
}

async function readPart(bytes, entries, name, limits, optional = false) {
  const entry = entries.get(name);
  if (!entry) {
    if (optional) return null;
    throw new Error("FILE_CORRUPT");
  }
  return decodeXml(await inflateOfficeEntry(bytes, entry, limits), limits);
}

function docxParagraph(node) {
  const style = first(first(node, "pPr"), "pStyle")?.attrs?.val || "";
  const numbering = !!first(node, "numPr");
  const text = textRun(node).trim();
  if (!text) return null;
  const heading = /^(?:Title|Subtitle|Heading[1-6])$/iu.test(style) || /^Titre[1-6]$/iu.test(style);
  const levelMatch = /(?:Heading|Titre)([1-6])/iu.exec(style);
  return { type: heading ? "heading" : numbering ? "list" : "paragraph", level: levelMatch ? Number(levelMatch[1]) : 1, text };
}

async function parseDocx(bytes, limits) {
  const { entries } = archiveIndex(bytes, limits);
  const document = await readPart(bytes, entries, "word/document.xml", limits);
  const body = first(descendants(document, "document")[0], "body");
  if (!body) throw new Error("FILE_CORRUPT");
  const blocks = [];
  let truncated = false;
  for (const item of body.children) {
    if (typeof item === "string") continue;
    if (item.name === "p") {
      const paragraph = docxParagraph(item);
      if (paragraph) blocks.push(paragraph);
    } else if (item.name === "tbl") {
      const allRows = children(item, "tr");
      const rows = allRows.slice(0, limits.maxDocxTableRows).map(row => children(row, "tc").slice(0, limits.maxDocxTableColumns).map(cell => descendants(cell, "p").map(textRun).join(" ").trim()));
      if (allRows.length > limits.maxDocxTableRows || allRows.some(sourceRow => children(sourceRow, "tc").length > limits.maxDocxTableColumns)) truncated = true;
      if (rows.some(row => row.some(Boolean))) blocks.push({ type: "table", rows });
    }
    if (blocks.length >= limits.maxDocxBlocks) { truncated = true; break; }
  }
  return { kind: "docx", blocks, simplified: true, truncated };
}

function resolveRelationshipTarget(baseDirectory, target) {
  if (!target || /^[a-z]+:/iu.test(target) || target.includes("\\") || target.includes("\u0000")) throw new Error("FILE_REJECTED_SECURITY");
  const segments = target.startsWith("/") ? [] : baseDirectory.split("/").filter(Boolean);
  const incoming = target.replace(/^\//u, "").split("/");
  for (const segment of incoming) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) throw new Error("FILE_REJECTED_SECURITY");
      segments.pop();
    } else segments.push(segment);
  }
  return segments.join("/");
}

async function readRelationships(bytes, entries, file, baseDirectory, limits) {
  const xml = await readPart(bytes, entries, file, limits);
  const map = new Map();
  for (const relation of descendants(xml, "Relationship")) {
    if ((relation.attrs?.targetmode || "").toLowerCase() === "external") continue;
    map.set(relation.attrs?.id || "", resolveRelationshipTarget(baseDirectory, relation.attrs?.target || ""));
  }
  return map;
}

function columnIndex(reference) {
  let value = 0;
  for (const character of reference.toUpperCase()) {
    const code = character.charCodeAt(0);
    if (code < 65 || code > 90) break;
    value = value * 26 + code - 64;
  }
  return value;
}

async function parseXlsx(bytes, limits) {
  const { entries } = archiveIndex(bytes, limits);
  const workbook = await readPart(bytes, entries, "xl/workbook.xml", limits);
  const relations = await readRelationships(bytes, entries, "xl/_rels/workbook.xml.rels", "xl", limits);
  const sharedXml = await readPart(bytes, entries, "xl/sharedStrings.xml", limits, true);
  const shared = sharedXml ? descendants(sharedXml, "si").map(textContent) : [];
  const declaredSheets = descendants(workbook, "sheet");
  if (declaredSheets.length === 0) throw new Error("FILE_CORRUPT");
  const sheets = [];
  const selectedSheets = declaredSheets.slice(0, limits.maxSheets);
  for (const sheet of selectedSheets) {
    const name = sheet.attrs?.name || `Feuille ${sheets.length + 1}`;
    const state = sheet.attrs?.state || "visible";
    const target = relations.get(sheet.attrs?.id || "");
    if (!target) throw new Error("FILE_CORRUPT");
    const xml = await readPart(bytes, entries, target, limits);
    const sheetData = first(descendants(xml, "worksheet")[0], "sheetData");
    const rawRows = children(sheetData, "row");
    const rows = [];
    let columnsTruncated = false;
    for (const row of rawRows.slice(0, limits.maxPreviewRowsPerSheet)) {
      const cells = Array(limits.maxPreviewColumnsPerSheet).fill("");
      for (const cell of children(row, "c")) {
        const index = columnIndex(cell.attrs?.r || "") - 1;
        if (index < 0) continue;
        if (index >= limits.maxPreviewColumnsPerSheet) { columnsTruncated = true; continue; }
        const type = cell.attrs?.t || "n";
        const value = textContent(first(cell, "v"));
        const inline = textContent(first(cell, "is"));
        const cellValue = type === "s" ? (shared[Number(value)] ?? "") : type === "inlineStr" ? inline : type === "b" ? (value === "1" ? "Vrai" : value === "0" ? "Faux" : value) : value;
        cells[index] = cellValue;
      }
      while (cells.length && cells.at(-1) === "") cells.pop();
      if (cells.length) rows.push({ number: Number(row.attrs?.r) || rows.length + 1, cells });
    }
    sheets.push({ name, hidden: state === "hidden" || state === "veryHidden", rows, truncated: rawRows.length > limits.maxPreviewRowsPerSheet || columnsTruncated });
  }
  const truncatedSheets = declaredSheets.length > limits.maxSheets;
  return { kind: "xlsx", sheets, truncated: truncatedSheets, truncatedSheets };
}

async function parsePptx(bytes, limits) {
  const { entries } = archiveIndex(bytes, limits);
  const presentation = await readPart(bytes, entries, "ppt/presentation.xml", limits);
  const relations = await readRelationships(bytes, entries, "ppt/_rels/presentation.xml.rels", "ppt", limits);
  const slideIds = descendants(presentation, "sldId");
  if (slideIds.length === 0) throw new Error("FILE_CORRUPT");
  const slides = [];
  for (const item of slideIds.slice(0, limits.maxSlides)) {
    const target = relations.get(item.attrs?.id || "");
    if (!target) throw new Error("FILE_CORRUPT");
    const xml = await readPart(bytes, entries, target, limits);
    const shapes = descendants(xml, "sp");
    const paragraphs = [];
    for (const shape of shapes) {
      const text = descendants(shape, "t").map(textContent).join("").trim();
      if (text) paragraphs.push(text);
    }
    slides.push({ number: slides.length + 1, title: paragraphs[0] || `Diapositive ${slides.length + 1}`, paragraphs, hasImages: descendants(xml, "pic").length > 0 });
  }
  const truncatedSlides = slideIds.length > limits.maxSlides;
  return { kind: "pptx", slides, truncated: truncatedSlides, truncatedSlides };
}

function capResultText(result, maxChars) {
  let remaining = maxChars;
  let truncated = false;
  const clip = value => {
    if (typeof value !== "string") return value;
    if (value.length <= remaining) { remaining -= value.length; return value; }
    const clipped = value.slice(0, Math.max(0, remaining));
    remaining = 0;
    truncated = true;
    return clipped;
  };
  if (result.kind === "docx") {
    for (const block of result.blocks) {
      if (block.type === "table") block.rows = block.rows.map(row => row.map(clip));
      else block.text = clip(block.text);
    }
  } else if (result.kind === "xlsx") {
    for (const sheet of result.sheets) for (const row of sheet.rows) row.cells = row.cells.map(clip);
  } else {
    for (const slide of result.slides) {
      slide.title = clip(slide.title);
      slide.paragraphs = slide.paragraphs.map(clip);
    }
  }
  result.truncated ||= truncated;
  if (truncated) result.truncatedByText = true;
  return result;
}

export async function parseOfficePreview(bytes, mime) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > FILE_POLICY.maxFileBytes) throw new Error("FILE_TOO_LARGE");
  const limits = { ...officeLimits(), remainingXmlNodes: FILE_POLICY.officeMaxXmlNodes, maxDocxBlocks: FILE_POLICY.officeMaxDocxBlocks,
    maxDocxTableRows: FILE_POLICY.officeMaxDocxTableRows, maxDocxTableColumns: FILE_POLICY.officeMaxDocxTableColumns, maxSheets: FILE_POLICY.officeMaxSheets,
    maxPreviewRowsPerSheet: FILE_POLICY.officeMaxPreviewRowsPerSheet, maxPreviewColumnsPerSheet: FILE_POLICY.officeMaxPreviewColumnsPerSheet,
    maxSlides: FILE_POLICY.officeMaxSlides };
  const result = mime === OFFICE_MIME_TYPES.docx ? await parseDocx(bytes, limits)
    : mime === OFFICE_MIME_TYPES.xlsx ? parseXlsx(bytes, limits)
    : mime === OFFICE_MIME_TYPES.pptx ? parsePptx(bytes, limits)
    : Promise.reject(new Error("FILE_UNSUPPORTED"));
  return capResultText(await result, FILE_POLICY.officeMaxRenderedChars);
}
