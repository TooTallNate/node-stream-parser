
/**
 * Module dependencies.
 */

var assert = require('assert');
var Promise = require('promise');
var callbackify = require('callbackify');
var debug = require('debug')('stream-parser');

/**
 * Module exports.
 */

module.exports = Parser;

/**
 * Parser states.
 */

var BUFFERING   = 0;
var SKIPPING    = 1;
var PASSTHROUGH = 2;
var FINISHED    = -1;

/**
 * The `Parser` stream mixin works with either `Writable` or `Transform` stream
 * instances/subclasses. Provides a convenient generic "parsing" API:
 *
 *   _bytes(n, cb) - buffers "n" bytes and then calls "cb" with the "chunk"
 *   _skipBytes(n, cb) - skips "n" bytes and then calls "cb" when done
 *
 * If you extend a `Transform` stream, then the `_passthrough()` function is also
 * added:
 *
 *   _passthrough(n, cb) - passes through "n" bytes untouched and then calls "cb"
 *
 * @param {Stream} stream - Transform or Writable stream instance to extend
 * @public
 */

function Parser (stream) {
  var isTransform = stream && 'function' == typeof stream._transform;
  var isWritable = stream && 'function' == typeof stream._write;

  if (!isTransform && !isWritable) throw new Error('must pass a Writable or Transform stream in');
  debug('extending Parser into stream');

  // common functions fofr Transform streams and Writable streams
  stream._bytes = callbackify(_bytes);
  stream._skipBytes = callbackify(_skipBytes);
  stream._doneParsing = callbackify(_doneParsing);

  // only Transform streams get the `_passthrough()` function
  if (isTransform) stream._passthrough = callbackify(_passthrough);

  // take control of the streams2 callback functions for this stream
  if (isTransform) {
    stream._transform = transform;
  } else {
    stream._write = write;
  }
}

/**
 * Invoked upon the first "read" call.
 *
 * @param {Stream} stream - Transform or Writable stream instance to init
 * @private
 */

function init (stream) {
  debug('initializing parser stream');

  // set to `true` once `_doneParsing()` is called
  stream._parserFinished = false;

  // array of Buffer instances that make up the next "chunk"
  stream._parserBuffers = [];

  // number of bytes parsed so far for the next "chunk"
  stream._parserBuffered = 0;

  // array of "read" request Promise instances that need to be fulfilled
  stream._parserPromises = [];

  // XXX: backwards compat with the old Transform API... remove at some point..
  if ('function' == typeof stream.push) {
    stream._parserOutput = stream.push.bind(stream);
  }

  stream._parserInit = true;
}


function createPromise (bytes, state) {
  var reject, resolve, promise;
  promise = new Promise(function (_resolve, _reject) {
    // save these for later...
    resolve = _resolve;
    reject = _reject;
  });
  assert.equal('function', typeof resolve);
  assert.equal('function', typeof reject);
  promise.bytesLeft = bytes;
  promise.state = state;
  promise.reject = reject;
  promise.resolve = resolve;
  return promise;
}

/**
 * Buffers `n` bytes and then fulfills the returned Promise once that amount
 * has been collected.
 *
 * @param {Number} n - the number of bytes to buffer
 * @return {Promise} promise
 * @public
 */

function _bytes (n) {
  assert(isFinite(n) && n > 0, 'can only buffer a finite number of bytes > 0, got "' + n + '"');
  if (!this._parserInit) init(this);
  debug('buffering %o bytes', n);
  var promise = createPromise(n, BUFFERING);
  this._parserPromises.push(promise);

  if (this._bufferedWrite) {
    debug('flushing buffered write() call');
    var args = this._bufferedWrite;
    this._bufferedWrite = null;
    data.apply(null, args);
  }

  return promise;
}

/**
 * Skips over the next `n` bytes, then fulfills the returned Promise once that
 * amount has been discarded.
 *
 * @param {Number} n - the number of bytes to discard
 * @return {Promise} promise
 * @public
 */

function _skipBytes (n) {
  assert(n > 0, 'can only skip > 0 bytes, got "' + n + '"');
  if (!this._parserInit) init(this);
  debug('skipping %o bytes', n);
  var promise = createPromise(n, SKIPPING);
  this._parserPromises.push(promise);

  if (this._bufferedWrite) {
    debug('flushing buffered write() call');
    var args = this._bufferedWrite;
    this._bufferedWrite = null;
    data.apply(null, args);
  }

  return promise;
}

/**
 * Passes through `n` bytes to the readable side of this stream untouched,
 * then fulfills the returned Promise once that amount has been passed through.
 *
 * @param {Number} n - the number of bytes to pass through
 * @return {Promise} promise
 * @public
 */

