
/**
 * Module dependencies.
 */

var Parser = require('../');
var assert = require('assert');
var inherits = require('util').inherits;
var Writable = require('stream').Writable;

describe('Writable streams', function () {

  var val = 1337;
  var buf = new Buffer(4);
  buf.writeUInt32LE(val, 0);

  it('should have the `_bytes()` function', function () {
    var w = new Writable();
    Parser(w);
    assert.equal('function', typeof w._bytes);
  });

  it('should not have the `_passthrough()` function', function () {
    var w = new Writable();
    Parser(w);
    assert.notEqual('function', typeof w._passthrough);
  });

  it('should read 4 bytes in one chunk', function (done) {
    var w = new Writable();
    Parser(w);

    // read 4 bytes
    w._bytes(4, function (chunk) {
      assert.equal(chunk.length, buf.length);
      assert.equal(val, chunk.readUInt32LE(0));
      done();
    });

    w.end(buf);
  });

  it('should read 4 bytes in multiple chunks', function (done) {
    var w = new Writable();
    Parser(w);

    // read 4 bytes
    w._bytes(4, function (chunk) {
      assert.equal(chunk.length, buf.length);
      assert.equal(val, chunk.readUInt32LE(0));
      done();
    });

    for (var i = 0; i < buf.length; i++) {
      w.write(new Buffer([ buf[i] ]));
    }
    w.end();
  });

  it('should read 1 byte, 2 bytes, then 3 bytes', function (done) {
    var w = new Writable();
    Parser(w);

    // read 1 byte
    w._bytes(1, readone);
    function readone (chunk) {
      assert.equal(1, chunk.length);
      assert.equal(0, chunk[0]);
      w._bytes(2, readtwo);
    }
    function readtwo (chunk) {
      assert.equal(2, chunk.length);
      assert.equal(0, chunk[0]);
      assert.equal(1, chunk[1]);
      w._bytes(3, readthree);
    }
    function readthree (chunk) {
      assert.equal(3, chunk.length);
      assert.equal(0, chunk[0]);
      assert.equal(1, chunk[1]);
      assert.equal(2, chunk[2]);
      done();
    }

    w.end(new Buffer([ 0, 0, 1, 0, 1, 2 ]));
  });

  it('should work when mixing in to a subclass\' `prototype`', function (done) {

    function MyWritable () {
      Writable.call(this);
      this._bytes(2, this.onbytes);
    }
    inherits(MyWritable, Writable);

    // mixin to the `prototype`
    Parser(MyWritable.prototype);

    var count = 2;
    MyWritable.prototype.onbytes = function (buf) {
      assert.equal(2, buf.length);
      assert.equal(0, buf[0]);
      assert.equal(1, buf[1]);
      --count;
      if (!count) done();
    };

    var a = new MyWritable();
    var b = new MyWritable();

    // interleave write()s
    a.write(new Buffer([ 0 ]));
    b.write(new Buffer([ 0 ]));
    a.write(new Buffer([ 1 ]));
    b.write(new Buffer([ 1 ]));
    a.end();
    b.end();

  });

});
