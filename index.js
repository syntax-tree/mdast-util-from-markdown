'use strict'

module.exports = fromMarkdown

var decode = require('parse-entities/decode-entity')
var toString = require('mdast-util-to-string')
var codes = require('micromark/dist/character/codes')
var constants = require('micromark/dist/constant/constants')
var own = require('micromark/dist/constant/has-own-property')
var types = require('micromark/dist/constant/types')
var flatMap = require('micromark/dist/util/flat-map')
var normalizeIdentifier = require('micromark/dist/util/normalize-identifier')
var safeFromInt = require('micromark/dist/util/safe-from-int')
var parser = require('micromark/dist/parse')
var preprocessor = require('micromark/dist/preprocess')
var postprocessor = require('micromark/dist/postprocess')

function fromMarkdown(value, encoding) {
  return compiler()(
    postprocessor()(
      flatMap(
        flatMap([value, codes.eof], preprocessor(), encoding),
        parser().document().write
      )
    )
  )
}

// Note this compiler only understand complete buffering, not streaming.
function compiler() {
  var context = {type: 'root', children: []}
  var stack = [context]

  var handlers = {
    enter: {
      autolink: open(link),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: open(heading),
      blockQuote: open(blockQuote),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: open(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: open(codeFlow, buffer),
      codeText: open(codeText, buffer),
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: open(definition),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: open(emphasis),
      hardBreakEscape: open(hardBreak),
      hardBreakTrailing: open(hardBreak),
      htmlFlow: open(html, buffer),
      htmlText: open(html, buffer),
      image: open(image, onenterimage),
      link: open(link),
      listItem: open(listItem),
      listItemValue: onenterlistitemvalue,
      listOrdered: open(list, onenterlistordered),
      listUnordered: open(list),
      paragraph: open(paragraph),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: open(heading),
      strong: open(strong),
      thematicBreak: open(thematicBreak)
    },
    exit: {
      atxHeading: close(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: close(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: close(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: close(onexitcharacterreferencevalue),
      codeFenced: close(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: close(onexitcodeindented),
      codeText: close(onexitcodetext),
      data: onexitdata,
      definition: close(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: close(),
      hardBreakEscape: close(onexithardbreak),
      hardBreakTrailing: close(onexithardbreak),
      htmlFlow: close(onexithtmlflow),
      htmlText: close(onexithtmltext),
      image: close(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: close(onexitlink),
      listItem: close(),
      listOrdered: close(),
      listUnordered: close(),
      paragraph: close(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: close(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: close(),
      thematicBreak: close()
    }
  }

  var flowCodeInside
  var setextHeadingSlurpLineEnding
  var characterReferenceType
  var expectingFirstListItemValue
  var atHardBreak
  var inImage
  var inReference
  var referenceType

  return compile

  function compile(events) {
    var index = -1
    var listStack = []
    var length
    var handler
    var listStart
    var event

    while (++index < events.length) {
      event = events[index]

      if (!event) break

      // We preprocess lists to add `listItem` tokens, and to infer whether
      // items the list itself are spread out.
      if (
        event[1].type === types.listOrdered ||
        event[1].type === types.listUnordered
      ) {
        if (event[0] === 'enter') {
          listStack.push(index)
        } else {
          listStart = listStack.pop(index)
          index = prepareList(events, listStart, index)
        }
      }
    }

    index = -1
    length = events.length - 1

    while (++index < length) {
      handler = handlers[events[index][0]]

      if (own.call(handler, events[index][1].type)) {
        handler[events[index][1].type].call(events[index][2], events[index][1])
      }
    }

    // Figure out `root` position.
    context.position = {
      start: point(
        length ? events[0][1].start : {line: 1, column: 1, offset: 0}
      ),
      end: point(
        length
          ? events[events.length - 2][1].end
          : {line: 1, column: 1, offset: 0}
      )
    }

    return context
  }

  function prepareList(events, start, length) {
    var index = start - 1
    var containerBalance = -1
    var listSpread = false
    var listItem
    var tailIndex
    var lineIndex
    var tailEvent
    var event
    var firstBlankLineIndex
    var atMarker

    while (++index <= length) {
      event = events[index]

      if (
        event[1].type === types.listUnordered ||
        event[1].type === types.listOrdered ||
        event[1].type === types.blockQuote
      ) {
        if (event[0] === 'enter') {
          containerBalance++
        } else {
          containerBalance--
        }

        atMarker = undefined
      } else if (event[1].type === types.lineEndingBlank) {
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
      } else if (
        event[1].type === types.linePrefix ||
        event[1].type === types.listItemValue ||
        event[1].type === types.listItemMarker ||
        event[1].type === types.listItemPrefix ||
        event[1].type === types.listItemPrefixWhitespace
      ) {
        // Empty.
      } else {
        atMarker = undefined
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
          tailIndex = index
          lineIndex = undefined

          while (tailIndex--) {
            tailEvent = events[tailIndex]

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
            } else if (tailEvent[1].type === types.linePrefix) {
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
          listItem.end = point(
            lineIndex ? events[lineIndex][1].start : event[1].end
          )

          events.splice(lineIndex || index, 0, ['exit', listItem, event[2]])
          index++
          length++
        }

        // Create a new list item.
        if (event[1].type === types.listItemPrefix) {
          listItem = {
            type: 'listItem',
            _spread: false,
            start: point(event[1].start)
          }
          events.splice(index, 0, ['enter', listItem, event[2]])
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

  function point(d) {
    return {line: d.line, column: d.column, offset: d.offset}
  }

  function open(create, and) {
    return enter

    function enter(token) {
      var node = create(token)

      context.children.push(node)
      context = node
      stack.push(node)
      node.position = {start: point(token.start)}

      if (and) and.call(this, token)
    }
  }

  function buffer() {
    var node = {type: 'fragment', children: []}
    context = node
    stack.push(node)
  }

  function close(and) {
    return exit

    function exit(token) {
      var tail
      if (and) and.call(this, token)
      tail = stack.pop()
      tail.position.end = point(token.end)
      context = stack[stack.length - 1]
    }
  }

  function resume() {
    var value = toString(stack.pop())
    context = stack[stack.length - 1]
    return value
  }

  //
  // Handlers.
  //

  function onenterlistordered() {
    expectingFirstListItemValue = true
  }

  function onenterlistitemvalue(token) {
    if (expectingFirstListItemValue) {
      stack[stack.length - 2].start = parseInt(
        this.sliceSerialize(token),
        constants.numericBaseDecimal
      )
      expectingFirstListItemValue = undefined
    }
  }

  function onexitcodefencedfenceinfo() {
    var data = resume()
    context.lang = data
  }

  function onexitcodefencedfencemeta() {
    var data = resume()
    context.meta = data
  }

  function onexitcodefencedfence() {
    // Exit if this is the closing fence.
    if (flowCodeInside) return
    buffer()
    flowCodeInside = true
  }

  function onexitcodefenced() {
    var data = resume()
    context.value = data.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, '')
    flowCodeInside = undefined
  }

  function onexitcodeindented() {
    var data = resume()
    context.value = data
  }

  function onexitdefinitionlabelstring() {
    var data = resume()
    context.label = data
    context.identifier = normalizeIdentifier(data).toLowerCase()
  }

  function onexitdefinitiontitlestring() {
    var data = resume()
    context.title = data
  }

  function onexitdefinitiondestinationstring() {
    var data = resume()
    context.url = data
  }

  function onexitatxheadingsequence(token) {
    if (!context.depth) {
      context.depth = this.sliceSerialize(token).length
    }
  }

  function onexitsetextheadingtext() {
    setextHeadingSlurpLineEnding = true
  }

  function onexitsetextheadinglinesequence(token) {
    context.depth =
      this.sliceSerialize(token).charCodeAt(0) === codes.equalsTo ? 1 : 2
  }

  function onexitsetextheading() {
    setextHeadingSlurpLineEnding = undefined
  }

  function onenterdata(token) {
    var siblings = context.children
    var tail = siblings[siblings.length - 1]

    if (!tail || tail.type !== 'text') {
      // Add a new text node.
      tail = text()
      tail.position = {start: point(token.start)}
      context.children.push(tail)
    }

    context = tail
    stack.push(tail)
  }

  function onexitdata(token) {
    var tail = stack.pop()
    tail.value += this.sliceSerialize(token)
    tail.position.end = point(token.end)
    context = stack[stack.length - 1]
  }

  function onexitlineending(token) {
    // If we’re at a hard break, include the line ending in there.
    if (atHardBreak) {
      context.children[context.children.length - 1].position.end = point(
        token.end
      )
      atHardBreak = undefined
      return
    }

    if (setextHeadingSlurpLineEnding) {
      return
    }

    if (
      context.type === 'emphasis' ||
      context.type === 'fragment' ||
      context.type === 'heading' ||
      context.type === 'paragraph' ||
      context.type === 'strong'
    ) {
      onenterdata.call(this, token)
      onexitdata.call(this, token)
    }
  }

  function onexithardbreak() {
    atHardBreak = true
  }

  function onexithtmlflow() {
    var data = resume()
    context.value = data
  }

  function onexithtmltext() {
    var data = resume()
    context.value = data
  }

  function onexitcodetext() {
    var data = resume()
    context.value = data
  }

  function onenterimage() {
    buffer()
    inImage = true
  }

  function onexitlink() {
    // To do: clean.
    if (inReference) {
      context.type += 'Reference'
      context.referenceType = referenceType || 'shortcut'
      delete context.url
      delete context.title
    } else {
      delete context.identifier
      delete context.label
      delete context.referenceType
    }

    referenceType = undefined
  }

  function onexitimage() {
    // To do: clean.
    if (inReference) {
      context.type += 'Reference'
      context.referenceType = referenceType || 'shortcut'
      delete context.url
      delete context.title
    } else {
      delete context.identifier
      delete context.label
      delete context.referenceType
    }

    referenceType = undefined
  }

  function onexitlabeltext(token) {
    var data = this.sliceSerialize(token)
    var ctx = context.type === 'fragment' ? stack[stack.length - 2] : context
    ctx.label = data
    ctx.identifier = normalizeIdentifier(data).toLowerCase()
  }

  function onexitlabel() {
    var data

    // Assume a reference.
    inReference = true

    if (inImage) {
      data = resume()
      context.alt = data
      inImage = undefined
    }
  }

  function onexitresourcedestinationstring() {
    var data = resume()
    context.url = data
  }

  function onexitresourcetitlestring() {
    var data = resume()
    context.title = data
  }

  function onexitresource() {
    inReference = undefined
  }

  function onenterreference() {
    referenceType = 'collapsed'
  }

  function onexitreferencestring() {
    var data = resume()
    context.label = data
    context.identifier = normalizeIdentifier(data).toLowerCase()
    referenceType = 'full'
  }

  function onexitcharacterreferencemarker(token) {
    characterReferenceType = token.type
  }

  function onexitcharacterreferencevalue(token) {
    var data = this.sliceSerialize(token)
    var value

    if (characterReferenceType) {
      value = safeFromInt(
        data,
        characterReferenceType === types.characterReferenceMarkerNumeric
          ? constants.numericBaseDecimal
          : constants.numericBaseHexadecimal
      )
    } else {
      value = decode(data)
    }

    context.value += value
    characterReferenceType = undefined
  }

  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token)
    context.url = this.sliceSerialize(token)
  }

  function onexitautolinkemail(token) {
    onexitdata.call(this, token)
    context.url = 'mailto:' + this.sliceSerialize(token)
  }

  //
  // Creaters.
  //

  function blockQuote() {
    return {type: 'blockquote', children: []}
  }

  function codeFlow() {
    return {type: 'code', lang: null, meta: null, value: ''}
  }

  function codeText() {
    return {type: 'inlineCode', value: ''}
  }

  function definition() {
    return {
      type: 'definition',
      identifier: '',
      label: null,
      title: null,
      url: ''
    }
  }

  function emphasis() {
    return {type: 'emphasis', children: []}
  }

  function heading() {
    return {type: 'heading', depth: undefined, children: []}
  }

  function hardBreak() {
    return {type: 'break'}
  }

  function html() {
    return {type: 'html', value: ''}
  }

  function image() {
    return {type: 'image', title: null, url: null, alt: null}
  }

  function link() {
    return {type: 'link', title: null, url: null, children: []}
  }

  function list(token) {
    return {
      type: 'list',
      ordered: token.type === 'listOrdered',
      start: null,
      spread: token._spread,
      children: []
    }
  }

  function listItem(token) {
    return {
      type: 'listItem',
      spread: token._spread,
      checked: null,
      children: []
    }
  }

  function paragraph() {
    return {type: 'paragraph', children: []}
  }

  function strong() {
    return {type: 'strong', children: []}
  }

  function text() {
    return {type: 'text', value: ''}
  }

  function thematicBreak() {
    return {type: 'thematicBreak'}
  }
}