function _passthrough (n) {
  assert(n > 0, 'can only pass through > 0 bytes, got "' + n + '"');
  if (!this._parserInit) init(this);
  debug('passing through %o bytes', n);
  var promise = createPromise(n, PASSTHROUGH);
  this._parserPromises.push(promise);

  if (this._bufferedWrite) {
    debug('flushing buffered write() call');
    var args = this._bufferedWrite;
    this._bufferedWrite = null;
    data.apply(null, args);
  }

  return promise;
}

/**
 * Notifies the parser that we are no longer interested in parsing
 * anymore data. Any further recieved bytes will be dropped on the floor.
 *
 * This also allows the "end"/"finish" events to be emitted.
 *
 * @return {Promise} promise
 * @public
 */

function _doneParsing () {
  if (!this._parserInit) init(this);
  debug('done parsing');

  var promise = createPromise(null, FINISHED);
  this._parserPromises.push(promise);

  if (this._bufferedWrite) {
    debug('flushing buffered write() call');
    var args = this._bufferedWrite;
    this._bufferedWrite = null;
    data.apply(null, args);
  }

  return promise;
}

/**
 * The `_write()` callback function implementation.
 *
 * @private
 */

function write (chunk, encoding, fn) {
  var stream = this;
  if (!stream._parserInit) init(stream);
  debug('write(%o bytes)', chunk.length);

  // XXX: old Writable stream API compat... remove at some point...
  if ('function' == typeof encoding) fn = encoding;

  new Promise(function (resolve, reject) {
    data(stream, chunk, null, resolve, reject);
  }).nodeify(fn);
}

/**
 * The `_transform()` callback function implementation.
 *
 * @private
 */


function transform (chunk, output, fn) {
  var stream = this;
  if (!stream._parserInit) init(stream);
  debug('transform(%o bytes)', chunk.length);

  // XXX: old Transform stream API compat... remove at some point...
  if ('function' != typeof output) {
    output = stream._parserOutput;
  }

  new Promise(function (resolve, reject) {
    data(stream, chunk, output, resolve, reject);
  }).nodeify(fn);
}

/**
 * The internal buffering/passthrough logic...
 *
 * @private
 */

function data (stream, chunk, output, resolve, reject) {
  debug('data(%o bytes)', chunk.length);

  if (stream._parserFinished) {
    debug('already finished... dropping %o bytes on floor', chunk.length);
    resolve();
    return;
  }

  var promise = stream._parserPromises[0];

  if (promise) {
    if (promise.state === FINISHED) {
      // no more bytes!!!
      debug('stream is FINISHED!!!! (dropping %o bytes on floor)', chunk.length);
      stream._parserFinished = true;
      stream._parserPromises.shift();
      promise.resolve();
      resolve();
      return;
    }
  } else {
    debug('waiting for next "read" style call');
    stream._bufferedWrite = arguments;
    return;
  }

  if (chunk.length <= promise.bytesLeft) {
    // small buffer fits within the "bytesLeft" window
    debug('small buffer');
    process(stream, chunk, output);
    resolve();
  } else {
    // large buffer needs to be sliced on "bytesLeft" and processed
    var b = chunk.slice(0, promise.bytesLeft);
    debug('sliced chunk from %o to %o bytes', chunk.length, b.length);

    process(stream, b, output);

    // if there's anything leftover, then do the `data` dance again
    if (chunk.length > b.length) {
      data(stream, chunk.slice(b.length), output, resolve, reject);
    }
  }
}

/**
 * The internal `process` function gets called by the `data` function when
 * something "interesting" happens. This function takes care of buffering the
 * bytes when buffering, passing through the bytes when doing that, and invoking
 * the user callback when the number of bytes has been reached.
 *
 * @private
 */

function process (stream, chunk, output) {
  var promise = stream._parserPromises[0];

  promise.bytesLeft -= chunk.length;
  debug('%o bytes left for stream piece', promise.bytesLeft);

  if (promise.state === BUFFERING) {
    // buffer
    stream._parserBuffers.push(chunk);
    stream._parserBuffered += chunk.length;
  } else if (promise.state === PASSTHROUGH) {
    // passthrough
    output(chunk);
  }
  // don't need to do anything for the SKIPPING case

  if (0 === promise.bytesLeft) {
    // done with stream "piece", invoke the callback
    if (promise.state === BUFFERING && stream._parserBuffers.length > 1) {
      chunk = Buffer.concat(stream._parserBuffers, stream._parserBuffered);
    }

    if (promise.state !== BUFFERING) {
      chunk = null;
    }

    // reset parser state on the stream and remove leading Promise instance
    stream._parserPromises.shift();
    stream._parserBuffered = 0;
    stream._parserBuffers.splice(0); // empty

    if (output) {
      // on a Transform stream, has "output" function, skipped
      promise.output = output;
    }

    // resolve promise
    //console.log(promise);
    promise.resolve(chunk);
  } else {
    debug('need %o more bytes', promise.bytesLeft)
  }
}
