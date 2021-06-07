import filesize from 'rollup-plugin-filesize'
import {babel} from '@rollup/plugin-babel'

const config = {
  input: 'lib/index.js',
  output: {
    format: 'esm',
    dir: 'dist'
  },
  plugins: [babel({babelHelpers: 'bundled'}), filesize()],
  external: [
    'micromark-util-symbol/constants',
    'micromark-util-symbol/values',
    'micromark-util-symbol/types',
    'mdast-util-to-string',
    'micromark-util-normalize-identifier',
    'micromark/lib/parse',
    'micromark/lib/preprocess',
    'micromark/lib/postprocess',
    'parse-entities/decode-entity',
    'unist-util-stringify-position'
  ]
}

export default config
