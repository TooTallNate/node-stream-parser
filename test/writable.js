
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

});
