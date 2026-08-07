const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { readPsd, writePsdBuffer } = require('../dist');

const WIDTH = 640;
const HEIGHT = 480;
const TEXT_BOUNDS = { x: 160, y: 40, width: 320, height: 70 };

function imageData(width, height, rgba) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

function renderFallbackText() {
  // The probe is about Photoshop Type Layer metadata, not typography fidelity.
  // Keep deterministic fallback pixels so both files differ only by document-level Txt2.
  const result = imageData(TEXT_BOUNDS.width, TEXT_BOUNDS.height, [0, 0, 0, 0]);
  const data = result.data;
  for (let y = 18; y < 52; y += 1) {
    for (let x = 48; x < 272; x += 1) {
      if ((x + y) % 7 > 1) continue;
      const offset = (y * result.width + x) * 4;
      data[offset] = 35;
      data[offset + 1] = 35;
      data[offset + 2] = 35;
      data[offset + 3] = 255;
    }
  }
  return result;
}

function makePsd(engineData) {
  const background = imageData(WIDTH, HEIGHT, [245, 245, 245, 255]);
  const textPixels = renderFallbackText();
  const psd = {
    width: WIDTH,
    height: HEIGHT,
    imageData: background,
    children: [
      {
        name: 'Background',
        left: 0,
        top: 0,
        right: WIDTH,
        bottom: HEIGHT,
        imageData: background,
      },
      {
        name: 'Live Text',
        left: TEXT_BOUNDS.x,
        top: TEXT_BOUNDS.y,
        right: TEXT_BOUNDS.x + TEXT_BOUNDS.width,
        bottom: TEXT_BOUNDS.y + TEXT_BOUNDS.height,
        imageData: textPixels,
        text: {
          text: 'EDIT ME',
          transform: [1, 0, 0, 1, TEXT_BOUNDS.x, TEXT_BOUNDS.y + 48],
          style: {
            font: { name: 'ArialMT' },
            fontSize: 48,
            fillColor: { r: 35, g: 35, b: 35 },
          },
        },
      },
    ],
  };
  if (engineData) psd.engineData = engineData;
  return psd;
}

function writeProbe(outputDir, fileName, engineData) {
  const buffer = writePsdBuffer(makePsd(engineData), {
    generateThumbnail: false,
    noBackground: true,
  });
  const output = path.join(outputDir, fileName);
  fs.writeFileSync(output, buffer);
  const parsed = readPsd(buffer, {
    skipCompositeImageData: true,
    skipLayerImageData: true,
    skipThumbnail: true,
  });
  return {
    file: fileName,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    reread_text: parsed.children?.find((layer) => layer.name === 'Live Text')?.text?.text ?? null,
    has_global_engine_data: Boolean(parsed.engineData),
  };
}

const outputDir = path.resolve(process.argv[2] || 'results/live-text-probe');
fs.mkdirSync(outputDir, { recursive: true });
const referenceEngineData = fs.readFileSync(path.join(__dirname, '..', 'test', 'EngineData2.bin')).toString('base64');

const report = {
  schema_version: '1.0',
  hypothesis: 'A valid document-level Txt2 global text engine data block is required for a newly written Type Layer to remain editable in Photoshop.',
  controlled_variable: 'Psd.engineData / Txt2 only',
  photoshop_required: true,
  files: [
    writeProbe(outputDir, 'live-text-control-no-txt2.psd', undefined),
    writeProbe(outputDir, 'live-text-probe-with-reference-txt2.psd', referenceEngineData),
  ],
};

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
