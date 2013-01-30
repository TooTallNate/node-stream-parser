
/**
 * Module dependencies.
 */

var assert = require('assert');
var debug = require('debug')('stream-parser');

/**
 * Module exports.
 */

module.exports = Parser;

/**
 * The `Parser` stream mixin works with either `Writable` or `Transform` stream
 * instances/subclasses. Provides a convenient generic "parsing" API:
 *
 *   _bytes(n, cb) - buffers "n" bytes and then calls "cb" with the "chunk"
 *
 * If you extend a `Transform` stream, then the `_passthrough()` function is also
 * added:
 *
 *   _passthrough(n, cb) - passes through "n" bytes untouched and then calls "cb"
 *
 * @param {Stream} stream Transform or Writable stream instance to extend
 * @api public
 */

function Parser (stream) {
  var isTransform = stream && 'function' == typeof stream._transform;
  var isWritable = stream && 'function' == typeof stream._write;
  if (!isTransform && !isWritable) throw new Error('must pass a Writable or Transform stream in');
  debug('extending Parser into stream');

  // number of bytes left to parser for the next "chunk"
  stream._parserBytesLeft = 0;

  // array of Buffer instances that make up the next "chunk"
  stream._parserBuffers = [];

  // number of bytes parsed so far for the next "chunk"
  stream._parserBuffered = 0;

  // flag the keeps track of if we're buffering or passing-through
  stream._parserBuffering = false;

  // the callback for the next "chunk"
  stream._parserCallback = null;

  // both Transform streams and Writable streams get `_bytes()`
  stream._bytes = bytes;

  // only Transform streams get the `_passthrough()` function
  if (isTransform) stream._passthrough = passthrough;

  // take control of the streams2 callback functions for this stream
  if (isTransform) {
    stream._transform = transform;
  } else {
    stream._write = write;
  }
}

/**
 * Buffers `n` bytes and then invokes `fn` once that amount has been collected.
 *
 * @param {Number} n the number of bytes to buffer
 * @param {Function} fn callback function to invoke when `n` bytes are buffered
 * @api public
 */

function bytes (n, fn) {
  assert(!this._parserCallback, 'there is already a "callback" set!');
  assert(isFinite(n), 'can only buffer a finite number of bytes, got "' + n + '"');
  debug('buffering "%d" bytes', n);
  this._parserBytesLeft = n;
  this._parserCallback = fn;
  this._parserBuffering = true;
}

/**
 * Passes through `n` bytes to the readable side of this stream untouched,
 * then invokes `fn` once that amount has been passed through.
 *
 * @param {Number} n the number of bytes to pass through
 * @param {Function} fn callback function to invoke when `n` bytes have passed through
 * @api public
 */

function passthrough (n, fn) {
  assert(!this._parserCallback, 'There is already a "callback" set!');
  assert(isFinite(n), 'can only pass through a finite number of bytes, got "' + n + '"');
  debug('passing through "%d" bytes', n);
  this._parserBytesLeft = n;
  this._parserCallback = fn;
  this._parserBuffering = false;
}

/**
 * The internal buffering/passthrough logic...
 */

function write (chunk, fn) {
  debug('write(%d bytes)', chunk.length);
  data.call(this, chunk, null, fn);
}

function transform (chunk, output, fn) {
  debug('transform(%d bytes)', chunk.length);
  data.call(this, chunk, output, fn);
}

function data (chunk, output, fn) {
  /*if (this.done) {
    debug('_transform called, but stream is "done"!');
    return done();
  }*/
  assert(this._parserBytesLeft > 0, 'got data but not currently parsing anything');
  if (chunk.length <= this._parserBytesLeft) {
    // small buffer fits within the "_parserBytesLeft" window
    process.call(this, chunk, output);
    fn();
  } else {
    // large buffer needs to be sliced on "_parserBytesLeft" and processed
    var b = chunk.slice(0, this._parserBytesLeft);
    process.call(this, b, output);
    if (chunk.length > b.length) {
      data.call(this, chunk.slice(b.length), output, fn);
    }
  }
}

function process (chunk, output) {
  this._parserBytesLeft -= chunk.length;
  debug('%d bytes left for this piece', this._parserBytesLeft);

  if (this._parserBuffering) {
    // buffer
    this._parserBuffers.push(chunk);
    this._parserBuffered += chunk.length;
  } else {
    // passthrough
    output(chunk);
  }

  if (0 === this._parserBytesLeft) {
    // done with this "piece", invoke the callback
    var cb = this._parserCallback;
    if (cb && this._parserBuffering && this._parserBuffers.length > 1) {
      chunk = Buffer.concat(this._parserBuffers, this._parserBuffered);
    }
    if (!this._parserBuffering) {
      chunk = null;
    }
    this._parserCallback = null;
    this._parserBuffered = 0;
    this._parserBuffering = true;
    this._parserBuffers.splice(0); // empty
    if (cb) {
      if (chunk) {
        cb.call(this, chunk, output); // buffered
      } else {
        cb.call(this, output); // passthrough
      }
    }
    //assert(/*this.done || */this._parserBytesLeft > 0, 'buffer() or passthrough() were not called in the callback');
  }
}
