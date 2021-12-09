import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import builtins from 'builtin-modules';
const baseConfig = {
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json({ compact: true }),
    typescript(),
  ],
  external: [
    ...builtins,
    'ethers',
    'axios',
    /^defender-relay-client(\/.*)?$/
  ],
}

export default [{
  input: 'src/ftxlending.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
  },
  ...baseConfig
}];
