// Extract word/document.xml from a .docx (ZIP), inflate, strip XML, write .txt
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readLocalFiles(buf) {
  const files = {};
  let off = 0;
  while (off + 4 <= buf.length) {
    const sig = buf.readUInt32LE(off);
    if (sig !== 0x04034b50) break;
    const method = buf.readUInt16LE(off + 8);
    const compSize = buf.readUInt32LE(off + 18);
    const uncompSize = buf.readUInt32LE(off + 22);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name = buf.slice(off + 30, off + 30 + nameLen).toString('utf8');
    const dataOff = off + 30 + nameLen + extraLen;
    const data = buf.slice(dataOff, dataOff + compSize);
    let content;
    if (method === 0) content = data;
    else if (method === 8) content = zlib.inflateRawSync(data);
    else { off = dataOff + compSize; continue; }
    files[name] = content;
    off = dataOff + compSize;
  }
  return files;
}

function xmlToText(xml) {
  // Preserve paragraph/line breaks
  let s = xml
    .replace(/<w:p[^>]*\/>/g, '\n')
    .replace(/<w:p\b[^>]*>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t');
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode basic XML entities
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  // Collapse excessive newlines
  s = s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

const inputs = [
  ['02_SclinNexus_CRO_Workspace_Reqiurements_v6.docx',     'CRO_requirements.txt'],
  ['03_SclinNexus_Sponsor_Workspace_Reqiurements_v6.docx', 'Sponsor_requirements.txt'],
];

for (const [src, dst] of inputs) {
  const full = path.resolve(__dirname, '..', src);
  const buf = fs.readFileSync(full);
  const files = readLocalFiles(buf);
  const docXml = files['word/document.xml'];
  if (!docXml) { console.error('no document.xml in', src); continue; }
  const text = xmlToText(docXml.toString('utf8'));
  const outPath = path.resolve(__dirname, dst);
  fs.writeFileSync(outPath, text, 'utf8');
  console.log('Wrote', outPath, text.length, 'chars');
}
