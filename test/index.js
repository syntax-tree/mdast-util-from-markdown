/**
 * @typedef {import('mdast').Root} Root
 */

import assert from 'node:assert/strict'
import {Buffer} from 'node:buffer'
import fs from 'node:fs/promises'
import test from 'tape'
import {toHast} from 'mdast-util-to-hast'
import {toString} from 'mdast-util-to-string'
import {fromHtml} from 'hast-util-from-html'
import {toHtml} from 'hast-util-to-html'
import {commonmark} from 'commonmark.json'
import {fromMarkdown} from '../dev/index.js'

test('mdast-util-from-markdown', (t) => {
  t.equal(typeof fromMarkdown, 'function', 'should expose a function')

  t.deepEqual(
    fromMarkdown(''),
    {
      type: 'root',
      children: [],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 1, offset: 0}
      }
    },
    'should parse an empty document'
  )

  t.deepEqual(
    fromMarkdown('a\nb'),
    {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'a\nb',
              position: {
                start: {line: 1, column: 1, offset: 0},
                end: {line: 2, column: 2, offset: 3}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 2, column: 2, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 2, column: 2, offset: 3}
      }
    },
    'should parse a paragraph'
  )

  t.equal(
    toString(fromMarkdown(Buffer.from([0x62, 0x72, 0xc3, 0xa1, 0x76, 0x6f]))),
    'brávo',
    'should support buffers'
  )

  t.equal(
    toString(
      fromMarkdown(Buffer.from([0x62, 0x72, 0xc3, 0xa1, 0x76, 0x6f]), 'ascii')
    ),
    'brC!vo',
    'should support encoding'
  )

  t.deepEqual(
    fromMarkdown('a\nb', {
      mdastExtensions: [
        {
          // Unknown objects are used, but have no effect.
          unknown: undefined,
          // `canContainEols` is an array.
          canContainEols: ['someType'],
          enter: {
            lineEnding(token) {
              this.enter({type: 'break'}, token)
            }
          },
          exit: {
            lineEnding(token) {
              this.exit(token)
            }
          }
        }
      ]
    }).children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          value: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 2, offset: 1}
          }
        },
        {
          type: 'break',
          position: {
            start: {line: 1, column: 2, offset: 1},
            end: {line: 2, column: 1, offset: 2}
          }
        },
        {
          type: 'text',
          value: 'b',
          position: {
            start: {line: 2, column: 1, offset: 2},
            end: {line: 2, column: 2, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 2, column: 2, offset: 3}
      }
    },
    'should support extensions'
  )

  t.deepEqual(
    fromMarkdown('a\nb', {
      mdastExtensions: [
        [
          {
            enter: {
              lineEnding(token) {
                this.enter({type: 'break'}, token)
              }
            }
          },
          {
            exit: {
              lineEnding(token) {
                this.exit(token)
              }
            }
          }
        ]
      ]
    }).children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          value: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 2, offset: 1}
          }
        },
        {
          type: 'break',
          position: {
            start: {line: 1, column: 2, offset: 1},
            end: {line: 2, column: 1, offset: 2}
          }
        },
        {
          type: 'text',
          value: 'b',
          position: {
            start: {line: 2, column: 1, offset: 2},
            end: {line: 2, column: 2, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 2, column: 2, offset: 3}
      }
    },
    'should support multiple extensions'
  )

  t.deepEqual(
    fromMarkdown('*a*', {
      mdastExtensions: [
        {
          transforms: [
            function (tree) {
              assert(tree.children[0].type === 'paragraph')
              tree.children[0].children[0].type = 'strong'
            }
          ]
        }
      ]
    }).children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'strong',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 3, offset: 2}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 4, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 4, offset: 3}
      }
    },
    'should support `transforms` in extensions'
  )

  t.throws(
    () => {
      fromMarkdown('a', {
        mdastExtensions: [
          {
            enter: {
              paragraph(token) {
                this.enter({type: 'paragraph', children: []}, token)
              }
            },
            exit: {paragraph() {}}
          }
        ]
      })
    },
    /Cannot close document, a token \(`paragraph`, 1:1-1:2\) is still open/,
    'should crash if a token is opened but not closed'
  )

  t.throws(
    () => {
      fromMarkdown('a', {
        mdastExtensions: [
          {
            enter: {
              paragraph(token) {
                this.exit(token)
              }
            }
          }
        ]
      })
    },
    /Cannot close `paragraph` \(1:1-1:2\): it’s not open/,
    'should crash when closing a token that isn’t open'
  )

  t.throws(
    () => {
      fromMarkdown('a', {
        mdastExtensions: [
          {
            exit: {
              paragraph(token) {
                this.exit(Object.assign({}, token, {type: 'lol'}))
              }
            }
          }
        ]
      })
    },
    /Cannot close `lol` \(1:1-1:2\): a different token \(`paragraph`, 1:1-1:2\) is open/,
    'should crash when closing a token when a different one is open'
  )

  t.throws(
    () => {
      fromMarkdown('a', {
        mdastExtensions: [
          {
            exit: {
              paragraph(token) {
                this.exit(
                  Object.assign({}, token, {type: 'lol'}),
                  function (a, b) {
                    t.equal(a.type, 'lol')
                    t.equal(b.type, 'paragraph')
                    throw new Error('problem')
                  }
                )
              }
            }
          }
        ]
      })
    },
    /problem/,
    'should crash when closing a token when a different one is open with a custom handler'
  )

  t.deepEqual(
    fromMarkdown('<tel:123>').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'link',
          title: null,
          url: 'tel:123',
          children: [
            {
              type: 'text',
              value: 'tel:123',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 9, offset: 8}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 10, offset: 9}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 10, offset: 9}
      }
    },
    'should parse an autolink (protocol)'
  )

  t.deepEqual(
    fromMarkdown('<aa@bb.cc>').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'link',
          title: null,
          url: 'mailto:aa@bb.cc',
          children: [
            {
              type: 'text',
              value: 'aa@bb.cc',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 10, offset: 9}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 11, offset: 10}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 11, offset: 10}
      }
    },
    'should parse an autolink (email)'
  )

  t.deepEqual(
    fromMarkdown('> a').children[0],
    {
      type: 'blockquote',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 3, offset: 2},
                end: {line: 1, column: 4, offset: 3}
              }
            }
          ],
          position: {
            start: {line: 1, column: 3, offset: 2},
            end: {line: 1, column: 4, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 4, offset: 3}
      }
    },
    'should parse a block quote'
  )

  t.deepEqual(
    fromMarkdown('a\\*b').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          value: 'a*b',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 5, offset: 4}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 5, offset: 4}
      }
    },
    'should parse a character escape'
  )

  t.deepEqual(
    fromMarkdown('a&amp;b').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          value: 'a&b',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 8, offset: 7}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 8, offset: 7}
      }
    },
    'should parse a character reference'
  )

  t.deepEqual(
    fromMarkdown('```a b\nc\n```').children[0],
    {
      type: 'code',
      lang: 'a',
      meta: 'b',
      value: 'c',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 3, column: 4, offset: 12}
      }
    },
    'should parse code (fenced)'
  )

  t.deepEqual(
    fromMarkdown('    a').children[0],
    {
      type: 'code',
      lang: null,
      meta: null,
      value: 'a',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 6, offset: 5}
      }
    },
    'should parse code (indented)'
  )

  t.deepEqual(
    fromMarkdown('`a`').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'inlineCode',
          value: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 4, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 4, offset: 3}
      }
    },
    'should parse code (text)'
  )

  t.deepEqual(
    fromMarkdown('[a]: b "c"').children[0],
    {
      type: 'definition',
      identifier: 'a',
      label: 'a',
      title: 'c',
      url: 'b',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 11, offset: 10}
      }
    },
    'should parse a definition'
  )

  t.deepEqual(
    fromMarkdown('*a*').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'emphasis',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 3, offset: 2}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 4, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 4, offset: 3}
      }
    },
    'should parse emphasis'
  )

  t.deepEqual(
    fromMarkdown('a\\\nb').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          value: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 2, offset: 1}
          }
        },
        {
          type: 'break',
          position: {
            start: {line: 1, column: 2, offset: 1},
            end: {line: 2, column: 1, offset: 3}
          }
        },
        {
          type: 'text',
          value: 'b',
          position: {
            start: {line: 2, column: 1, offset: 3},
            end: {line: 2, column: 2, offset: 4}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 2, column: 2, offset: 4}
      }
    },
    'should parse a hard break (escape)'
  )

  t.deepEqual(
    fromMarkdown('a  \nb').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          value: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 2, offset: 1}
          }
        },
        {
          type: 'break',
          position: {
            start: {line: 1, column: 2, offset: 1},
            end: {line: 2, column: 1, offset: 4}
          }
        },
        {
          type: 'text',
          value: 'b',
          position: {
            start: {line: 2, column: 1, offset: 4},
            end: {line: 2, column: 2, offset: 5}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 2, column: 2, offset: 5}
      }
    },
    'should parse a hard break (prefix)'
  )

  t.deepEqual(
    fromMarkdown('## a').children[0],
    {
      type: 'heading',
      depth: 2,
      children: [
        {
          type: 'text',
          value: 'a',
          position: {
            start: {line: 1, column: 4, offset: 3},
            end: {line: 1, column: 5, offset: 4}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 5, offset: 4}
      }
    },
    'should parse a heading (atx)'
  )

  t.deepEqual(
    fromMarkdown('a\n=').children[0],
    {
      type: 'heading',
      depth: 1,
      children: [
        {
          type: 'text',
          value: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 2, offset: 1}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 2, column: 2, offset: 3}
      }
    },
    'should parse a heading (setext)'
  )

  t.deepEqual(
    fromMarkdown('<a>\nb\n</a>').children[0],
    {
      type: 'html',
      value: '<a>\nb\n</a>',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 3, column: 5, offset: 10}
      }
    },
    'should parse html (flow)'
  )

  t.deepEqual(
    fromMarkdown('<a>b</a>').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'html',
          value: '<a>',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 4, offset: 3}
          }
        },
        {
          type: 'text',
          value: 'b',
          position: {
            start: {line: 1, column: 4, offset: 3},
            end: {line: 1, column: 5, offset: 4}
          }
        },
        {
          type: 'html',
          value: '</a>',
          position: {
            start: {line: 1, column: 5, offset: 4},
            end: {line: 1, column: 9, offset: 8}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 9, offset: 8}
      }
    },
    'should parse html (text)'
  )

  t.deepEqual(
    fromMarkdown('![a]\n\n[a]: b').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'imageReference',
          identifier: 'a',
          label: 'a',
          referenceType: 'shortcut',
          alt: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 5, offset: 4}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 5, offset: 4}
      }
    },
    'should parse an image (shortcut reference)'
  )

  t.deepEqual(
    fromMarkdown('![a][]\n\n[a]: b').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'imageReference',
          identifier: 'a',
          label: 'a',
          referenceType: 'collapsed',
          alt: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 7, offset: 6}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 7, offset: 6}
      }
    },
    'should parse an image (collapsed reference)'
  )

  t.deepEqual(
    fromMarkdown('![a][b]\n\n[b]: c').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'imageReference',
          identifier: 'b',
          label: 'b',
          referenceType: 'full',
          alt: 'a',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 8, offset: 7}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 8, offset: 7}
      }
    },
    'should parse an image (full reference)'
  )

  t.deepEqual(
    fromMarkdown('![a](b "c")').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'image',
          title: 'c',
          alt: 'a',
          url: 'b',
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 12, offset: 11}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 12, offset: 11}
      }
    },
    'should parse an image (resource)'
  )

  t.deepEqual(
    fromMarkdown('[a]\n\n[a]: b').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'linkReference',
          identifier: 'a',
          label: 'a',
          referenceType: 'shortcut',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 3, offset: 2}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 4, offset: 3}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 4, offset: 3}
      }
    },
    'should parse a link (shortcut reference)'
  )

  t.deepEqual(
    fromMarkdown('[a][]\n\n[a]: b').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'linkReference',
          identifier: 'a',
          label: 'a',
          referenceType: 'collapsed',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 3, offset: 2}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 6, offset: 5}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 6, offset: 5}
      }
    },
    'should parse a link (collapsed reference)'
  )

  t.deepEqual(
    fromMarkdown('[`a`][]\n\n[`a`]: b').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'linkReference',
          children: [
            {
              type: 'inlineCode',
              value: 'a',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 5, offset: 4}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 8, offset: 7}
          },
          identifier: '`a`',
          label: '`a`',
          referenceType: 'collapsed'
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 8, offset: 7}
      }
    },
    'should parse a link (collapsed reference) with inline code in the label'
  )

  t.deepEqual(
    fromMarkdown('[a][b]\n\n[b]: c').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'linkReference',
          identifier: 'b',
          label: 'b',
          referenceType: 'full',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 3, offset: 2}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 7, offset: 6}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 7, offset: 6}
      }
    },
    'should parse a link (full reference)'
  )

  t.deepEqual(
    fromMarkdown('[a](b "c")').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'link',
          title: 'c',
          url: 'b',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 2, offset: 1},
                end: {line: 1, column: 3, offset: 2}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 11, offset: 10}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 11, offset: 10}
      }
    },
    'should parse a link (resource)'
  )

  // List.

  t.deepEqual(
    fromMarkdown('**a**').children[0],
    {
      type: 'paragraph',
      children: [
        {
          type: 'strong',
          children: [
            {
              type: 'text',
              value: 'a',
              position: {
                start: {line: 1, column: 3, offset: 2},
                end: {line: 1, column: 4, offset: 3}
              }
            }
          ],
          position: {
            start: {line: 1, column: 1, offset: 0},
            end: {line: 1, column: 6, offset: 5}
          }
        }
      ],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 6, offset: 5}
      }
    },
    'should parse strong'
  )

  t.deepEqual(
    fromMarkdown('***').children[0],
    {
      type: 'thematicBreak',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 4, offset: 3}
      }
    },
    'should parse a thematic break'
  )

  t.end()
})

