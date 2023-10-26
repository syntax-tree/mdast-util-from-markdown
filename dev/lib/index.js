/**
 * @typedef {import('mdast').Break} Break
 * @typedef {import('mdast').Blockquote} Blockquote
 * @typedef {import('mdast').Code} Code
 * @typedef {import('mdast').Definition} Definition
 * @typedef {import('mdast').Emphasis} Emphasis
 * @typedef {import('mdast').Heading} Heading
 * @typedef {import('mdast').Html} Html
 * @typedef {import('mdast').Image} Image
 * @typedef {import('mdast').InlineCode} InlineCode
 * @typedef {import('mdast').Link} Link
 * @typedef {import('mdast').List} List
 * @typedef {import('mdast').ListItem} ListItem
 * @typedef {import('mdast').Nodes} Nodes
 * @typedef {import('mdast').Paragraph} Paragraph
 * @typedef {import('mdast').Parent} Parent
 * @typedef {import('mdast').PhrasingContent} PhrasingContent
 * @typedef {import('mdast').ReferenceType} ReferenceType
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').Strong} Strong
 * @typedef {import('mdast').Text} Text
 * @typedef {import('mdast').ThematicBreak} ThematicBreak
 *
 * @typedef {import('micromark-util-types').Encoding} Encoding
 * @typedef {import('micromark-util-types').Event} Event
 * @typedef {import('micromark-util-types').ParseOptions} ParseOptions
 * @typedef {import('micromark-util-types').Token} Token
 * @typedef {import('micromark-util-types').TokenizeContext} TokenizeContext
 * @typedef {import('micromark-util-types').Value} Value
 *
 * @typedef {import('unist').Point} Point
 *
 * @typedef {import('../index.js').CompileData} CompileData
 */

/**
 * @typedef {Omit<Parent, 'children' | 'type'> & {type: 'fragment', children: Array<PhrasingContent>}} Fragment
 */

/**
 * @callback Transform
 *   Extra transform, to change the AST afterwards.
 * @param {Root} tree
 *   Tree to transform.
 * @returns {Root | null | undefined | void}
 *   New tree or nothing (in which case the current tree is used).
 *
 * @callback Handle
 *   Handle a token.
 * @param {CompileContext} this
 *   Context.
 * @param {Token} token
 *   Current token.
 * @returns {undefined | void}
 *   Nothing.
 *
 * @typedef {Record<string, Handle>} Handles
 *   Token types mapping to handles
 *
 * @callback OnEnterError
 *   Handle the case where the `right` token is open, but it is closed (by the
 *   `left` token) or because we reached the end of the document.
 * @param {Omit<CompileContext, 'sliceSerialize'>} this
 *   Context.
 * @param {Token | undefined} left
 *   Left token.
 * @param {Token} right
 *   Right token.
 * @returns {undefined}
 *   Nothing.
 *
 * @callback OnExitError
 *   Handle the case where the `right` token is open but it is closed by
 *   exiting the `left` token.
 * @param {Omit<CompileContext, 'sliceSerialize'>} this
 *   Context.
 * @param {Token} left
 *   Left token.
 * @param {Token} right
 *   Right token.
 * @returns {undefined}
 *   Nothing.
 *
 * @typedef {[Token, OnEnterError | undefined]} TokenTuple
 *   Open token on the stack, with an optional error handler for when
 *   that token isn’t closed properly.
 */

