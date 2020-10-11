// This file is for https://github.com/microsoft/dtslint .
// Tests are type-checked, but not run.

import * as fromMarkdown from 'mdast-util-from-markdown'

function main() {
  const raw = '# text **strong**'

  // $ExpectType Root
  fromMarkdown(raw)

  // $ExpectType Root
  fromMarkdown(Buffer.alloc(8))

  // $ExpectType Root
  fromMarkdown(Buffer.alloc(8), {extensions: []})

  // $ExpectType Root
  fromMarkdown(Buffer.alloc(8), 'utf-8', {mdastExtensions: []})

  // $ExpectError
  fromMarkdown(Buffer.alloc(8), 'utf-8', {allowDangerousHtml: true})
}

main()
