// This file is for https://github.com/microsoft/dtslint .
// Tests are type-checked, but not run.

import * as formMarkdown from 'mdast-util-from-markdown'

function main() {
  const raw = '# text **strong**'

  // $ExpectType Root
  formMarkdown(raw)

  // $ExpectType Root
  formMarkdown(Buffer.alloc(8))

  // $ExpectType Root
  formMarkdown(Buffer.alloc(8), {extensions: []})

  // $ExpectType Root
  formMarkdown(Buffer.alloc(8), 'utf-8', {mdastExtensions: []})

  // $ExpectError
  formMarkdown(Buffer.alloc(8), 'utf-8', {allowDangerousHtml: true})
}

main()