test('fixtures', async (t) => {
  const base = new URL('fixtures/', import.meta.url)

  const files = await fs.readdir(base)
  let index = -1

  while (++index < files.length) {
    const file = files[index]

    if (!/\.md$/i.test(file)) {
      continue
    }

    const stem = file.split('.').slice(0, -1).join('.')
    const fp = new URL(stem + '.json', base)
    const doc = await fs.readFile(new URL(file, base))
    const actual = fromMarkdown(doc)
    /** @type {Root} */
    let expected

    try {
      expected = JSON.parse(String(await fs.readFile(fp)))
    } catch {
      // New fixture.
      expected = actual
      await fs.writeFile(fp, JSON.stringify(actual, null, 2) + '\n')
    }

    t.deepEqual(actual, expected, stem)
  }

  t.end()
})

test('commonmark', (t) => {
  let index = -1

  // To do: update micromark.
  // Changes in living version of CommonMark.
  const skip = new Set([623, 624])

  while (++index < commonmark.length) {
    if (skip.has(index)) {
      continue
    }

    const example = commonmark[index]
    const input = example.markdown.slice(0, -1)
    const output = example.html.slice(0, -1)

    const mdast = fromMarkdown(input)
    const hast = toHast(mdast, {allowDangerousHtml: true})
    assert(hast && hast.type === 'root', 'expected `root`')
    const actual = toHtml(hast, {allowDangerousHtml: true})

    t.deepLooseEqual(
      toHtml(fromHtml(actual, {fragment: true})),
      toHtml(fromHtml(output, {fragment: true})),
      example.section + ' (' + index + ')'
    )
  }

  t.end()
})
