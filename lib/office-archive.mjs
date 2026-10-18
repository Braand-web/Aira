const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const OFFICE_NESTED_ARCHIVE = /\.(?:zip|7z|rar|jar|docx|xlsx|pptx|docm|xlsm|pptm)$/iu;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function readU16(view, offset) {
  if (offset < 0 || offset + 2 > view.byteLength) throw new Error("FILE_CORRUPT");
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  if (offset < 0 || offset + 4 > view.byteLength) throw new Error("FILE_CORRUPT");
  return view.getUint32(offset, true);
}

function safeName(bytes, flags) {
  if (bytes.includes(0) || bytes.includes(92)) throw new Error("FILE_REJECTED_SECURITY");
  let name;
  try {
    name = new TextDecoder((flags & 0x800) !== 0 ? "utf-8" : "ascii", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("FILE_CORRUPT");
  }
  const normalized = name.normalize("NFC");
  if (normalized.startsWith("/") || /^[a-z]:/iu.test(normalized) || normalized.split("/").includes("..")) throw new Error("FILE_REJECTED_SECURITY");
  return normalized;
}

function zipEndOffset(bytes) {
  const minOffset = Math.max(0, bytes.length - 65_557);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= minOffset; offset--) {
    if (readU32(view, offset) === EOCD_SIGNATURE) {
      const commentLength = readU16(view, offset + 20);
      if (offset + 22 + commentLength === bytes.length) return offset;
    }
  }
  throw new Error("FILE_CORRUPT");
}

export function readOfficeZipDirectory(bytes, limits) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22) throw new Error("FILE_CORRUPT");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = zipEndOffset(bytes);
  const disk = readU16(view, end + 4);
  const centralDisk = readU16(view, end + 6);
  const diskEntries = readU16(view, end + 8);
  const entryCount = readU16(view, end + 10);
  const centralSize = readU32(view, end + 12);
  const centralOffset = readU32(view, end + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount || entryCount === 0) throw new Error("FILE_CORRUPT");
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error("FILE_REJECTED_SECURITY");
  if (entryCount > limits.maxEntries) throw new Error("FILE_REJECTED_SECURITY");
  if (centralOffset + centralSize > end || centralOffset + centralSize < centralOffset) throw new Error("FILE_CORRUPT");

  const entries = [];
  const names = new Set();
  let offset = centralOffset;
  let expandedTotal = 0;
  for (let index = 0; index < entryCount; index++) {
    if (readU32(view, offset) !== CENTRAL_SIGNATURE) throw new Error("FILE_CORRUPT");
    const flags = readU16(view, offset + 8);
    const method = readU16(view, offset + 10);
    const crc32 = readU32(view, offset + 16);
    const compressedSize = readU32(view, offset + 20);
    const expandedSize = readU32(view, offset + 24);
    const nameLength = readU16(view, offset + 28);
    const extraLength = readU16(view, offset + 30);
    const commentLength = readU16(view, offset + 32);
    const localOffset = readU32(view, offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > centralOffset + centralSize || nextOffset < offset) throw new Error("FILE_CORRUPT");
    const name = safeName(bytes.subarray(offset + 46, offset + 46 + nameLength), flags);
    if (names.has(name)) throw new Error("FILE_REJECTED_SECURITY");
    names.add(name);
    if ((flags & 1) !== 0) throw new Error("FILE_PASSWORD");
    if (method !== 0 && method !== 8 && !name.endsWith("/")) throw new Error("FILE_UNSUPPORTED");
    if (name.endsWith("/") && expandedSize !== 0) throw new Error("FILE_CORRUPT");
    if (OFFICE_NESTED_ARCHIVE.test(name)) throw new Error("FILE_REJECTED_SECURITY");
    if (expandedSize > 0 && (compressedSize === 0 || expandedSize / compressedSize > limits.maxRatio)) throw new Error("FILE_REJECTED_SECURITY");
    expandedTotal += expandedSize;
    if (expandedTotal > limits.maxExpandedBytes) throw new Error("FILE_TOO_LARGE");
    entries.push({ name, flags, method, crc32, compressedSize, expandedSize, localOffset });
    offset = nextOffset;
  }
  if (offset !== centralOffset + centralSize) throw new Error("FILE_CORRUPT");
  return { entries, expandedTotal, byteLength: bytes.length };
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function detectOfficeMime(bytes, limits) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
  try {
    const { entries } = readOfficeZipDirectory(bytes, limits);
    const names = new Set(entries.map(entry => entry.name));
    if (!names.has("[Content_Types].xml")) return null;
    if (names.has("word/document.xml")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (names.has("xl/workbook.xml")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (names.has("ppt/presentation.xml")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  } catch {
    return null;
  }
  return null;
}

export async function inflateOfficeEntry(bytes, entry, limits) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localOffset;
  if (readU32(view, offset) !== LOCAL_SIGNATURE) throw new Error("FILE_CORRUPT");
  const flags = readU16(view, offset + 6);
  const method = readU16(view, offset + 8);
  const localCrc = readU32(view, offset + 14);
  const localCompressedSize = readU32(view, offset + 18);
  const localExpandedSize = readU32(view, offset + 22);
  const nameLength = readU16(view, offset + 26);
  const extraLength = readU16(view, offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if ((flags & 1) !== 0 || flags !== entry.flags || method !== entry.method || dataEnd > bytes.length || dataEnd < dataStart) throw new Error("FILE_CORRUPT");
  if ((flags & 8) === 0 && (localCrc !== entry.crc32 || localCompressedSize !== entry.compressedSize || localExpandedSize !== entry.expandedSize)) throw new Error("FILE_CORRUPT");
  const localName = safeName(bytes.subarray(offset + 30, offset + 30 + nameLength), flags);
  if (localName !== entry.name) throw new Error("FILE_CORRUPT");
  if (entry.expandedSize > limits.maxXmlPartBytes) throw new Error("FILE_TOO_LARGE");
  const input = bytes.slice(dataStart, dataEnd);
  if (method === 0) {
    if (input.length !== entry.expandedSize) throw new Error("FILE_CORRUPT");
    if (crc32(input) !== entry.crc32) throw new Error("FILE_CORRUPT");
    return input;
  }
  if (typeof DecompressionStream === "undefined") throw new Error("FILE_UNSUPPORTED");
  let stream;
  try { stream = new Blob([input]).stream().pipeThrough(new DecompressionStream("deflate-raw")); }
  catch { throw new Error("FILE_CORRUPT"); }
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limits.maxXmlPartBytes || total > entry.expandedSize) {
        await reader.cancel();
        throw new Error("FILE_REJECTED_SECURITY");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== entry.expandedSize) throw new Error("FILE_CORRUPT");
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  if (crc32(output) !== entry.crc32) throw new Error("FILE_CORRUPT");
  return output;
}
