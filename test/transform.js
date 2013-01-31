
/**
 * Module dependencies.
 */

var assert = require('assert');
var Parser = require('../');
var Transform = require('stream').Transform;

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
      assert(gotBytes);
      assert(gotBytes);
      done();
    });

    t.end(new Buffer([ 0, 1, 2, 3 ]));
  });

});
