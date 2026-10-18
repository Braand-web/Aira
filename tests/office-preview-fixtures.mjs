const encoder = new TextEncoder();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

export function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const filename = encoder.encode(name);
    const body = typeof content === "string" ? encoder.encode(content) : content;
    const checksum = crc32(body);
    const local = new Uint8Array(30 + filename.length + body.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true);
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

export function createDocxPreviewFixture() {
  return createStoredZip([
    ["[Content_Types].xml", "<Types/>"] ,
    ["word/document.xml", "<w:document xmlns:w=\"w\"><w:body><w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>Test Office local</w:t></w:r></w:p><w:p><w:r><w:t>Contenu de test</w:t></w:r></w:p></w:body></w:document>"]
  ]);
}
