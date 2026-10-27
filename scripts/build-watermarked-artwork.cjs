'use strict';
// Authorized brand compositing only. Never regenerates, crops, or overwrites source artwork.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const VERSION = 'twobu-corners-v3';

function argument(name, required = true) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
    if (required) throw new Error(`Required argument: ${name}`);
    return null;
  }
  return path.resolve(process.argv[index + 1]);
}
function checkedPath(base, relative) {
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(path.resolve(base) + path.sep)) throw new Error('Path outside intended directory');
  return resolved;
}
function checkStop() {
  const stop = process.env.CODEX_USAGE_GUARD_STOP_FILE;
  if (stop && fs.existsSync(stop)) process.exit(75);
}
async function difference(a, b) {
  const [one, two] = await Promise.all([sharp(a).removeAlpha().raw().toBuffer(), sharp(b).removeAlpha().raw().toBuffer()]);
  if (one.length !== two.length) throw new Error('Pixel comparison dimensions differ');
  let total = 0;
  for (let i = 0; i < one.length; i++) total += Math.abs(one[i] - two[i]);
  return total / one.length;
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

async function main() {
  const sourceDirectory = argument('--source-directory');
  const sourceManifestFile = argument('--source-manifest');
  const logoFile = argument('--logo');
  const publicSource = argument('--public-source', false);
  const evidenceFile = argument('--evidence');
  const approvedSampleFile = argument('--approved-sample');
  const approvedSample = approvedSampleFile ? {option: 'A', relativeWidth: .04, sha256: hash(fs.readFileSync(approvedSampleFile))} : null;
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestFile, 'utf8'));
  if (!sourceManifest.complete || sourceManifest.count !== 64 || sourceManifest.images.length !== 64) throw new Error('Need verified 64-image baseline');
  const sourceLogo = fs.readFileSync(logoFile);
  const logoMetadata = await sharp(sourceLogo).metadata();
  if (logoMetadata.width !== logoMetadata.height) throw new Error('Logo must remain square without cropping');
  const brandSrc = './assets/brand/twobu-logo.webp';
  const brand = await sharp(sourceLogo).webp({lossless: true, effort: 6}).toBuffer();
  const roots = [root, ...(publicSource ? [publicSource] : [])];
  for (const target of roots) {
    fs.mkdirSync(checkedPath(target, 'dist/assets/brand'), {recursive: true});
    fs.mkdirSync(checkedPath(target, 'dist/assets/personality/twobu'), {recursive: true});
    fs.writeFileSync(checkedPath(target, 'dist/' + brandSrc.slice(2)), brand);
  }
  const logo = {brand: 'TWOBU', src: brandSrc, sourceSha256: hash(sourceLogo), sha256: hash(brand), bytes: brand.length, width: logoMetadata.width, height: logoMetadata.height};
  const records = [], checks = [], privateHashes = [];
  for (const p of sourceManifest.images) {
    checkStop();
    const number = String(p.hexagramNumber).padStart(2, '0');
    if (p.src !== `./assets/personality/hexagram-${number}.webp`) throw new Error('Only the pre-watermark baseline is accepted');
    const sourceFile = checkedPath(sourceDirectory, p.src.slice(2));
    const sourceBytes = fs.readFileSync(sourceFile);
    if (hash(sourceBytes) !== p.sha256 || sourceBytes.length !== p.bytes) throw new Error(`Baseline differs: ${number}`);
    const originalFile = checkedPath(root, p.original);
    const originalHash = hash(fs.readFileSync(originalFile));
    if (originalHash !== p.originalSha256) throw new Error(`Original differs: ${number}`);
    privateHashes.push({number: p.hexagramNumber, original: p.original, sha256: originalHash});
    const meta = await sharp(sourceBytes).metadata();
    if (meta.width !== 1254 || meta.height !== 1254) throw new Error(`Unexpected dimensions: ${number}`);
    const size = Math.round(meta.width * .04), margin = Math.round(meta.width * .025);
    const resizedLogo = await sharp(sourceLogo).resize(size, size, {fit: 'contain', kernel: 'lanczos3'}).flatten({background: '#ffffff'}).png().toBuffer();
    const corners = [
      {corner: 'top-left', left: margin, top: margin, width: size, height: size},
      {corner: 'top-right', left: meta.width - margin - size, top: margin, width: size, height: size},
      {corner: 'bottom-left', left: margin, top: meta.height - margin - size, width: size, height: size},
      {corner: 'bottom-right', left: meta.width - margin - size, top: meta.height - margin - size, width: size, height: size}
    ];
    const result = await sharp(sourceBytes).composite(corners.map(({left, top}) => ({input: resizedLogo, left, top, blend: 'over'}))).webp({quality: 85, effort: 6}).toBuffer();
    if (p.hexagramNumber === 1 && approvedSample && hash(result) !== approvedSample.sha256) throw new Error('First derivative differs from the approved option A sample');
    const cornerErrors = [];
    for (const corner of corners) {
      const {left, top, width, height} = corner;
      const crop = await sharp(result).extract({left, top, width, height}).png().toBuffer();
      const mae = await difference(crop, resizedLogo);
      if (mae > 12) throw new Error(`Logo pixels do not match ${number}/${corner.corner}: ${mae}`);
      cornerErrors.push({corner: corner.corner, meanAbsolutePixelError: Number(mae.toFixed(4))});
    }
    const src = `./assets/personality/twobu/hexagram-${number}.webp`;
    for (const target of roots) fs.writeFileSync(checkedPath(target, 'dist/' + src.slice(2)), result);
    const derivative = {version: VERSION, operation: 'authorized-four-corner-logo-composite', sourceWebp: {src: p.src, sha256: p.sha256, bytes: p.bytes}, logoSourceSha256: logo.sourceSha256, logoSha256: logo.sha256, logoSrc: brandSrc, opacity: 1, relativeWidth: .04, relativeMargin: .025, corners};
    records.push({...p, src, sha256: hash(result), bytes: result.length, derivative});
    checks.push({hexagramNumber: p.hexagramNumber, sourceWebpSha256: p.sha256, originalSha256: originalHash, outputSha256: hash(result), corners: cornerErrors});
    console.log(JSON.stringify({image: p.hexagramNumber, corners: 4, bytes: result.length}));
  }
  checkStop();
  for (const p of privateHashes) if (hash(fs.readFileSync(checkedPath(root, p.original))) !== p.sha256) throw new Error('Source PNG changed during build');
  if (hash(fs.readFileSync(logoFile)) !== logo.sourceSha256) throw new Error('Source logo changed during build');
  const manifest = {...sourceManifest, version: '1.1.0', watermark: {version: VERSION, authorization: 'User approved option A (four-corner TWOBU logo at 4% image width) for all 64 public illustrations on 2026-10-28.', ...(approvedSample ? {approvedSample} : {}), sourceManifestSha256: hash(fs.readFileSync(sourceManifestFile)), logo}, images: records};
  const data = Object.fromEntries(records.map(p => [p.hexagramNumber, {hexagramNumber: p.hexagramNumber, typeKey: p.typeCode, title: p.title, src: p.src, width: p.width, height: p.height, conceptZh: p.conceptZh, sha256: p.sha256, derivativeVersion: VERSION}]));
  for (const target of roots) {
    writeJson(checkedPath(target, 'art-direction/artwork-manifest.json'), manifest);
    writeJson(checkedPath(target, 'dist/data/artwork-sources.json'), manifest);
    fs.writeFileSync(checkedPath(target, 'dist/data/artwork.js'), 'window.GuaData = window.GuaData || {}; window.GuaData.artwork = ' + JSON.stringify(data) + ';\n');
  }
  // Remove only individually validated old public assets; private baseline and PNGs stay intact.
  for (const target of roots) for (const p of sourceManifest.images) {
    const old = checkedPath(target, 'dist/' + p.src.slice(2));
    if (!fs.existsSync(old)) continue;
    if (hash(fs.readFileSync(old)) !== p.sha256) throw new Error('Refusing to remove an unrecognized current image');
    fs.unlinkSync(old);
  }
  writeJson(evidenceFile, {version: VERSION, count: records.length, cornerCount: records.length * 4, logo, approvedSample, firstImageMatchesApprovedSample: approvedSample ? records[0].sha256 === approvedSample.sha256 : null, originalPngsUnchanged: true, sourceWebpsUnchanged: sourceManifest.images.every(p => hash(fs.readFileSync(checkedPath(sourceDirectory, p.src.slice(2)))) === p.sha256), sourceLogoUnchanged: true, webBytes: records.reduce((sum, p) => sum + p.bytes, 0), largestImageBytes: Math.max(...records.map(p => p.bytes)), checks});
  console.log(JSON.stringify({complete: true, count: records.length, corners: records.length * 4, originalsUnchanged: true, evidence: evidenceFile}));
}
main().catch(error => {console.error(error.stack); process.exit(1);});