/**
 * @typedef Config
 *   Configuration.
 *
 *   We have our defaults, but extensions will add more.
 * @property {Array<string>} canContainEols
 *   Token types where line endings are used.
 * @property {Handles} enter
 *   Opening handles.
 * @property {Handles} exit
 *   Closing handles.
 * @property {Array<Transform>} transforms
 *   Tree transforms.
 *
 * @typedef {Partial<Config>} Extension
 *   Change how markdown tokens from micromark are turned into mdast.
 *
 * @typedef CompileContext
 *   mdast compiler context.
 * @property {Array<Fragment | Nodes>} stack
 *   Stack of nodes.
 * @property {Array<TokenTuple>} tokenStack
 *   Stack of tokens.
 * @property {(this: CompileContext) => undefined} buffer
 *   Capture some of the output data.
 * @property {(this: CompileContext) => string} resume
 *   Stop capturing and access the output data.
 * @property {(this: CompileContext, node: Nodes, token: Token, onError?: OnEnterError) => undefined} enter
 *   Enter a node.
 * @property {(this: CompileContext, token: Token, onError?: OnExitError) => undefined} exit
 *   Exit a node.
 * @property {TokenizeContext['sliceSerialize']} sliceSerialize
 *   Get the string value of a token.
 * @property {Config} config
 *   Configuration.
 * @property {CompileData} data
 *   Info passed around; key/value store.
 *
 * @typedef FromMarkdownOptions
 *   Configuration for how to build mdast.
 * @property {Array<Extension | Array<Extension>> | null | undefined} [mdastExtensions]
 *   Extensions for this utility to change how tokens are turned into a tree.
 *
 * @typedef {ParseOptions & FromMarkdownOptions} Options
 *   Configuration.
 */

import {ok as assert} from 'devlop'
import {toString} from 'mdast-util-to-string'
import {parse, postprocess, preprocess} from 'micromark'
import {decodeNumericCharacterReference} from 'micromark-util-decode-numeric-character-reference'
import {decodeString} from 'micromark-util-decode-string'
import {normalizeIdentifier} from 'micromark-util-normalize-identifier'
import {codes, constants, types} from 'micromark-util-symbol'
import {decodeNamedCharacterReference} from 'decode-named-character-reference'
import {stringifyPosition} from 'unist-util-stringify-position'

const own = {}.hasOwnProperty

/**
 * Turn markdown into a syntax tree.
 *
 * @overload
 * @param {Value} value
 * @param {Encoding | null | undefined} [encoding]
 * @param {Options | null | undefined} [options]
 * @returns {Root}
 *
 * @overload
 * @param {Value} value
 * @param {Options | null | undefined} [options]
 * @returns {Root}
 *
 * @param {Value} value
 *   Markdown to parse.
 * @param {Encoding | Options | null | undefined} [encoding]
 *   Character encoding for when `value` is `Buffer`.
 * @param {Options | null | undefined} [options]
 *   Configuration.
 * @returns {Root}
 *   mdast tree.
 */
export function fromMarkdown(value, encoding, options) {
  if (typeof encoding !== 'string') {
    options = encoding
    encoding = undefined
  }

  return compiler(options)(
    postprocess(
      parse(options)
        .document()
        .write(preprocess()(value, encoding, true))
    )
  )
}

/**
 * Note this compiler only understand complete buffering, not streaming.
 *
 * @param {Options | null | undefined} [options]
 */
