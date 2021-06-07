import filesize from 'rollup-plugin-filesize'

const config = {
  input: 'lib/index.js',
  output: {
    format: 'esm',
    dir: 'dist'
  },
  plugins: [filesize()]
}

export default config
