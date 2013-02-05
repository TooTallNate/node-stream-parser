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

### `Parser` mixin

Invoke the `Parser` mixin on a `Writable` stream or `Transform` stream instance,
and it will give you access to the `_bytes()` function (and `_passthrough()`
fuction for transform streams).

#### _bytes(n, fn)

Buffers `n` bytes written to the stream before invoking the callback function.

#### _passthrough(n, fn)

Only extended `Transform` streams have the `_passthrough()` function. This
function passes through `n` untouched bytes through the readable side of the
transform stream.
