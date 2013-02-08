node-stream-parser
==================
### Generic interruptible "parser" mixin for Transform & Writable streams
[![Build Status](https://secure.travis-ci.org/TooTallNate/node-stream-parser.png)](http://travis-ci.org/TooTallNate/node-stream-parser)

This module offers the `stream-parser` mixin, which provides an easy-to-use API
for parsing bytes from `Writable` and/or `Transform` stream instances. This module
is great for implementing streaming parsers for standardized file formats.

For `Writable` streams, the parser takes control over the `_write` callback
function. For `Transform` streams, the parser controls the `_transform` callback
function.

Installation
------------

``` bash
$ npm install stream-parser
```


Example
-------

Let's create a quick `Transform` stream subclass that utilizes the parser's
`_bytes()` and `_passthrough()` functions to parse a theoretical file format that
has an 8-byte header we want to parse, and then pass through the rest of the data.

``` javascript
var Parser = require('stream-parser');
var inherits = require('util').inherits;
var Transform = require('stream').Transform;

// create a Transform stream subclass
function MyParser () {
  Transform.call(this);

  // buffer the first 8 bytes written
  this._bytes(8, this.onheader);
}
inherits(MyParser, Transform);

// mixin stream-parser into MyParser's `prototype`
Parser(MyParser.prototype);

// invoked when the first 8 bytes have been received
MyParser.prototype.onheader = function (buffer, output) {
  // parse the "buffer" into a useful "header" object
  var header = {};
  header.type = buffer.readUInt32LE(0);
  header.name = buffer.toString('utf8', 4);
  this.emit('header', header);

  // it's usually a good idea to queue the next "piece" within the callback
  this._passthrough(Infinity);
};


// now we can *use* it!
var parser = new MyParser();
parser.on('header', function (header) {
  console.error('got "header"', header);
});
process.stdin.pipe(parser).pipe(process.stdout);
```

See the `test` directory for some more example code in the test cases.


API
---

  - [Parser()](#parser)
  - [_bytes()](#_bytes)
  - [_passthrough()](#_passthrough)

## Parser()

  The `Parser` stream mixin works with either `Writable` or `Transform` stream
  instances/subclasses. Provides a convenient generic "parsing" API:

```js
_bytes(n, cb) - buffers "n" bytes and then calls "cb" with the "chunk"
```


  If you extend a `Transform` stream, then the `_passthrough()` function is also
  added:

```js
_passthrough(n, cb) - passes through "n" bytes untouched and then calls "cb"
```

## _bytes()

  Buffers `n` bytes and then invokes `fn` once that amount has been collected.

## _passthrough()

  Passes through `n` bytes to the readable side of this stream untouched,
  then invokes `fn` once that amount has been passed through.