function compiler(options) {
  /** @type {Config} */
  const config = {
    transforms: [],
    canContainEols: ['emphasis', 'fragment', 'heading', 'paragraph', 'strong'],
    enter: {
      autolink: opener(link),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading),
      blockQuote: opener(blockQuote),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis),
      hardBreakEscape: opener(hardBreak),
      hardBreakTrailing: opener(hardBreak),
      htmlFlow: opener(html, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html, buffer),
      htmlTextData: onenterdata,
      image: opener(image),
      label: buffer,
      link: opener(link),
      listItem: opener(listItem),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list, onenterlistordered),
      listUnordered: opener(list),
      paragraph: opener(paragraph),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading),
      strong: opener(strong),
      thematicBreak: opener(thematicBreak)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: onexitcharacterreferencevalue,
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  }

  configure(config, (options || {}).mdastExtensions || [])

  /** @type {CompileData} */
  const data = {}

  return compile

  /**
   * Turn micromark events into an mdast tree.
   *
   * @param {Array<Event>} events
   *   Events.
   * @returns {Root}
   *   mdast tree.
   */
  function compile(events) {
    /** @type {Root} */
    let tree = {type: 'root', children: []}
    /** @type {Omit<CompileContext, 'sliceSerialize'>} */
    const context = {
      stack: [tree],
      tokenStack: [],
      config,
      enter,
      exit,
      buffer,
      resume,
      data
    }
    /** @type {Array<number>} */
    const listStack = []
    let index = -1

    while (++index < events.length) {
      // We preprocess lists to add `listItem` tokens, and to infer whether
      // items the list itself are spread out.
      if (
        events[index][1].type === types.listOrdered ||
        events[index][1].type === types.listUnordered
      ) {
        if (events[index][0] === 'enter') {
          listStack.push(index)
        } else {
          const tail = listStack.pop()
          assert(typeof tail === 'number', 'expected list ot be open')
          index = prepareList(events, tail, index)
        }
      }
    }

    index = -1

    while (++index < events.length) {
      const handler = config[events[index][0]]

      if (own.call(handler, events[index][1].type)) {
        handler[events[index][1].type].call(
          Object.assign(
            {sliceSerialize: events[index][2].sliceSerialize},
            context
          ),
          events[index][1]
        )
      }
    }

    // Handle tokens still being open.
    if (context.tokenStack.length > 0) {
      const tail = context.tokenStack[context.tokenStack.length - 1]
      const handler = tail[1] || defaultOnError
      handler.call(context, undefined, tail[0])
    }

    // Figure out `root` position.
    tree.position = {
      start: point(
        events.length > 0 ? events[0][1].start : {line: 1, column: 1, offset: 0}
      ),
      end: point(
        events.length > 0
          ? events[events.length - 2][1].end
          : {line: 1, column: 1, offset: 0}
      )
    }

    // Call transforms.
    index = -1
    while (++index < config.transforms.length) {
      tree = config.transforms[index](tree) || tree
    }

    return tree
  }

  /**
   * @param {Array<Event>} events
   * @param {number} start
   * @param {number} length
   * @returns {number}
   */
  function prepareList(events, start, length) {
    let index = start - 1
    let containerBalance = -1
    let listSpread = false
    /** @type {Token | undefined} */
    let listItem
    /** @type {number | undefined} */
    let lineIndex
    /** @type {number | undefined} */
    let firstBlankLineIndex
    /** @type {boolean | undefined} */
    let atMarker

    while (++index <= length) {
      const event = events[index]

      switch (event[1].type) {
        case types.listUnordered:
        case types.listOrdered:
        case types.blockQuote: {
          if (event[0] === 'enter') {
            containerBalance++
          } else {
            containerBalance--
          }

          atMarker = undefined

          break
        }

        case types.lineEndingBlank: {
          if (event[0] === 'enter') {
            if (
              listItem &&
              !atMarker &&
              !containerBalance &&
              !firstBlankLineIndex
            ) {
              firstBlankLineIndex = index
            }

            atMarker = undefined
          }

          break
        }

        case types.linePrefix:
        case types.listItemValue:
        case types.listItemMarker:
        case types.listItemPrefix:
        case types.listItemPrefixWhitespace: {
          // Empty.

          break
        }

        default: {
          atMarker = undefined
        }
      }

      if (
        (!containerBalance &&
          event[0] === 'enter' &&
          event[1].type === types.listItemPrefix) ||
        (containerBalance === -1 &&
          event[0] === 'exit' &&
          (event[1].type === types.listUnordered ||
            event[1].type === types.listOrdered))
      ) {
        if (listItem) {
          let tailIndex = index
          lineIndex = undefined

          while (tailIndex--) {
            const tailEvent = events[tailIndex]

            if (
              tailEvent[1].type === types.lineEnding ||
              tailEvent[1].type === types.lineEndingBlank
            ) {
              if (tailEvent[0] === 'exit') continue

              if (lineIndex) {
                events[lineIndex][1].type = types.lineEndingBlank
                listSpread = true
              }

              tailEvent[1].type = types.lineEnding
              lineIndex = tailIndex
            } else if (
              tailEvent[1].type === types.linePrefix ||
              tailEvent[1].type === types.blockQuotePrefix ||
              tailEvent[1].type === types.blockQuotePrefixWhitespace ||
              tailEvent[1].type === types.blockQuoteMarker ||
              tailEvent[1].type === types.listItemIndent
            ) {
              // Empty
            } else {
              break
            }
          }

          if (
            firstBlankLineIndex &&
            (!lineIndex || firstBlankLineIndex < lineIndex)
          ) {
            listItem._spread = true
          }

          // Fix position.
          listItem.end = Object.assign(
            {},
            lineIndex ? events[lineIndex][1].start : event[1].end
          )

          events.splice(lineIndex || index, 0, ['exit', listItem, event[2]])
          index++
          length++
        }

        // Create a new list item.
        if (event[1].type === types.listItemPrefix) {
          /** @type {Token} */
          const item = {
            type: 'listItem',
            _spread: false,
            start: Object.assign({}, event[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: undefined
          }
          listItem = item
          events.splice(index, 0, ['enter', item, event[2]])
          index++
          length++
          firstBlankLineIndex = undefined
          atMarker = true
        }
      }
    }

    events[start][1]._spread = listSpread
    return length
  }

  /**
   * Create an opener handle.
   *
   * @param {(token: Token) => Nodes} create
   *   Create a node.
   * @param {Handle | undefined} [and]
   *   Optional function to also run.
   * @returns {Handle}
   *   Handle.
   */
  function opener(create, and) {
    return open

    /**
     * @this {CompileContext}
     * @param {Token} token
     * @returns {undefined}
     */
    function open(token) {
      enter.call(this, create(token), token)
      if (and) and.call(this, token)
    }
  }

  /**
   * @this {CompileContext}
   * @returns {undefined}
   */
  function buffer() {
    this.stack.push({type: 'fragment', children: []})
  }

  /**
   * @this {CompileContext}
   *   Context.
   * @param {Nodes} node
   *   Node to enter.
   * @param {Token} token
   *   Corresponding token.
   * @param {OnEnterError | undefined} [errorHandler]
   *   Handle the case where this token is open, but it is closed by something else.
   * @returns {undefined}
   *   Nothing.
   */
  function enter(node, token, errorHandler) {
    const parent = this.stack[this.stack.length - 1]
    assert(parent, 'expected `parent`')
    assert('children' in parent, 'expected `parent`')
    /** @type {Array<Nodes>} */
    const siblings = parent.children
    siblings.push(node)
    this.stack.push(node)
    this.tokenStack.push([token, errorHandler])
    node.position = {
      start: point(token.start),
      // @ts-expect-error: `end` will be patched later.
      end: undefined
    }
  }

  /**
   * Create a closer handle.
   *
   * @param {Handle | undefined} [and]
   *   Optional function to also run.
   * @returns {Handle}
   *   Handle.
   */
  function closer(and) {
    return close

    /**
     * @this {CompileContext}
     * @param {Token} token
     * @returns {undefined}
     */
    function close(token) {
      if (and) and.call(this, token)
      exit.call(this, token)
    }
  }

  /**
   * @this {CompileContext}
   *   Context.
   * @param {Token} token
   *   Corresponding token.
   * @param {OnExitError | undefined} [onExitError]
   *   Handle the case where another token is open.
   * @returns {undefined}
   *   Nothing.
   */
  function exit(token, onExitError) {
    const node = this.stack.pop()
    assert(node, 'expected `node`')
    const open = this.tokenStack.pop()

    if (!open) {
      throw new Error(
        'Cannot close `' +
          token.type +
          '` (' +
          stringifyPosition({start: token.start, end: token.end}) +
          '): it’s not open'
      )
    } else if (open[0].type !== token.type) {
      if (onExitError) {
        onExitError.call(this, token, open[0])
      } else {
        const handler = open[1] || defaultOnError
        handler.call(this, token, open[0])
      }
    }

    assert(node.type !== 'fragment', 'unexpected fragment `exit`ed')
    assert(node.position, 'expected `position` to be defined')
    node.position.end = point(token.end)
  }

  /**
   * @this {CompileContext}
   * @returns {string}
   */
  function resume() {
    return toString(this.stack.pop())
  }

  //
  // Handlers.
  //

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onenterlistordered() {
    this.data.expectingFirstListItemValue = true
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onenterlistitemvalue(token) {
    if (this.data.expectingFirstListItemValue) {
      const ancestor = this.stack[this.stack.length - 2]
      assert(ancestor, 'expected nodes on stack')
      assert(ancestor.type === 'list', 'expected list on stack')
      ancestor.start = Number.parseInt(
        this.sliceSerialize(token),
        constants.numericBaseDecimal
      )
      this.data.expectingFirstListItemValue = undefined
    }
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitcodefencedfenceinfo() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'code', 'expected code on stack')
    node.lang = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitcodefencedfencemeta() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'code', 'expected code on stack')
    node.meta = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitcodefencedfence() {
    // Exit if this is the closing fence.
    if (this.data.flowCodeInside) return
    this.buffer()
    this.data.flowCodeInside = true
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitcodefenced() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'code', 'expected code on stack')

    node.value = data.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, '')
    this.data.flowCodeInside = undefined
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitcodeindented() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'code', 'expected code on stack')

    node.value = data.replace(/(\r?\n|\r)$/g, '')
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitdefinitionlabelstring(token) {
    const label = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'definition', 'expected definition on stack')

    node.label = label
    node.identifier = normalizeIdentifier(
      this.sliceSerialize(token)
    ).toLowerCase()
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitdefinitiontitlestring() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'definition', 'expected definition on stack')

    node.title = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitdefinitiondestinationstring() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'definition', 'expected definition on stack')

    node.url = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitatxheadingsequence(token) {
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'heading', 'expected heading on stack')

    if (!node.depth) {
      const depth = this.sliceSerialize(token).length

      assert(
        depth === 1 ||
          depth === 2 ||
          depth === 3 ||
          depth === 4 ||
          depth === 5 ||
          depth === 6,
        'expected `depth` between `1` and `6`'
      )

      node.depth = depth
    }
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitsetextheadingtext() {
    this.data.setextHeadingSlurpLineEnding = true
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitsetextheadinglinesequence(token) {
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'heading', 'expected heading on stack')

    node.depth =
      this.sliceSerialize(token).codePointAt(0) === codes.equalsTo ? 1 : 2
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitsetextheading() {
    this.data.setextHeadingSlurpLineEnding = undefined
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onenterdata(token) {
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert('children' in node, 'expected parent on stack')
    /** @type {Array<Nodes>} */
    const siblings = node.children

    let tail = siblings[siblings.length - 1]

    if (!tail || tail.type !== 'text') {
      // Add a new text node.
      tail = text()
      tail.position = {
        start: point(token.start),
        // @ts-expect-error: we’ll add `end` later.
        end: undefined
      }
      siblings.push(tail)
    }

    this.stack.push(tail)
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitdata(token) {
    const tail = this.stack.pop()
    assert(tail, 'expected a `node` to be on the stack')
    assert('value' in tail, 'expected a `literal` to be on the stack')
    assert(tail.position, 'expected `node` to have an open position')
    tail.value += this.sliceSerialize(token)
    tail.position.end = point(token.end)
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitlineending(token) {
    const context = this.stack[this.stack.length - 1]
    assert(context, 'expected `node`')

    // If we’re at a hard break, include the line ending in there.
    if (this.data.atHardBreak) {
      assert('children' in context, 'expected `parent`')
      const tail = context.children[context.children.length - 1]
      assert(tail.position, 'expected tail to have a starting position')
      tail.position.end = point(token.end)
      this.data.atHardBreak = undefined
      return
    }

    if (
      !this.data.setextHeadingSlurpLineEnding &&
      config.canContainEols.includes(context.type)
    ) {
      onenterdata.call(this, token)
      onexitdata.call(this, token)
    }
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexithardbreak() {
    this.data.atHardBreak = true
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexithtmlflow() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'html', 'expected html on stack')

    node.value = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexithtmltext() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'html', 'expected html on stack')

    node.value = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitcodetext() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'inlineCode', 'expected inline code on stack')

    node.value = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitlink() {
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'link', 'expected link on stack')

    // Note: there are also `identifier` and `label` fields on this link node!
    // These are used / cleaned here.

    // To do: clean.
    if (this.data.inReference) {
      /** @type {ReferenceType} */
      const referenceType = this.data.referenceType || 'shortcut'

      node.type += 'Reference'
      // @ts-expect-error: mutate.
      node.referenceType = referenceType
      // @ts-expect-error: mutate.
      delete node.url
      delete node.title
    } else {
      // @ts-expect-error: mutate.
      delete node.identifier
      // @ts-expect-error: mutate.
      delete node.label
    }

    this.data.referenceType = undefined
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitimage() {
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'image', 'expected image on stack')

    // Note: there are also `identifier` and `label` fields on this link node!
    // These are used / cleaned here.

    // To do: clean.
    if (this.data.inReference) {
      /** @type {ReferenceType} */
      const referenceType = this.data.referenceType || 'shortcut'

      node.type += 'Reference'
      // @ts-expect-error: mutate.
      node.referenceType = referenceType
      // @ts-expect-error: mutate.
      delete node.url
      delete node.title
    } else {
      // @ts-expect-error: mutate.
      delete node.identifier
      // @ts-expect-error: mutate.
      delete node.label
    }

    this.data.referenceType = undefined
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitlabeltext(token) {
    const string = this.sliceSerialize(token)
    const ancestor = this.stack[this.stack.length - 2]
    assert(ancestor, 'expected ancestor on stack')
    assert(
      ancestor.type === 'image' || ancestor.type === 'link',
      'expected image or link on stack'
    )

    // @ts-expect-error: stash this on the node, as it might become a reference
    // later.
    ancestor.label = decodeString(string)
    // @ts-expect-error: same as above.
    ancestor.identifier = normalizeIdentifier(string).toLowerCase()
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitlabel() {
    const fragment = this.stack[this.stack.length - 1]
    assert(fragment, 'expected node on stack')
    assert(fragment.type === 'fragment', 'expected fragment on stack')
    const value = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(
      node.type === 'image' || node.type === 'link',
      'expected image or link on stack'
    )

    // Assume a reference.
    this.data.inReference = true

    if (node.type === 'link') {
      /** @type {Array<PhrasingContent>} */
      const children = fragment.children

      node.children = children
    } else {
      node.alt = value
    }
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitresourcedestinationstring() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(
      node.type === 'image' || node.type === 'link',
      'expected image or link on stack'
    )
    node.url = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitresourcetitlestring() {
    const data = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(
      node.type === 'image' || node.type === 'link',
      'expected image or link on stack'
    )
    node.title = data
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitresource() {
    this.data.inReference = undefined
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onenterreference() {
    this.data.referenceType = 'collapsed'
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitreferencestring(token) {
    const label = this.resume()
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(
      node.type === 'image' || node.type === 'link',
      'expected image reference or link reference on stack'
    )

    // @ts-expect-error: stash this on the node, as it might become a reference
    // later.
    node.label = label
    // @ts-expect-error: same as above.
    node.identifier = normalizeIdentifier(
      this.sliceSerialize(token)
    ).toLowerCase()
    this.data.referenceType = 'full'
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */

  function onexitcharacterreferencemarker(token) {
    assert(
      token.type === 'characterReferenceMarkerNumeric' ||
        token.type === 'characterReferenceMarkerHexadecimal'
    )
    this.data.characterReferenceType = token.type
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitcharacterreferencevalue(token) {
    const data = this.sliceSerialize(token)
    const type = this.data.characterReferenceType
    /** @type {string} */
    let value

    if (type) {
      value = decodeNumericCharacterReference(
        data,
        type === types.characterReferenceMarkerNumeric
          ? constants.numericBaseDecimal
          : constants.numericBaseHexadecimal
      )
      this.data.characterReferenceType = undefined
    } else {
      const result = decodeNamedCharacterReference(data)
      assert(result !== false, 'expected reference to decode')
      value = result
    }

    const tail = this.stack.pop()
    assert(tail, 'expected `node`')
    assert(tail.position, 'expected `node.position`')
    assert('value' in tail, 'expected `node.value`')
    tail.value += value
    tail.position.end = point(token.end)
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token)
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'link', 'expected link on stack')

    node.url = this.sliceSerialize(token)
  }

  /**
   * @this {CompileContext}
   * @type {Handle}
   */
  function onexitautolinkemail(token) {
    onexitdata.call(this, token)
    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected node on stack')
    assert(node.type === 'link', 'expected link on stack')

    node.url = 'mailto:' + this.sliceSerialize(token)
  }

  //
  // Creaters.
  //

  /** @returns {Blockquote} */
  function blockQuote() {
    return {type: 'blockquote', children: []}
  }

  /** @returns {Code} */
  function codeFlow() {
    return {type: 'code', lang: null, meta: null, value: ''}
  }

  /** @returns {InlineCode} */
  function codeText() {
    return {type: 'inlineCode', value: ''}
  }

  /** @returns {Definition} */
  function definition() {
    return {
      type: 'definition',
      identifier: '',
      label: null,
      title: null,
      url: ''
    }
  }

  /** @returns {Emphasis} */
  function emphasis() {
    return {type: 'emphasis', children: []}
  }

  /** @returns {Heading} */
  function heading() {
    return {
      type: 'heading',
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    }
  }

  /** @returns {Break} */
  function hardBreak() {
    return {type: 'break'}
  }

  /** @returns {Html} */
  function html() {
    return {type: 'html', value: ''}
  }

  /** @returns {Image} */
  function image() {
    return {type: 'image', title: null, url: '', alt: null}
  }

  /** @returns {Link} */
  function link() {
    return {type: 'link', title: null, url: '', children: []}
  }

  /**
   * @param {Token} token
   * @returns {List}
   */
  function list(token) {
    return {
      type: 'list',
      ordered: token.type === 'listOrdered',
      start: null,
      spread: token._spread,
      children: []
    }
  }

  /**
   * @param {Token} token
   * @returns {ListItem}
   */
  function listItem(token) {
    return {
      type: 'listItem',
      spread: token._spread,
      checked: null,
      children: []
    }
  }

  /** @returns {Paragraph} */
  function paragraph() {
    return {type: 'paragraph', children: []}
  }

  /** @returns {Strong} */
  function strong() {
    return {type: 'strong', children: []}
  }

  /** @returns {Text} */
  function text() {
    return {type: 'text', value: ''}
  }

  /** @returns {ThematicBreak} */
  function thematicBreak() {
    return {type: 'thematicBreak'}
  }
}

/**
 * Copy a point-like value.
 *
 * @param {Point} d
 *   Point-like value.
 * @returns {Point}
 *   unist point.
 */
function point(d) {
  return {line: d.line, column: d.column, offset: d.offset}
}

/**
 * @param {Config} combined
 * @param {Array<Array<Extension> | Extension>} extensions
 * @returns {undefined}
 */
function configure(combined, extensions) {
  let index = -1

  while (++index < extensions.length) {
    const value = extensions[index]

    if (Array.isArray(value)) {
      configure(combined, value)
    } else {
      extension(combined, value)
    }
  }
}

/**
 * @param {Config} combined
 * @param {Extension} extension
 * @returns {undefined}
 */
function extension(combined, extension) {
  /** @type {keyof Extension} */
  let key

  for (key in extension) {
    if (own.call(extension, key)) {
      switch (key) {
        case 'canContainEols': {
          const right = extension[key]
          if (right) {
            combined[key].push(...right)
          }

          break
        }

        case 'transforms': {
          const right = extension[key]
          if (right) {
            combined[key].push(...right)
          }

          break
        }

        case 'enter':
        case 'exit': {
          const right = extension[key]
          if (right) {
            Object.assign(combined[key], right)
          }

          break
        }
        // No default
      }
    }
  }
}

/** @type {OnEnterError} */
function defaultOnError(left, right) {
  if (left) {
    throw new Error(
      'Cannot close `' +
        left.type +
        '` (' +
        stringifyPosition({start: left.start, end: left.end}) +
        '): a different token (`' +
        right.type +
        '`, ' +
        stringifyPosition({start: right.start, end: right.end}) +
        ') is open'
    )
  } else {
    throw new Error(
      'Cannot close document, a token (`' +
        right.type +
        '`, ' +
        stringifyPosition({start: right.start, end: right.end}) +
        ') is still open'
    )
  }
}
