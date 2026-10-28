import { deflateRawSync } from 'node:zlib';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(root, 'dist');
const stagingDirectory = path.join(distDirectory, 'firefox');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const buildLabel = packageJson.buildLabel ? `-${packageJson.buildLabel}` : '';
const artifactVersion = `${version}${buildLabel}`;
const releaseDate = new Date(`${packageJson.releaseDate}T00:00:00Z`);

const runtimeEntries = [
  '_locales',
  'images',
  'scripts',
  'styles',
  'third_party',
  'update',
  'LICENSE',
  'manifest.json',
  'popup.html',
  'popup.js'
];

async function collectFiles(absolutePath, relativePath = '') {
  const fileStat = await stat(absolutePath);

  if (fileStat.isFile()) {
    return [{ absolutePath, relativePath }];
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (['.git', 'dist', 'node_modules'].includes(entry.name)) continue;

    const childAbsolute = path.join(absolutePath, entry.name);
    const childRelative = path.join(relativePath, entry.name);
    files.push(...await collectFiles(childAbsolute, childRelative));
  }

  return files;
}

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
  const dosDate = ((year - 1980) << 9) |
    ((date.getUTCMonth() + 1) << 5) |
    date.getUTCDate();
  const dosTime = (date.getUTCHours() << 11) |
    (date.getUTCMinutes() << 5) |
    Math.floor(date.getUTCSeconds() / 2);

  return { dosDate, dosTime };
}

async function createZip(files, outputPath, prefix = '') {
  const localChunks = [];
  const centralRecords = [];
  const { dosDate, dosTime } = toDosDateTime(releaseDate);
  let localOffset = 0;

  for (const file of [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    const source = await readFile(file.absolutePath);
    const deflated = deflateRawSync(source, { level: 9 });
    const useCompression = deflated.length < source.length;
    const payload = useCompression ? deflated : source;
    const method = useCompression ? 8 : 0;
    const checksum = crc32(source);
    const archivePath = path.posix.join(prefix, file.relativePath.split(path.sep).join('/'));
    const name = Buffer.from(archivePath, 'utf8');
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(source.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, name, payload);
    centralRecords.push({
      checksum,
      compressedSize: payload.length,
      method,
      name,
      offset: localOffset,
      uncompressedSize: source.length
    });
    localOffset += localHeader.length + name.length + payload.length;
  }

  const centralChunks = [];

  for (const record of centralRecords) {
    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(record.method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(record.checksum, 16);
    centralHeader.writeUInt32LE(record.compressedSize, 20);
    centralHeader.writeUInt32LE(record.uncompressedSize, 24);
    centralHeader.writeUInt16LE(record.name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(record.offset, 42);
    centralChunks.push(centralHeader, record.name);
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const endRecord = Buffer.alloc(22);

  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(centralRecords.length, 8);
  endRecord.writeUInt16LE(centralRecords.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  await writeFile(outputPath, Buffer.concat([...localChunks, centralDirectory, endRecord]));
}

await rm(distDirectory, { recursive: true, force: true });
await mkdir(stagingDirectory, { recursive: true });

const runtimeFiles = [];

for (const entry of runtimeEntries) {
  const absolutePath = path.join(root, entry);
  runtimeFiles.push(...await collectFiles(absolutePath, entry));
}

for (const file of runtimeFiles) {
  const destination = path.join(stagingDirectory, file.relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(file.absolutePath, destination);
}

const sourceFiles = await collectFiles(root);
const storeZip = path.join(distDirectory, `CSS-Insight-firefox-${artifactVersion}-amo.zip`);
const sourceZip = path.join(distDirectory, `CSS-Insight-firefox-${artifactVersion}-source.zip`);

await createZip(runtimeFiles, storeZip);
await createZip(sourceFiles, sourceZip);

const storeSize = (await stat(storeZip)).size;
const sourceSize = (await stat(sourceZip)).size;

console.log(`Built ${path.basename(storeZip)} (${runtimeFiles.length} files, ${storeSize} bytes).`);
console.log(`Built ${path.basename(sourceZip)} (${sourceFiles.length} files, ${sourceSize} bytes).`);
