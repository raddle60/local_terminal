const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [path.join(__dirname, '../src/renderer/index.ts')],
  bundle: true,
  outfile: path.join(__dirname, '../dist/renderer/index.js'),
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  sourcemap: false,
  minify: false,
}).catch(() => process.exit(1));
