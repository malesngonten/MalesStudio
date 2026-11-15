import sharp from 'sharp';

await sharp('public/logo-original.png')
  .trim()
  .resize({ width: 320 })
  .png()
  .toFile('public/logo.png');

console.log('Done');
