/**
 * @typedef {import('mdast').Root} Root
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import {commonmark} from 'commonmark.json'
import {fromHtml} from 'hast-util-from-html'
import {toHtml} from 'hast-util-to-html'
import {toHast} from 'mdast-util-to-hast'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {toString} from 'mdast-util-to-string'

test('fromMarkdown', async function (t) {
  await t.test('should expose the public api', async function () {
    assert.deepEqual(
      Object.keys(await import('mdast-util-from-markdown')).sort(),
      ['fromMarkdown']
    )
  })

  await t.test('should parse an empty document', async function () {
    assert.deepEqual(fromMarkdown(''), {
      type: 'root',
      children: [],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 1, offset: 0}
      }
    })
  })

  await t.test('should parse a paragraph', async function () {
    assert.deepEqual(fromMarkdown('a\nb'), {
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
    })
  })

  await t.test('should support empty typed arrays', async function () {
    assert.deepEqual(fromMarkdown(new Uint8Array()), {
      type: 'root',
      children: [],
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 1, offset: 0}
      }
    })
  })

  await t.test('should support types arrays', async function () {
    assert.equal(
      toString(fromMarkdown(new TextEncoder().encode('<admin@example.com>'))),
      'admin@example.com'
    )
  })

  await t.test('should support encoding', async function () {
    assert.equal(
      toString(
        fromMarkdown(
          new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00]),
          'utf-16le'
        )
      ),
      'abc'
    )
  })

  await t.test('should support extensions', async function () {
    assert.deepEqual(
      fromMarkdown('a\nb', {
        mdastExtensions: [
          {
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
      }
    )
  })

  await t.test('should support multiple extensions', async function () {
    assert.deepEqual(
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
      }
    )
  })

  await t.test('should support `transforms` in extensions', async function () {
    assert.deepEqual(
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
      }
    )
  })

  await t.test(
    'should crash if a token is opened but not closed',
    async function () {
      assert.throws(function () {
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
      }, /Cannot close document, a token \(`paragraph`, 1:1-1:2\) is still open/)
    }
  )

  await t.test(
    'should crash when closing a token that isn’t open',
    async function () {
      assert.throws(function () {
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
      }, /Cannot close `paragraph` \(1:1-1:2\): it’s not open/)
    }
  )

  await t.test(
    'should crash when closing a token when a different one is open',
    async function () {
      assert.throws(function () {
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
      }, /Cannot close `lol` \(1:1-1:2\): a different token \(`paragraph`, 1:1-1:2\) is open/)
    }
  )

  await t.test(
    'should crash when closing a token when a different one is open with a custom handler',
    async function () {
      assert.throws(function () {
        fromMarkdown('a', {
          mdastExtensions: [
            {
              exit: {
                paragraph(token) {
                  this.exit(
                    Object.assign({}, token, {type: 'lol'}),
                    function (a, b) {
                      assert.equal(a.type, 'lol')
                      assert.equal(b.type, 'paragraph')
                      throw new Error('problem')
                    }
                  )
                }
              }
            }
          ]
        })
      }, /problem/)
    }
  )

  await t.test('should parse an autolink (protocol)', async function () {
    assert.deepEqual(fromMarkdown('<tel:123>').children[0], {
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
    })
  })

  await t.test('should parse an autolink (email)', async function () {
    assert.deepEqual(fromMarkdown('<aa@bb.cc>').children[0], {
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
    })
  })

  await t.test('should parse a block quote', async function () {
    assert.deepEqual(fromMarkdown('> a').children[0], {
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
    })
  })

  await t.test('should parse a character escape', async function () {
    assert.deepEqual(fromMarkdown('a\\*b').children[0], {
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
    })
  })

  await t.test('should parse a character reference', async function () {
    assert.deepEqual(fromMarkdown('a&amp;b').children[0], {
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
    })
  })

  await t.test('should parse code (fenced)', async function () {
    assert.deepEqual(fromMarkdown('```a b\nc\n```').children[0], {
      type: 'code',
      lang: 'a',
      meta: 'b',
      value: 'c',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 3, column: 4, offset: 12}
      }
    })
  })

  await t.test('should parse code (indented)', async function () {
    assert.deepEqual(fromMarkdown('    a').children[0], {
      type: 'code',
      lang: null,
      meta: null,
      value: 'a',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 6, offset: 5}
      }
    })
  })

  await t.test('should parse code (text)', async function () {
    assert.deepEqual(fromMarkdown('`a`').children[0], {
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
    })
  })

  await t.test('should parse a definition', async function () {
    assert.deepEqual(fromMarkdown('[a]: b "c"').children[0], {
      type: 'definition',
      identifier: 'a',
      label: 'a',
      title: 'c',
      url: 'b',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 11, offset: 10}
      }
    })
  })

  await t.test('should parse emphasis', async function () {
    assert.deepEqual(fromMarkdown('*a*').children[0], {
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
    })
  })

  await t.test('should parse a hard break (escape)', async function () {
    assert.deepEqual(fromMarkdown('a\\\nb').children[0], {
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
    })
  })

  await t.test('should parse a hard break (prefix)', async function () {
    assert.deepEqual(fromMarkdown('a  \nb').children[0], {
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
    })
  })

  await t.test('should parse a heading (atx)', async function () {
    assert.deepEqual(fromMarkdown('## a').children[0], {
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
    })
  })

  await t.test('should parse a heading (setext)', async function () {
    assert.deepEqual(fromMarkdown('a\n=').children[0], {
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
    })
  })

  await t.test('should parse html (flow)', async function () {
    assert.deepEqual(fromMarkdown('<a>\nb\n</a>').children[0], {
      type: 'html',
      value: '<a>\nb\n</a>',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 3, column: 5, offset: 10}
      }
    })
  })

  await t.test('should parse html (text)', async function () {
    assert.deepEqual(fromMarkdown('<a>b</a>').children[0], {
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
    })
  })

  await t.test('should parse an image (shortcut reference)', async function () {
    assert.deepEqual(fromMarkdown('![a]\n\n[a]: b').children[0], {
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
    })
  })

  await t.test(
    'should parse an image (collapsed reference)',
    async function () {
      assert.deepEqual(fromMarkdown('![a][]\n\n[a]: b').children[0], {
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
      })
    }
  )

  await t.test('should parse an image (full reference)', async function () {
    assert.deepEqual(fromMarkdown('![a][b]\n\n[b]: c').children[0], {
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
    })
  })

  await t.test('should parse an image (resource)', async function () {
    assert.deepEqual(fromMarkdown('![a](b "c")').children[0], {
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
    })
  })

  await t.test('should parse a link (shortcut reference)', async function () {
    assert.deepEqual(fromMarkdown('[a]\n\n[a]: b').children[0], {
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
    })
  })

  await t.test('should parse a link (collapsed reference)', async function () {
    assert.deepEqual(fromMarkdown('[a][]\n\n[a]: b').children[0], {
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
    })
  })

  await t.test(
    'should parse a link (collapsed reference) with inline code in the label',
    async function () {
      assert.deepEqual(fromMarkdown('[`a`][]\n\n[`a`]: b').children[0], {
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
      })
    }
  )

  await t.test('should parse a link (full reference)', async function () {
    assert.deepEqual(fromMarkdown('[a][b]\n\n[b]: c').children[0], {
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
    })
  })

  await t.test('should parse a link (resource)', async function () {
    assert.deepEqual(fromMarkdown('[a](b "c")').children[0], {
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
    })
  })

  await t.test('should parse strong', async function () {
    // List.

    assert.deepEqual(fromMarkdown('**a**').children[0], {
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
    })
  })

  await t.test('should parse a thematic break', async function () {
    assert.deepEqual(fromMarkdown('***').children[0], {
      type: 'thematicBreak',
      position: {
        start: {line: 1, column: 1, offset: 0},
        end: {line: 1, column: 4, offset: 3}
      }
    })
  })
})

test('fixtures', async function (t) {
  const base = new URL('fixtures/', import.meta.url)

  const files = await fs.readdir(base)
  let index = -1

  while (++index < files.length) {
    const file = files[index]

    if (!/\.md$/i.test(file)) {
      continue
    }

    const stem = file.split('.').slice(0, -1).join('.')

    await t.test(stem, async function () {
      const fp = new URL(stem + '.json', base)
      const document = await fs.readFile(new URL(file, base))
      const actual = fromMarkdown(document)
      /** @type {Root} */
      let expected

      try {
        expected = JSON.parse(String(await fs.readFile(fp)))
      } catch {
        // New fixture.
        expected = actual
        await fs.writeFile(fp, JSON.stringify(actual, undefined, 2) + '\n')
      }

      assert.deepEqual(actual, expected, stem)
    })
  }
})

test('commonmark', async function (t) {
  let index = -1

  while (++index < commonmark.length) {
    const example = commonmark[index]

    await t.test(example.section + ' (' + index + ')', async function () {
      const input = example.markdown.slice(0, -1)
      const output = example.html.slice(0, -1)

      const mdast = fromMarkdown(input)
      const hast = toHast(mdast, {allowDangerousHtml: true})
      assert(hast && hast.type === 'root', 'expected `root`')
      const actual = toHtml(hast, {allowDangerousHtml: true})

      assert.equal(
        toHtml(fromHtml(actual, {fragment: true})),
        toHtml(fromHtml(output, {fragment: true}))
      )
    })
  }
})
