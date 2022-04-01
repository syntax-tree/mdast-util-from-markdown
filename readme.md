# mdast-util-from-markdown

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]
[![Sponsors][sponsors-badge]][collective]
[![Backers][backers-badge]][collective]
[![Chat][chat-badge]][chat]

**[mdast][]** utility that turns markdown into a syntax tree.

## Contents

*   [What is this?](#what-is-this)
*   [When should I use this?](#when-should-i-use-this)
*   [Install](#install)
*   [Use](#use)
*   [API](#api)
    *   [`fromMarkdown(doc[, encoding][, options])`](#frommarkdowndoc-encoding-options)
*   [List of extensions](#list-of-extensions)
*   [Syntax](#syntax)
*   [Syntax tree](#syntax-tree)
*   [Types](#types)
*   [Compatibility](#compatibility)
*   [Security](#security)
*   [Related](#related)
*   [Contribute](#contribute)
*   [License](#license)

## What is this?

This package is a utility that takes markdown input and turns it into an
[mdast][] syntax tree.

This utility uses [`micromark`][micromark], which turns markdown into tokens,
while it turns those tokens into nodes.
It’s used in [`remark-parse`][remark-parse], which focusses on making it easier
to transform content by abstracting these internals away.

## When should I use this?

If you want to handle syntax trees manually, use this.
Use [`micromark`][micromark] instead when you *just* want to turn markdown into
HTML.
For an easier time processing content, use the **[remark][]** ecosystem instead.

## Install

This package is [ESM only][esm].
In Node.js (version 12.20+, 14.14+, or 16.0+), install with [npm][]:

```sh
npm install mdast-util-from-markdown
```

In Deno with [`esm.sh`][esmsh]:

```js
import {fromMarkdown} from 'https://esm.sh/mdast-util-from-markdown@1'
```

In browsers with [`esm.sh`][esmsh]:

```html
<script type="module">
  import {toH} from 'https://esm.sh/mdast-util-from-markdown@1?bundle'
</script>
```

## Use

Say we have the following markdown file `example.md`:

```markdown
## Hello, *World*!
```

…and our module `example.js` looks as follows:

```js
import {promises as fs} from 'node:fs'
import {fromMarkdown} from 'mdast-util-from-markdown'

main()

async function main() {
  const doc = await fs.readFile('example.md')
  const tree = fromMarkdown(doc)

  console.log(tree)
}
```

…now running `node example.js` yields (positional info removed for brevity):

```js
{
  type: 'root',
  children: [
    {
      type: 'heading',
      depth: 2,
      children: [
        {type: 'text', value: 'Hello, '},
        {type: 'emphasis', children: [{type: 'text', value: 'World'}]},
        {type: 'text', value: '!'}
      ]
    }
  ]
}
```

## API

This package exports the following identifier: `fromMarkdown`.
There is no default export.

The export map supports the endorsed
[`development` condition](https://nodejs.org/api/packages.html#packages_resolving_user_conditions).
Run `node --conditions development module.js` to get instrumented dev code.
Without this condition, production code is loaded.

### `fromMarkdown(doc[, encoding][, options])`

Turn markdown into a syntax tree.

##### Parameters

###### `doc`

Value to parse (`string` or [`Buffer`][buffer]).

###### `encoding`

[Character encoding][encoding] to understand `doc` as when it’s a
[`Buffer`][buffer] (`string`, default: `'utf8'`).

###### `options.extensions`

List of syntax extensions (`Array<MicromarkSyntaxExtension>`, default: `[]`).
Passed to [`micromark` as `options.extensions`][micromark-extensions].

###### `options.mdastExtensions`

List of mdast extensions (`Array<MdastExtension>`, default: `[]`).

##### Returns

[`Root`][root].

## List of extensions

*   [`syntax-tree/mdast-util-directive`](https://github.com/syntax-tree/mdast-util-directive)
    — directives
*   [`syntax-tree/mdast-util-frontmatter`](https://github.com/syntax-tree/mdast-util-frontmatter)
    — frontmatter (YAML, TOML, more)
*   [`syntax-tree/mdast-util-gfm`](https://github.com/syntax-tree/mdast-util-gfm)
    — GFM
*   [`syntax-tree/mdast-util-gfm-autolink-literal`](https://github.com/syntax-tree/mdast-util-gfm-autolink-literal)
    — GFM autolink literals
*   [`syntax-tree/mdast-util-gfm-footnote`](https://github.com/syntax-tree/mdast-util-gfm-footnote)
    — GFM footnotes
*   [`syntax-tree/mdast-util-gfm-strikethrough`](https://github.com/syntax-tree/mdast-util-gfm-strikethrough)
    — GFM strikethrough
*   [`syntax-tree/mdast-util-gfm-table`](https://github.com/syntax-tree/mdast-util-gfm-table)
    — GFM tables
*   [`syntax-tree/mdast-util-gfm-task-list-item`](https://github.com/syntax-tree/mdast-util-gfm-task-list-item)
    — GFM task list items
*   [`syntax-tree/mdast-util-math`](https://github.com/syntax-tree/mdast-util-math)
    — math
*   [`syntax-tree/mdast-util-mdx`](https://github.com/syntax-tree/mdast-util-mdx)
    — MDX
*   [`syntax-tree/mdast-util-mdx-expression`](https://github.com/syntax-tree/mdast-util-mdx-expression)
    — MDX expressions
*   [`syntax-tree/mdast-util-mdx-jsx`](https://github.com/syntax-tree/mdast-util-mdx-jsx)
    — MDX JSX
*   [`syntax-tree/mdast-util-mdxjs-esm`](https://github.com/syntax-tree/mdast-util-mdxjs-esm)
    — MDX ESM

## Syntax

Markdown is parsed according to CommonMark.
Extensions can add support for other syntax.
If you’re interested in extending markdown,
[more information is available in micromark’s readme][micromark-extend].

## Syntax tree

The syntax tree is [mdast][].

## Types

This package is fully typed with [TypeScript][].
It exports the types `Value`, `Encoding`, `Options`, `Extension`, `Handle`,
`Transform`, `Token`, `CompileContext`, `OnEnterError`, `OnExitError`, which
model the interfaces used in parameters, options, and extensions.

## Compatibility

Projects maintained by the unified collective are compatible with all maintained
versions of Node.js.
As of now, that is Node.js 12.20+, 14.14+, and 16.0+.
Our projects sometimes work with older versions, but this is not guaranteed.

## Security

As markdown is sometimes used for HTML, and improper use of HTML can open you up
to a [cross-site scripting (XSS)][xss] attack, use of `mdast-util-from-markdown`
can also be unsafe.
When going to HTML, use this utility in combination with
[`hast-util-sanitize`][hast-util-sanitize] to make the tree safe.

## Related

*   [`syntax-tree/mdast-util-to-markdown`](https://github.com/syntax-tree/mdast-util-to-markdown)
    — serialize mdast as markdown
*   [`micromark/micromark`](https://github.com/micromark/micromark)
    — parse markdown
*   [`remarkjs/remark`](https://github.com/remarkjs/remark)
    — process markdown

## Contribute

See [`contributing.md` in `syntax-tree/.github`][contributing] for ways to get
started.
See [`support.md`][support] for ways to get help.

This project has a [code of conduct][coc].
By interacting with this repository, organization, or community you agree to
abide by its terms.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/syntax-tree/mdast-util-from-markdown/workflows/main/badge.svg

[build]: https://github.com/syntax-tree/mdast-util-from-markdown/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/syntax-tree/mdast-util-from-markdown.svg

[coverage]: https://codecov.io/github/syntax-tree/mdast-util-from-markdown

[downloads-badge]: https://img.shields.io/npm/dm/mdast-util-from-markdown.svg

[downloads]: https://www.npmjs.com/package/mdast-util-from-markdown

[size-badge]: https://img.shields.io/bundlephobia/minzip/mdast-util-from-markdown.svg

[size]: https://bundlephobia.com/result?p=mdast-util-from-markdown

[sponsors-badge]: https://opencollective.com/unified/sponsors/badge.svg

[backers-badge]: https://opencollective.com/unified/backers/badge.svg

[collective]: https://opencollective.com/unified

[chat-badge]: https://img.shields.io/badge/chat-discussions-success.svg

[chat]: https://github.com/syntax-tree/unist/discussions

[npm]: https://docs.npmjs.com/cli/install

[esmsh]: https://esm.sh

[license]: license

[author]: https://wooorm.com

[contributing]: https://github.com/syntax-tree/.github/blob/HEAD/contributing.md

[support]: https://github.com/syntax-tree/.github/blob/HEAD/support.md

[coc]: https://github.com/syntax-tree/.github/blob/HEAD/code-of-conduct.md

[esm]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

[typescript]: https://www.typescriptlang.org

[mdast]: https://github.com/syntax-tree/mdast

[root]: https://github.com/syntax-tree/mdast#root

[encoding]: https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings

[buffer]: https://nodejs.org/api/buffer.html

[xss]: https://en.wikipedia.org/wiki/Cross-site_scripting

[hast-util-sanitize]: https://github.com/syntax-tree/hast-util-sanitize

[micromark]: https://github.com/micromark/micromark

[micromark-extensions]: https://github.com/micromark/micromark#optionsextensions

[micromark-extend]: https://github.com/micromark/micromark#extensions

[remark]: https://github.com/remarkjs/remark

[remark-parse]: https://github.com/remarkjs/remark/tree/main/packages/remark-parse
