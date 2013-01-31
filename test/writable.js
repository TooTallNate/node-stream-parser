
/**
 * Module dependencies.
 */

var assert = require('assert');
var Parser = require('../');
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

});
