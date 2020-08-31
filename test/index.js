'use strict'

var fs = require('fs')
var path = require('path')
var test = require('tape')
var unified = require('unified')
var parse = require('remark-parse')
var visit = require('unist-util-visit')
var fromMarkdown = require('..')

var join = path.join

test('mdast-util-from-markdown', function (t) {
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

test('fixtures', function (t) {
  var base = join('test', 'fixtures')

  // These are different (in a good way) from remark.
  var fixesRemark = [
    'attention',
    'code-indented',
    'definition',
    'hard-break-escape',
    'hard-break-prefix',
    'heading-setext',
    'html-text',
    'image-reference',
    'image-resource',
    'link-reference',
    'link-resource',
    'list'
  ]

  fs.readdirSync(base)
    .filter((d) => path.extname(d) === '.md')
    .forEach((d) => each(path.basename(d, path.extname(d))))

  t.end()

  function each(stem) {
    var fp = join(base, stem + '.json')
    var doc = fs.readFileSync(join(base, stem + '.md'))
    var actual = fromMarkdown(doc)
    var remarkTree = remarkLegacyParse(String(doc))
    var expected

    try {
      expected = JSON.parse(fs.readFileSync(fp))
    } catch (_) {
      // New fixture.
      expected = actual
      fs.writeFileSync(fp, JSON.stringify(actual, null, 2) + '\n')
    }

    t.deepEqual(actual, expected, stem)

    if (fixesRemark.includes(stem)) return

    t.deepEqual(actual, remarkTree, stem + ' (remark)')
  }
})

function remarkLegacyParse(doc) {
  var processor = unified().use(parse, {commonmark: true}).use(clean)
  return processor.runSync(processor.parse(doc))
}

function clean() {
  return transform

  function transform(tree) {
    visit(tree, (node, index, parent) => {
      var siblings = parent ? parent.children : []
      var previous = siblings[index - 1]

      // Drop don’t do indent anymore.
      delete node.position.indent

      // Collapse text nodes.
      if (previous && node.type === previous.type && node.type === 'text') {
        previous.value += node.value

        siblings.splice(index, 1)

        if (previous.position && node.position) {
          previous.position.end = node.position.end
        }

        return index
      }
    })

    return JSON.parse(JSON.stringify(tree))
  }
}
