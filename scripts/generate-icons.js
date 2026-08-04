import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

const svgPath = path.join(process.cwd(), 'public', 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

const targets = [
  { name: 'pwa-192x192.png', width: 192 },
  { name: 'pwa-512x512.png', width: 512 },
  { name: 'apple-touch-icon.png', width: 180 },
  { name: 'favicon-32x32.png', width: 32 },
  { name: 'favicon-16x16.png', width: 16 },
  { name: 'icon-192.png', width: 192 },
  { name: 'icon-512.png', width: 512 },
];

targets.forEach(({ name, width }) => {
  const resvg = new Resvg(svgBuffer, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const image = resvg.render();
  const pngBuffer = image.asPng();
  const outputPath = path.join(process.cwd(), 'public', name);
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Generated ${name} (${width}x${width})`);
});
