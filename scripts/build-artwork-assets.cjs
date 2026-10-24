'use strict';
// Web format encoding only: original PNGs are retained without cropping or resizing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const partial = process.argv.includes('--partial');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const prompts = [...read('art-direction/prompts-01-32.json'), ...read('art-direction/prompts-33-64.json')].sort((a,b) => a.hexagramNumber-b.hexagramNumber);
const reviews = new Map();
for (const file of fs.readdirSync(path.join(root, 'art-direction')).filter(f => /^generation-.*\.json$/.test(f))) {
  const records = read('art-direction/' + file);
  for (const record of Array.isArray(records) ? records : records.images || []) reviews.set(record.hexagramNumber, record);
}
async function main() {
  const images = [];
  fs.mkdirSync(path.join(root, 'dist/assets/personality'), {recursive:true});
  for (const p of prompts) {
    const stop = process.env.CODEX_USAGE_GUARD_STOP_FILE;
    if (stop && fs.existsSync(stop)) process.exit(75);
    const id = p.hexagramNumber, number = String(id).padStart(2,'0');
    const review = reviews.get(id);
    const original = review?.selectedOriginal || `artwork/originals/hexagram-${number}.png`;
    if (!/^artwork\/originals\/hexagram-\d{2}(?:-v\d+)?\.png$/.test(original)) throw new Error(`Invalid selected original: ${number}`);
    const source = path.join(root, original);
    if (!fs.existsSync(source) || !review || !review.reviewNotes) {
      if (partial) continue;
      throw new Error(`Missing generated and reviewed image ${number}`);
    }
    const input = fs.readFileSync(source), originalSha256 = hash(input);
    if (review.sha256 !== originalSha256) throw new Error(`Review hash differs: ${number}`);
    const metadata = await sharp(input).metadata();
    if (metadata.width !== metadata.height || metadata.width < 1000) throw new Error(`Unexpected original size: ${number}`);
    const src = `./assets/personality/hexagram-${number}.webp`, destination = path.join(root,'dist',src.slice(2));
    const output = await sharp(input).webp({quality:82,effort:5}).toBuffer();
    fs.writeFileSync(destination,output);
    images.push({...p, ...(review.editPromptEnglish ? {editPromptEnglish:review.editPromptEnglish} : {}), src,original,originalSha256,sha256:hash(output),bytes:output.length,width:metadata.width,height:metadata.height,generator:'Built-in imagegen',reviewNotes:review.reviewNotes});
  }
  if (!partial && images.length !== 64) throw new Error('Need all 64 independent images');
  const data = Object.fromEntries(images.map(p => [p.hexagramNumber,{hexagramNumber:p.hexagramNumber,typeKey:p.typeCode,title:p.title,src:p.src,width:p.width,height:p.height,conceptZh:p.conceptZh,sha256:p.sha256}]));
  fs.writeFileSync(path.join(root,'dist/data/artwork.js'),'window.GuaData = window.GuaData || {}; window.GuaData.artwork = '+JSON.stringify(data)+';\n');
  fs.writeFileSync(path.join(root,'art-direction/artwork-manifest.json'),JSON.stringify({version:'1.0.0',count:images.length,complete:images.length===64,images},null,2)+'\n');
  fs.writeFileSync(path.join(root,'dist/data/artwork-sources.json'),JSON.stringify({version:'1.0.0',count:images.length,complete:images.length===64,images},null,2)+'\n');
  fs.copyFileSync(path.join(root,'artwork/README.md'),path.join(root,'dist/licenses/Artwork-Notes.txt'));
  console.log(JSON.stringify({count:images.length,complete:images.length===64,webBytes:images.reduce((n,p)=>n+p.bytes,0),largestWebImage:Math.max(0,...images.map(p=>p.bytes))}));
}
main().catch(error=>{console.error(error.message);process.exit(1);});
