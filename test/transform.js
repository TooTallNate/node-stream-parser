
/**
 * Module dependencies.
 */

var assert = require('assert');
var Parser = require('../');
var Transform = require('stream').Transform;

// for node v0.6.x-v0.8.x support
if (!Transform) Transform = require('readable-stream/transform');

describe('Transform stream', function () {

  it('should have the `_bytes()` function', function () {
    var t = new Transform();
    Parser(t);
    assert.equal('function', typeof t._bytes);
  });

  it('should have the `_passthrough()` function', function () {
    var t = new Transform();
    Parser(t);
    assert.equal('function', typeof t._passthrough);
  });

  it('should read 2 bytes, pass through 2 bytes', function (done) {
    var t = new Transform();
    Parser(t);
    var gotBytes = false;
    var gotPassthrough = false;
    var gotData = false;

    // read 2 bytes
    t._bytes(2, read);
    function read (chunk, output) {
      assert.equal(2, chunk.length);
      assert.equal(0, chunk[0]);
      assert.equal(1, chunk[1]);
      gotBytes = true;
      t._passthrough(2, passthrough);
    }
    function passthrough (output) {
      gotPassthrough = true;
    }

    t.on('data', function (data) {
      assert.equal(2, data.length);
      assert.equal(2, data[0]);
      assert.equal(3, data[1]);
      gotData = true;
    });

    t.on('end', function () {
      assert(gotBytes);
      assert(gotPassthrough);
      assert(gotData);
      done();
    });

    t.end(new Buffer([ 0, 1, 2, 3 ]));
  });

  it('should allow you to pass through Infinity bytes', function (done) {
    var t = new Transform();
    Parser(t);
    t._passthrough(Infinity);
    var out = [];
    t.on('data', function (data) {
      out.push(data);
    });
    t.on('end', function () {
      assert.equal('hello world', Buffer.concat(out).toString());
      done();
    });
    t.end('hello world');
  });

  it('should *not* allow you to buffer Infinity bytes', function () {
    // buffering to Infinity would just be silly...
    var t = new Transform();
    Parser(t);
    assert.throws(function () {
      t._bytes(Infinity);
    });
  });

  describe('async', function () {

    it('should accept a callback function for `_passthrough()`', function (done) {
      var t = new Transform();
      var data = 'test', _data;
      Parser(t);
      t._passthrough(data.length, function (output, fn) {
        setTimeout(fn, 25);
      });

      t.on('data', function (data) {
        _data = data;
      });
      t.on('end', function () {
        assert.equal(data, _data);
        done();
      });
      t.end(data);
      t.resume();
    });

    it('should accept a callback function for `_bytes()`', function (done) {
      var t = new Transform();
      var data = 'test';
      Parser(t);
      t._bytes(data.length, function (chunk, output, fn) {
        setTimeout(fn, 25);
      });

      t.on('end', function () {
        done();
      });
      t.end(data);
      t.resume();
    });

  });

});
