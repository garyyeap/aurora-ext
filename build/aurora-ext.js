!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.AV=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var key, val, _ref;

_ref = _dereq_('./src/aurora');
for (key in _ref) {
  val = _ref[key];
  exports[key] = val;
}

_dereq_('./src/devices/webaudio');

_dereq_('./src/devices/mozilla');


},{"./src/aurora":3,"./src/devices/mozilla":34,"./src/devices/webaudio":36}],2:[function(_dereq_,module,exports){
var Asset, BufferSource, Decoder, Demuxer, EventEmitter, FileSource, HTTPSource,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('./core/events');

HTTPSource = _dereq_('./sources/node/http');

FileSource = _dereq_('./sources/node/file');

BufferSource = _dereq_('./sources/buffer');

Demuxer = _dereq_('./demuxer');

Decoder = _dereq_('./decoder');

Asset = (function(_super) {
  __extends(Asset, _super);

  function Asset(source) {
    this.source = source;
    this._decode = __bind(this._decode, this);
    this.findDecoder = __bind(this.findDecoder, this);
    this.probe = __bind(this.probe, this);
    this.buffered = 0;
    this.duration = null;
    this.format = null;
    this.metadata = null;
    this.active = false;
    this.demuxer = null;
    this.decoder = null;
    this.source.once('data', this.probe);
    this.source.on('error', (function(_this) {
      return function(err) {
        _this.emit('error', err);
        return _this.stop();
      };
    })(this));
    this.source.on('progress', (function(_this) {
      return function(buffered) {
        _this.buffered = buffered;
        return _this.emit('buffer', _this.buffered);
      };
    })(this));
  }

  Asset.fromURL = function(url) {
    return new Asset(new HTTPSource(url));
  };

  Asset.fromFile = function(file) {
    return new Asset(new FileSource(file));
  };

  Asset.fromBuffer = function(buffer) {
    return new Asset(new BufferSource(buffer));
  };

  Asset.prototype.start = function(decode) {
    if (this.active) {
      return;
    }
    if (decode != null) {
      this.shouldDecode = decode;
    }
    if (this.shouldDecode == null) {
      this.shouldDecode = true;
    }
    this.active = true;
    this.source.start();
    if (this.decoder && this.shouldDecode) {
      return this._decode();
    }
  };

  Asset.prototype.stop = function() {
    if (!this.active) {
      return;
    }
    this.active = false;
    return this.source.pause();
  };

  Asset.prototype.get = function(event, callback) {
    if (event !== 'format' && event !== 'duration' && event !== 'metadata') {
      return;
    }
    if (this[event] != null) {
      return callback(this[event]);
    } else {
      this.once(event, (function(_this) {
        return function(value) {
          _this.stop();
          return callback(value);
        };
      })(this));
      return this.start();
    }
  };

  Asset.prototype.decodePacket = function() {
    return this.decoder.decode();
  };

  Asset.prototype.decodeToBuffer = function(callback) {
    var chunks, dataHandler, length;
    length = 0;
    chunks = [];
    this.on('data', dataHandler = function(chunk) {
      length += chunk.length;
      return chunks.push(chunk);
    });
    this.once('end', function() {
      var buf, chunk, offset, _i, _len;
      buf = new Float32Array(length);
      offset = 0;
      for (_i = 0, _len = chunks.length; _i < _len; _i++) {
        chunk = chunks[_i];
        buf.set(chunk, offset);
        offset += chunk.length;
      }
      this.off('data', dataHandler);
      return callback(buf);
    });
    return this.start();
  };

  Asset.prototype.probe = function(chunk) {
    var demuxer;
    if (!this.active) {
      return;
    }
    demuxer = Demuxer.find(chunk);
    if (!demuxer) {
      return this.emit('error', 'A demuxer for this container was not found.');
    }
    this.demuxer = new demuxer(this.source, chunk);
    this.demuxer.on('format', this.findDecoder);
    this.demuxer.on('duration', (function(_this) {
      return function(duration) {
        _this.duration = duration;
        return _this.emit('duration', _this.duration);
      };
    })(this));
    this.demuxer.on('metadata', (function(_this) {
      return function(metadata) {
        _this.metadata = metadata;
        return _this.emit('metadata', _this.metadata);
      };
    })(this));
    return this.demuxer.on('error', (function(_this) {
      return function(err) {
        _this.emit('error', err);
        return _this.stop();
      };
    })(this));
  };

  Asset.prototype.findDecoder = function(format) {
    var decoder, div;
    this.format = format;
    if (!this.active) {
      return;
    }
    this.emit('format', this.format);
    decoder = Decoder.find(this.format.formatID);
    if (!decoder) {
      return this.emit('error', "A decoder for " + this.format.formatID + " was not found.");
    }
    this.decoder = new decoder(this.demuxer, this.format);
    if (this.format.floatingPoint) {
      this.decoder.on('data', (function(_this) {
        return function(buffer) {
          return _this.emit('data', buffer);
        };
      })(this));
    } else {
      div = Math.pow(2, this.format.bitsPerChannel - 1);
      this.decoder.on('data', (function(_this) {
        return function(buffer) {
          var buf, i, sample, _i, _len;
          buf = new Float32Array(buffer.length);
          for (i = _i = 0, _len = buffer.length; _i < _len; i = ++_i) {
            sample = buffer[i];
            buf[i] = sample / div;
          }
          return _this.emit('data', buf);
        };
      })(this));
    }
    this.decoder.on('error', (function(_this) {
      return function(err) {
        _this.emit('error', err);
        return _this.stop();
      };
    })(this));
    this.decoder.on('end', (function(_this) {
      return function() {
        return _this.emit('end');
      };
    })(this));
    this.emit('decodeStart');
    if (this.shouldDecode) {
      return this._decode();
    }
  };

  Asset.prototype._decode = function() {
    while (this.decoder.decode() && this.active) {
      continue;
    }
    if (this.active) {
      return this.decoder.once('data', this._decode);
    }
  };

  return Asset;

})(EventEmitter);

module.exports = Asset;


},{"./core/events":9,"./decoder":12,"./demuxer":26,"./sources/buffer":44,"./sources/node/file":42,"./sources/node/http":43}],3:[function(_dereq_,module,exports){
var key, val, _ref;

_ref = _dereq_('./aurora_base');
for (key in _ref) {
  val = _ref[key];
  exports[key] = val;
}

_dereq_('./demuxers/caf');

_dereq_('./demuxers/m4a');

_dereq_('./demuxers/aiff');

_dereq_('./demuxers/wave');

_dereq_('./demuxers/au');

_dereq_('./demuxers/adts');

_dereq_('./decoders/lpcm');

_dereq_('./decoders/xlaw');

_dereq_('./decoders/aac');


},{"./aurora_base":4,"./decoders/aac":19,"./decoders/lpcm":24,"./decoders/xlaw":25,"./demuxers/adts":27,"./demuxers/aiff":28,"./demuxers/au":29,"./demuxers/caf":30,"./demuxers/m4a":31,"./demuxers/wave":32}],4:[function(_dereq_,module,exports){
exports.Base = _dereq_('./core/base');

exports.Buffer = _dereq_('./core/buffer');

exports.BufferList = _dereq_('./core/bufferlist');

exports.Stream = _dereq_('./core/stream');

exports.Bitstream = _dereq_('./core/bitstream');

exports.EventEmitter = _dereq_('./core/events');

exports.UnderflowError = _dereq_('./core/underflow');

exports.HTTPSource = _dereq_('./sources/node/http');

exports.FileSource = _dereq_('./sources/node/file');

exports.BufferSource = _dereq_('./sources/buffer');

exports.Demuxer = _dereq_('./demuxer');

exports.Decoder = _dereq_('./decoder');

exports.AudioDevice = _dereq_('./device');

exports.Asset = _dereq_('./asset');

exports.Player = _dereq_('./player');

exports.Filter = _dereq_('./filter');

exports.VolumeFilter = _dereq_('./filters/volume');

exports.BalanceFilter = _dereq_('./filters/balance');


},{"./asset":2,"./core/base":5,"./core/bitstream":6,"./core/buffer":7,"./core/bufferlist":8,"./core/events":9,"./core/stream":10,"./core/underflow":11,"./decoder":12,"./demuxer":26,"./device":33,"./filter":37,"./filters/balance":38,"./filters/volume":39,"./player":40,"./sources/buffer":44,"./sources/node/file":42,"./sources/node/http":43}],5:[function(_dereq_,module,exports){
var Base,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Base = (function() {
  var fnTest;

  function Base() {}

  fnTest = /\b_super\b/;

  Base.extend = function(prop) {
    var Class, fn, key, keys, _ref, _super;
    Class = (function(_super) {
      __extends(Class, _super);

      function Class() {
        return Class.__super__.constructor.apply(this, arguments);
      }

      return Class;

    })(this);
    if (typeof prop === 'function') {
      keys = Object.keys(Class.prototype);
      prop.call(Class, Class);
      prop = {};
      _ref = Class.prototype;
      for (key in _ref) {
        fn = _ref[key];
        if (__indexOf.call(keys, key) < 0) {
          prop[key] = fn;
        }
      }
    }
    _super = Class.__super__;
    for (key in prop) {
      fn = prop[key];
      if (typeof fn === 'function' && fnTest.test(fn)) {
        (function(key, fn) {
          return Class.prototype[key] = function() {
            var ret, tmp;
            tmp = this._super;
            this._super = _super[key];
            ret = fn.apply(this, arguments);
            this._super = tmp;
            return ret;
          };
        })(key, fn);
      } else {
        Class.prototype[key] = fn;
      }
    }
    return Class;
  };

  return Base;

})();

module.exports = Base;


},{}],6:[function(_dereq_,module,exports){
var Bitstream;

Bitstream = (function() {
  function Bitstream(stream) {
    this.stream = stream;
    this.bitPosition = 0;
  }

  Bitstream.prototype.copy = function() {
    var result;
    result = new Bitstream(this.stream.copy());
    result.bitPosition = this.bitPosition;
    return result;
  };

  Bitstream.prototype.offset = function() {
    return 8 * this.stream.offset + this.bitPosition;
  };

  Bitstream.prototype.available = function(bits) {
    return this.stream.available((bits + 8 - this.bitPosition) / 8);
  };

  Bitstream.prototype.advance = function(bits) {
    var pos;
    pos = this.bitPosition + bits;
    this.stream.advance(pos >> 3);
    return this.bitPosition = pos & 7;
  };

  Bitstream.prototype.rewind = function(bits) {
    var pos;
    pos = this.bitPosition - bits;
    this.stream.rewind(Math.abs(pos >> 3));
    return this.bitPosition = pos & 7;
  };

  Bitstream.prototype.seek = function(offset) {
    var curOffset;
    curOffset = this.offset();
    if (offset > curOffset) {
      return this.advance(offset - curOffset);
    } else if (offset < curOffset) {
      return this.rewind(curOffset - offset);
    }
  };

  Bitstream.prototype.align = function() {
    if (this.bitPosition !== 0) {
      this.bitPosition = 0;
      return this.stream.advance(1);
    }
  };

  Bitstream.prototype.read = function(bits, signed) {
    var a, a0, a1, a2, a3, a4, mBits;
    if (bits === 0) {
      return 0;
    }
    mBits = bits + this.bitPosition;
    if (mBits <= 8) {
      a = ((this.stream.peekUInt8() << this.bitPosition) & 0xff) >>> (8 - bits);
    } else if (mBits <= 16) {
      a = ((this.stream.peekUInt16() << this.bitPosition) & 0xffff) >>> (16 - bits);
    } else if (mBits <= 24) {
      a = ((this.stream.peekUInt24() << this.bitPosition) & 0xffffff) >>> (24 - bits);
    } else if (mBits <= 32) {
      a = (this.stream.peekUInt32() << this.bitPosition) >>> (32 - bits);
    } else if (mBits <= 40) {
      a0 = this.stream.peekUInt8(0) * 0x0100000000;
      a1 = this.stream.peekUInt8(1) << 24 >>> 0;
      a2 = this.stream.peekUInt8(2) << 16;
      a3 = this.stream.peekUInt8(3) << 8;
      a4 = this.stream.peekUInt8(4);
      a = a0 + a1 + a2 + a3 + a4;
      a %= Math.pow(2, 40 - this.bitPosition);
      a = Math.floor(a / Math.pow(2, 40 - this.bitPosition - bits));
    } else {
      throw new Error("Too many bits!");
    }
    if (signed) {
      if (mBits < 32) {
        if (a >>> (bits - 1)) {
          a = ((1 << bits >>> 0) - a) * -1;
        }
      } else {
        if (a / Math.pow(2, bits - 1) | 0) {
          a = (Math.pow(2, bits) - a) * -1;
        }
      }
    }
    this.advance(bits);
    return a;
  };

  Bitstream.prototype.peek = function(bits, signed) {
    var a, a0, a1, a2, a3, a4, mBits;
    if (bits === 0) {
      return 0;
    }
    mBits = bits + this.bitPosition;
    if (mBits <= 8) {
      a = ((this.stream.peekUInt8() << this.bitPosition) & 0xff) >>> (8 - bits);
    } else if (mBits <= 16) {
      a = ((this.stream.peekUInt16() << this.bitPosition) & 0xffff) >>> (16 - bits);
    } else if (mBits <= 24) {
      a = ((this.stream.peekUInt24() << this.bitPosition) & 0xffffff) >>> (24 - bits);
    } else if (mBits <= 32) {
      a = (this.stream.peekUInt32() << this.bitPosition) >>> (32 - bits);
    } else if (mBits <= 40) {
      a0 = this.stream.peekUInt8(0) * 0x0100000000;
      a1 = this.stream.peekUInt8(1) << 24 >>> 0;
      a2 = this.stream.peekUInt8(2) << 16;
      a3 = this.stream.peekUInt8(3) << 8;
      a4 = this.stream.peekUInt8(4);
      a = a0 + a1 + a2 + a3 + a4;
      a %= Math.pow(2, 40 - this.bitPosition);
      a = Math.floor(a / Math.pow(2, 40 - this.bitPosition - bits));
    } else {
      throw new Error("Too many bits!");
    }
    if (signed) {
      if (mBits < 32) {
        if (a >>> (bits - 1)) {
          a = ((1 << bits >>> 0) - a) * -1;
        }
      } else {
        if (a / Math.pow(2, bits - 1) | 0) {
          a = (Math.pow(2, bits) - a) * -1;
        }
      }
    }
    return a;
  };

  Bitstream.prototype.readLSB = function(bits, signed) {
    var a, mBits;
    if (bits === 0) {
      return 0;
    }
    if (bits > 40) {
      throw new Error("Too many bits!");
    }
    mBits = bits + this.bitPosition;
    a = (this.stream.peekUInt8(0)) >>> this.bitPosition;
    if (mBits > 8) {
      a |= (this.stream.peekUInt8(1)) << (8 - this.bitPosition);
    }
    if (mBits > 16) {
      a |= (this.stream.peekUInt8(2)) << (16 - this.bitPosition);
    }
    if (mBits > 24) {
      a += (this.stream.peekUInt8(3)) << (24 - this.bitPosition) >>> 0;
    }
    if (mBits > 32) {
      a += (this.stream.peekUInt8(4)) * Math.pow(2, 32 - this.bitPosition);
    }
    if (mBits >= 32) {
      a %= Math.pow(2, bits);
    } else {
      a &= (1 << bits) - 1;
    }
    if (signed) {
      if (mBits < 32) {
        if (a >>> (bits - 1)) {
          a = ((1 << bits >>> 0) - a) * -1;
        }
      } else {
        if (a / Math.pow(2, bits - 1) | 0) {
          a = (Math.pow(2, bits) - a) * -1;
        }
      }
    }
    this.advance(bits);
    return a;
  };

  Bitstream.prototype.peekLSB = function(bits, signed) {
    var a, mBits;
    if (bits === 0) {
      return 0;
    }
    if (bits > 40) {
      throw new Error("Too many bits!");
    }
    mBits = bits + this.bitPosition;
    a = (this.stream.peekUInt8(0)) >>> this.bitPosition;
    if (mBits > 8) {
      a |= (this.stream.peekUInt8(1)) << (8 - this.bitPosition);
    }
    if (mBits > 16) {
      a |= (this.stream.peekUInt8(2)) << (16 - this.bitPosition);
    }
    if (mBits > 24) {
      a += (this.stream.peekUInt8(3)) << (24 - this.bitPosition) >>> 0;
    }
    if (mBits > 32) {
      a += (this.stream.peekUInt8(4)) * Math.pow(2, 32 - this.bitPosition);
    }
    if (mBits >= 32) {
      a %= Math.pow(2, bits);
    } else {
      a &= (1 << bits) - 1;
    }
    if (signed) {
      if (mBits < 32) {
        if (a >>> (bits - 1)) {
          a = ((1 << bits >>> 0) - a) * -1;
        }
      } else {
        if (a / Math.pow(2, bits - 1) | 0) {
          a = (Math.pow(2, bits) - a) * -1;
        }
      }
    }
    return a;
  };

  return Bitstream;

})();

module.exports = Bitstream;


},{}],7:[function(_dereq_,module,exports){
(function (global){
var AVBuffer;

AVBuffer = (function() {
  var BlobBuilder, URL;

  function AVBuffer(input) {
    var _ref;
    if (input instanceof Uint8Array) {
      this.data = input;
    } else if (input instanceof ArrayBuffer || Array.isArray(input) || typeof input === 'number' || ((_ref = global.Buffer) != null ? _ref.isBuffer(input) : void 0)) {
      this.data = new Uint8Array(input);
    } else if (input.buffer instanceof ArrayBuffer) {
      this.data = new Uint8Array(input.buffer, input.byteOffset, input.length * input.BYTES_PER_ELEMENT);
    } else if (input instanceof AVBuffer) {
      this.data = input.data;
    } else {
      throw new Error("Constructing buffer with unknown type.");
    }
    this.length = this.data.length;
    this.next = null;
    this.prev = null;
  }

  AVBuffer.allocate = function(size) {
    return new AVBuffer(size);
  };

  AVBuffer.prototype.copy = function() {
    return new AVBuffer(new Uint8Array(this.data));
  };

  AVBuffer.prototype.slice = function(position, length) {
    if (length == null) {
      length = this.length;
    }
    if (position === 0 && length >= this.length) {
      return new AVBuffer(this.data);
    } else {
      return new AVBuffer(this.data.subarray(position, position + length));
    }
  };

  BlobBuilder = global.BlobBuilder || global.MozBlobBuilder || global.WebKitBlobBuilder;

  URL = global.URL || global.webkitURL || global.mozURL;

  AVBuffer.makeBlob = function(data, type) {
    var bb;
    if (type == null) {
      type = 'application/octet-stream';
    }
    try {
      return new Blob([data], {
        type: type
      });
    } catch (_error) {}
    if (BlobBuilder != null) {
      bb = new BlobBuilder;
      bb.append(data);
      return bb.getBlob(type);
    }
    return null;
  };

  AVBuffer.makeBlobURL = function(data, type) {
    return URL != null ? URL.createObjectURL(this.makeBlob(data, type)) : void 0;
  };

  AVBuffer.revokeBlobURL = function(url) {
    return URL != null ? URL.revokeObjectURL(url) : void 0;
  };

  AVBuffer.prototype.toBlob = function() {
    return AVBuffer.makeBlob(this.data.buffer);
  };

  AVBuffer.prototype.toBlobURL = function() {
    return AVBuffer.makeBlobURL(this.data.buffer);
  };

  return AVBuffer;

})();

module.exports = AVBuffer;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],8:[function(_dereq_,module,exports){
var BufferList;

BufferList = (function() {
  function BufferList() {
    this.first = null;
    this.last = null;
    this.numBuffers = 0;
    this.availableBytes = 0;
    this.availableBuffers = 0;
  }

  BufferList.prototype.copy = function() {
    var result;
    result = new BufferList;
    result.first = this.first;
    result.last = this.last;
    result.numBuffers = this.numBuffers;
    result.availableBytes = this.availableBytes;
    result.availableBuffers = this.availableBuffers;
    return result;
  };

  BufferList.prototype.append = function(buffer) {
    var _ref;
    buffer.prev = this.last;
    if ((_ref = this.last) != null) {
      _ref.next = buffer;
    }
    this.last = buffer;
    if (this.first == null) {
      this.first = buffer;
    }
    this.availableBytes += buffer.length;
    this.availableBuffers++;
    return this.numBuffers++;
  };

  BufferList.prototype.advance = function() {
    if (this.first) {
      this.availableBytes -= this.first.length;
      this.availableBuffers--;
      this.first = this.first.next;
      return this.first != null;
    }
    return false;
  };

  BufferList.prototype.rewind = function() {
    var _ref;
    if (this.first && !this.first.prev) {
      return false;
    }
    this.first = ((_ref = this.first) != null ? _ref.prev : void 0) || this.last;
    if (this.first) {
      this.availableBytes += this.first.length;
      this.availableBuffers++;
    }
    return this.first != null;
  };

  BufferList.prototype.reset = function() {
    var _results;
    _results = [];
    while (this.rewind()) {
      continue;
    }
    return _results;
  };

  return BufferList;

})();

module.exports = BufferList;


},{}],9:[function(_dereq_,module,exports){
var Base, EventEmitter,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

Base = _dereq_('./base');

EventEmitter = (function(_super) {
  __extends(EventEmitter, _super);

  function EventEmitter() {
    return EventEmitter.__super__.constructor.apply(this, arguments);
  }

  EventEmitter.prototype.on = function(event, fn) {
    var _base;
    if (this.events == null) {
      this.events = {};
    }
    if ((_base = this.events)[event] == null) {
      _base[event] = [];
    }
    return this.events[event].push(fn);
  };

  EventEmitter.prototype.off = function(event, fn) {
    var index, _ref;
    if (!((_ref = this.events) != null ? _ref[event] : void 0)) {
      return;
    }
    index = this.events[event].indexOf(fn);
    if (~index) {
      return this.events[event].splice(index, 1);
    }
  };

  EventEmitter.prototype.once = function(event, fn) {
    var cb;
    return this.on(event, cb = function() {
      this.off(event, cb);
      return fn.apply(this, arguments);
    });
  };

  EventEmitter.prototype.emit = function() {
    var args, event, fn, _i, _len, _ref, _ref1;
    event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if (!((_ref = this.events) != null ? _ref[event] : void 0)) {
      return;
    }
    _ref1 = this.events[event].slice();
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      fn = _ref1[_i];
      fn.apply(this, args);
    }
  };

  return EventEmitter;

})(Base);

module.exports = EventEmitter;


},{"./base":5}],10:[function(_dereq_,module,exports){
var AVBuffer, BufferList, Stream, UnderflowError;

BufferList = _dereq_('./bufferlist');

AVBuffer = _dereq_('./buffer');

UnderflowError = _dereq_('./underflow');

Stream = (function() {
  var buf, decodeString, float32, float64, float64Fallback, float80, int16, int32, int8, nativeEndian, uint16, uint32, uint8;

  buf = new ArrayBuffer(16);

  uint8 = new Uint8Array(buf);

  int8 = new Int8Array(buf);

  uint16 = new Uint16Array(buf);

  int16 = new Int16Array(buf);

  uint32 = new Uint32Array(buf);

  int32 = new Int32Array(buf);

  float32 = new Float32Array(buf);

  if (typeof Float64Array !== "undefined" && Float64Array !== null) {
    float64 = new Float64Array(buf);
  }

  nativeEndian = new Uint16Array(new Uint8Array([0x12, 0x34]).buffer)[0] === 0x3412;

  function Stream(list) {
    this.list = list;
    this.localOffset = 0;
    this.offset = 0;
  }

  Stream.fromBuffer = function(buffer) {
    var list;
    list = new BufferList;
    list.append(buffer);
    return new Stream(list);
  };

  Stream.prototype.copy = function() {
    var result;
    result = new Stream(this.list.copy());
    result.localOffset = this.localOffset;
    result.offset = this.offset;
    return result;
  };

  Stream.prototype.available = function(bytes) {
    return bytes <= this.list.availableBytes - this.localOffset;
  };

  Stream.prototype.remainingBytes = function() {
    return this.list.availableBytes - this.localOffset;
  };

  Stream.prototype.advance = function(bytes) {
    if (!this.available(bytes)) {
      throw new UnderflowError();
    }
    this.localOffset += bytes;
    this.offset += bytes;
    while (this.list.first && this.localOffset >= this.list.first.length) {
      this.localOffset -= this.list.first.length;
      this.list.advance();
    }
    return this;
  };

  Stream.prototype.rewind = function(bytes) {
    if (bytes > this.offset) {
      throw new UnderflowError();
    }
    if (!this.list.first) {
      this.list.rewind();
      this.localOffset = this.list.first.length;
    }
    this.localOffset -= bytes;
    this.offset -= bytes;
    while (this.list.first.prev && this.localOffset < 0) {
      this.list.rewind();
      this.localOffset += this.list.first.length;
    }
    return this;
  };

  Stream.prototype.seek = function(position) {
    if (position > this.offset) {
      return this.advance(position - this.offset);
    } else if (position < this.offset) {
      return this.rewind(this.offset - position);
    }
  };

  Stream.prototype.readUInt8 = function() {
    var a;
    if (!this.available(1)) {
      throw new UnderflowError();
    }
    a = this.list.first.data[this.localOffset];
    this.localOffset += 1;
    this.offset += 1;
    if (this.localOffset === this.list.first.length) {
      this.localOffset = 0;
      this.list.advance();
    }
    return a;
  };

  Stream.prototype.peekUInt8 = function(offset) {
    var buffer;
    if (offset == null) {
      offset = 0;
    }
    if (!this.available(offset + 1)) {
      throw new UnderflowError();
    }
    offset = this.localOffset + offset;
    buffer = this.list.first;
    while (buffer) {
      if (buffer.length > offset) {
        return buffer.data[offset];
      }
      offset -= buffer.length;
      buffer = buffer.next;
    }
    return 0;
  };

  Stream.prototype.read = function(bytes, littleEndian) {
    var i, _i, _j, _ref;
    if (littleEndian == null) {
      littleEndian = false;
    }
    if (littleEndian === nativeEndian) {
      for (i = _i = 0; _i < bytes; i = _i += 1) {
        uint8[i] = this.readUInt8();
      }
    } else {
      for (i = _j = _ref = bytes - 1; _j >= 0; i = _j += -1) {
        uint8[i] = this.readUInt8();
      }
    }
  };

  Stream.prototype.peek = function(bytes, offset, littleEndian) {
    var i, _i, _j;
    if (littleEndian == null) {
      littleEndian = false;
    }
    if (littleEndian === nativeEndian) {
      for (i = _i = 0; _i < bytes; i = _i += 1) {
        uint8[i] = this.peekUInt8(offset + i);
      }
    } else {
      for (i = _j = 0; _j < bytes; i = _j += 1) {
        uint8[bytes - i - 1] = this.peekUInt8(offset + i);
      }
    }
  };

  Stream.prototype.readInt8 = function() {
    this.read(1);
    return int8[0];
  };

  Stream.prototype.peekInt8 = function(offset) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(1, offset);
    return int8[0];
  };

  Stream.prototype.readUInt16 = function(littleEndian) {
    this.read(2, littleEndian);
    return uint16[0];
  };

  Stream.prototype.peekUInt16 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(2, offset, littleEndian);
    return uint16[0];
  };

  Stream.prototype.readInt16 = function(littleEndian) {
    this.read(2, littleEndian);
    return int16[0];
  };

  Stream.prototype.peekInt16 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(2, offset, littleEndian);
    return int16[0];
  };

  Stream.prototype.readUInt24 = function(littleEndian) {
    if (littleEndian) {
      return this.readUInt16(true) + (this.readUInt8() << 16);
    } else {
      return (this.readUInt16() << 8) + this.readUInt8();
    }
  };

  Stream.prototype.peekUInt24 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    if (littleEndian) {
      return this.peekUInt16(offset, true) + (this.peekUInt8(offset + 2) << 16);
    } else {
      return (this.peekUInt16(offset) << 8) + this.peekUInt8(offset + 2);
    }
  };

  Stream.prototype.readInt24 = function(littleEndian) {
    if (littleEndian) {
      return this.readUInt16(true) + (this.readInt8() << 16);
    } else {
      return (this.readInt16() << 8) + this.readUInt8();
    }
  };

  Stream.prototype.peekInt24 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    if (littleEndian) {
      return this.peekUInt16(offset, true) + (this.peekInt8(offset + 2) << 16);
    } else {
      return (this.peekInt16(offset) << 8) + this.peekUInt8(offset + 2);
    }
  };

  Stream.prototype.readUInt32 = function(littleEndian) {
    this.read(4, littleEndian);
    return uint32[0];
  };

  Stream.prototype.peekUInt32 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(4, offset, littleEndian);
    return uint32[0];
  };

  Stream.prototype.readInt32 = function(littleEndian) {
    this.read(4, littleEndian);
    return int32[0];
  };

  Stream.prototype.peekInt32 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(4, offset, littleEndian);
    return int32[0];
  };

  Stream.prototype.readFloat32 = function(littleEndian) {
    this.read(4, littleEndian);
    return float32[0];
  };

  Stream.prototype.peekFloat32 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(4, offset, littleEndian);
    return float32[0];
  };

  Stream.prototype.readFloat64 = function(littleEndian) {
    this.read(8, littleEndian);
    if (float64) {
      return float64[0];
    } else {
      return float64Fallback();
    }
  };

  float64Fallback = function() {
    var exp, frac, high, low, out, sign;
    low = uint32[0], high = uint32[1];
    if (!high || high === 0x80000000) {
      return 0.0;
    }
    sign = 1 - (high >>> 31) * 2;
    exp = (high >>> 20) & 0x7ff;
    frac = high & 0xfffff;
    if (exp === 0x7ff) {
      if (frac) {
        return NaN;
      }
      return sign * Infinity;
    }
    exp -= 1023;
    out = (frac | 0x100000) * Math.pow(2, exp - 20);
    out += low * Math.pow(2, exp - 52);
    return sign * out;
  };

  Stream.prototype.peekFloat64 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(8, offset, littleEndian);
    if (float64) {
      return float64[0];
    } else {
      return float64Fallback();
    }
  };

  Stream.prototype.readFloat80 = function(littleEndian) {
    this.read(10, littleEndian);
    return float80();
  };

  float80 = function() {
    var a0, a1, exp, high, low, out, sign;
    high = uint32[0], low = uint32[1];
    a0 = uint8[9];
    a1 = uint8[8];
    sign = 1 - (a0 >>> 7) * 2;
    exp = ((a0 & 0x7F) << 8) | a1;
    if (exp === 0 && low === 0 && high === 0) {
      return 0;
    }
    if (exp === 0x7fff) {
      if (low === 0 && high === 0) {
        return sign * Infinity;
      }
      return NaN;
    }
    exp -= 16383;
    out = low * Math.pow(2, exp - 31);
    out += high * Math.pow(2, exp - 63);
    return sign * out;
  };

  Stream.prototype.peekFloat80 = function(offset, littleEndian) {
    if (offset == null) {
      offset = 0;
    }
    this.peek(10, offset, littleEndian);
    return float80();
  };

  Stream.prototype.readBuffer = function(length) {
    var i, result, to, _i;
    result = AVBuffer.allocate(length);
    to = result.data;
    for (i = _i = 0; _i < length; i = _i += 1) {
      to[i] = this.readUInt8();
    }
    return result;
  };

  Stream.prototype.peekBuffer = function(offset, length) {
    var i, result, to, _i;
    if (offset == null) {
      offset = 0;
    }
    result = AVBuffer.allocate(length);
    to = result.data;
    for (i = _i = 0; _i < length; i = _i += 1) {
      to[i] = this.peekUInt8(offset + i);
    }
    return result;
  };

  Stream.prototype.readSingleBuffer = function(length) {
    var result;
    result = this.list.first.slice(this.localOffset, length);
    this.advance(result.length);
    return result;
  };

  Stream.prototype.peekSingleBuffer = function(offset, length) {
    var result;
    result = this.list.first.slice(this.localOffset + offset, length);
    return result;
  };

  Stream.prototype.readString = function(length, encoding) {
    if (encoding == null) {
      encoding = 'ascii';
    }
    return decodeString.call(this, 0, length, encoding, true);
  };

  Stream.prototype.peekString = function(offset, length, encoding) {
    if (offset == null) {
      offset = 0;
    }
    if (encoding == null) {
      encoding = 'ascii';
    }
    return decodeString.call(this, offset, length, encoding, false);
  };

  decodeString = function(offset, length, encoding, advance) {
    var b1, b2, b3, b4, bom, c, end, littleEndian, nullEnd, pt, result, w1, w2;
    encoding = encoding.toLowerCase();
    nullEnd = length === null ? 0 : -1;
    if (length == null) {
      length = Infinity;
    }
    end = offset + length;
    result = '';
    switch (encoding) {
      case 'ascii':
      case 'latin1':
        while (offset < end && (c = this.peekUInt8(offset++)) !== nullEnd) {
          result += String.fromCharCode(c);
        }
        break;
      case 'utf8':
      case 'utf-8':
        while (offset < end && (b1 = this.peekUInt8(offset++)) !== nullEnd) {
          if ((b1 & 0x80) === 0) {
            result += String.fromCharCode(b1);
          } else if ((b1 & 0xe0) === 0xc0) {
            b2 = this.peekUInt8(offset++) & 0x3f;
            result += String.fromCharCode(((b1 & 0x1f) << 6) | b2);
          } else if ((b1 & 0xf0) === 0xe0) {
            b2 = this.peekUInt8(offset++) & 0x3f;
            b3 = this.peekUInt8(offset++) & 0x3f;
            result += String.fromCharCode(((b1 & 0x0f) << 12) | (b2 << 6) | b3);
          } else if ((b1 & 0xf8) === 0xf0) {
            b2 = this.peekUInt8(offset++) & 0x3f;
            b3 = this.peekUInt8(offset++) & 0x3f;
            b4 = this.peekUInt8(offset++) & 0x3f;
            pt = (((b1 & 0x0f) << 18) | (b2 << 12) | (b3 << 6) | b4) - 0x10000;
            result += String.fromCharCode(0xd800 + (pt >> 10), 0xdc00 + (pt & 0x3ff));
          }
        }
        break;
      case 'utf16-be':
      case 'utf16be':
      case 'utf16le':
      case 'utf16-le':
      case 'utf16bom':
      case 'utf16-bom':
        switch (encoding) {
          case 'utf16be':
          case 'utf16-be':
            littleEndian = false;
            break;
          case 'utf16le':
          case 'utf16-le':
            littleEndian = true;
            break;
          case 'utf16bom':
          case 'utf16-bom':
            if (length < 2 || (bom = this.peekUInt16(offset)) === nullEnd) {
              if (advance) {
                this.advance(offset += 2);
              }
              return result;
            }
            littleEndian = bom === 0xfffe;
            offset += 2;
        }
        while (offset < end && (w1 = this.peekUInt16(offset, littleEndian)) !== nullEnd) {
          offset += 2;
          if (w1 < 0xd800 || w1 > 0xdfff) {
            result += String.fromCharCode(w1);
          } else {
            if (w1 > 0xdbff) {
              throw new Error("Invalid utf16 sequence.");
            }
            w2 = this.peekUInt16(offset, littleEndian);
            if (w2 < 0xdc00 || w2 > 0xdfff) {
              throw new Error("Invalid utf16 sequence.");
            }
            result += String.fromCharCode(w1, w2);
            offset += 2;
          }
        }
        if (w1 === nullEnd) {
          offset += 2;
        }
        break;
      default:
        throw new Error("Unknown encoding: " + encoding);
    }
    if (advance) {
      this.advance(offset);
    }
    return result;
  };

  return Stream;

})();

module.exports = Stream;


},{"./buffer":7,"./bufferlist":8,"./underflow":11}],11:[function(_dereq_,module,exports){
var UnderflowError,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

UnderflowError = (function(_super) {
  __extends(UnderflowError, _super);

  function UnderflowError() {
    UnderflowError.__super__.constructor.apply(this, arguments);
    this.name = 'UnderflowError';
    this.stack = new Error().stack;
  }

  return UnderflowError;

})(Error);

module.exports = UnderflowError;


},{}],12:[function(_dereq_,module,exports){
var Bitstream, BufferList, Decoder, EventEmitter, Stream, UnderflowError,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('./core/events');

BufferList = _dereq_('./core/bufferlist');

Stream = _dereq_('./core/stream');

Bitstream = _dereq_('./core/bitstream');

UnderflowError = _dereq_('./core/underflow');

Decoder = (function(_super) {
  var codecs;

  __extends(Decoder, _super);

  function Decoder(demuxer, format) {
    var list;
    this.demuxer = demuxer;
    this.format = format;
    list = new BufferList;
    this.stream = new Stream(list);
    this.bitstream = new Bitstream(this.stream);
    this.receivedFinalBuffer = false;
    this.waiting = false;
    this.demuxer.on('cookie', (function(_this) {
      return function(cookie) {
        var error;
        try {
          return _this.setCookie(cookie);
        } catch (_error) {
          error = _error;
          return _this.emit('error', error);
        }
      };
    })(this));
    this.demuxer.on('data', (function(_this) {
      return function(chunk) {
        list.append(chunk);
        if (_this.waiting) {
          return _this.decode();
        }
      };
    })(this));
    this.demuxer.on('end', (function(_this) {
      return function() {
        _this.receivedFinalBuffer = true;
        if (_this.waiting) {
          return _this.decode();
        }
      };
    })(this));
    this.init();
  }

  Decoder.prototype.init = function() {};

  Decoder.prototype.setCookie = function(cookie) {};

  Decoder.prototype.readChunk = function() {};

  Decoder.prototype.decode = function() {
    var error, offset, packet;
    this.waiting = false;
    offset = this.bitstream.offset();
    try {
      packet = this.readChunk();
    } catch (_error) {
      error = _error;
      if (!(error instanceof UnderflowError)) {
        this.emit('error', error);
        return false;
      }
    }
    if (packet) {
      this.emit('data', packet);
      return true;
    } else if (!this.receivedFinalBuffer) {
      this.bitstream.seek(offset);
      this.waiting = true;
    } else {
      this.emit('end');
    }
    return false;
  };

  Decoder.prototype.seek = function(timestamp) {
    var seekPoint;
    seekPoint = this.demuxer.seek(timestamp);
    this.stream.seek(seekPoint.offset);
    return seekPoint.timestamp;
  };

  codecs = {};

  Decoder.register = function(id, decoder) {
    return codecs[id] = decoder;
  };

  Decoder.find = function(id) {
    return codecs[id] || null;
  };

  return Decoder;

})(EventEmitter);

module.exports = Decoder;


},{"./core/bitstream":6,"./core/bufferlist":8,"./core/events":9,"./core/stream":10,"./core/underflow":11}],13:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

var ICStream = _dereq_('./ics');
var Huffman = _dereq_('./huffman');
    
// Channel Coupling Element
function CCEElement(config) {
    this.ics = new ICStream(config);
    this.channelPair = new Array(8);
    this.idSelect = new Int32Array(8);
    this.chSelect = new Int32Array(8);
    this.gain = new Array(16);
}

CCEElement.BEFORE_TNS = 0;
CCEElement.AFTER_TNS = 1;
CCEElement.AFTER_IMDCT = 2;

const CCE_SCALE = new Float32Array([
    1.09050773266525765921,
    1.18920711500272106672,
    1.4142135623730950488016887,
    2.0
]);

CCEElement.prototype = {
    decode: function(stream, config) {
        var channelPair = this.channelPair,
            idSelect = this.idSelect,
            chSelect = this.chSelect;

        this.couplingPoint = 2 * stream.read(1);
        this.coupledCount = stream.read(3);

        var gainCount = 0;
        for (var i = 0; i <= this.coupledCount; i++) {
            gainCount++;
            channelPair[i] = stream.read(1);
            idSelect[i] = stream.read(4);

            if (channelPair[i]) {
                chSelect[i] = stream.read(2);
                if (chSelect[i] === 3)
                    gainCount++;

            } else {
                chSelect[i] = 2;
            }
        }

        this.couplingPoint += stream.read(1);
        this.couplingPoint |= (this.couplingPoint >>> 1);

        var sign = stream.read(1),
            scale = CCE_SCALE[stream.read(2)];

        this.ics.decode(stream, config, false);

        var groupCount = this.ics.info.groupCount,
            maxSFB = this.ics.info.maxSFB,
            bandTypes = this.ics.bandTypes;

        for (var i = 0; i < gainCount; i++) {
            var idx = 0,
                cge = 1,
                gain = 0,
                gainCache = 1;

            if (i > 0) {
                cge = this.couplingPoint === CCEElement.AFTER_IMDCT ? 1 : stream.read(1);
                gain = cge ? Huffman.decodeScaleFactor(stream) - 60 : 0;
                gainCache = Math.pow(scale, -gain);
            }

            var gain_i = this.gain[i] = new Float32Array(120);

            if (this.couplingPoint === CCEElement.AFTER_IMDCT) {
                gain_i[0] = gainCache;
            } else {
                for (var g = 0; g < groupCount; g++) {
                    for (var sfb = 0; sfb < maxSFB; sfb++) {
                        if (bandTypes[idx] !== ICStream.ZERO_BT) {
                            if (cge === 0) {
                                var t = Huffman.decodeScaleFactor(stream) - 60;
                                if (t !== 0) {
                                    var s = 1;
                                    t = gain += t;
                                    if (sign) {
                                        s -= 2 * (t * 0x1);
                                        t >>>= 1;
                                    }
                                    gainCache = Math.pow(scale, -t) * s;
                                }
                            }
                            gain_i[idx++] = gainCache;
                        }
                    }
                }
            }
        }
    },

    applyIndependentCoupling: function(index, data) {
        var gain = this.gain[index][0],
            iqData = this.ics.data;

        for (var i = 0; i < data.length; i++) {
            data[i] += gain * iqData[i];
        }
    },

    applyDependentCoupling: function(index, data) {
        var info = this.ics.info,
            swbOffsets = info.swbOffsets,
            groupCount = info.groupCount,
            maxSFB = info.maxSFB,
            bandTypes = this.ics.bandTypes,
            iqData = this.ics.data;

        var idx = 0,
            offset = 0,
            gains = this.gain[index];

        for (var g = 0; g < groupCount; g++) {
            var len = info.groupLength[g];

            for (var sfb = 0; sfb < maxSFB; sfb++, idx++) {
                if (bandTypes[idx] !== ICStream.ZERO_BT) {
                    var gain = gains[idx];
                    for (var group = 0; group < len; group++) {
                        for (var k = swbOffsets[sfb]; k < swbOffsets[swb + 1]; k++) {
                            data[offset + group * 128 + k] += gain * iqData[offset + group * 128 + k];
                        }
                    }
                }
            }

            offset += len * 128;
        }
    }
};

module.exports = CCEElement;

},{"./huffman":17,"./ics":18}],14:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

var ICStream = _dereq_('./ics');
    
// Channel Pair Element
function CPEElement(config) {
    this.ms_used = [];
    this.left = new ICStream(config);
    this.right = new ICStream(config);
}

const MAX_MS_MASK = 128;

const MASK_TYPE_ALL_0 = 0,
      MASK_TYPE_USED = 1,
      MASK_TYPE_ALL_1 = 2,
      MASK_TYPE_RESERVED = 3;

CPEElement.prototype.decode = function(stream, config) {
    var left = this.left,
        right = this.right,
        ms_used = this.ms_used;
        
    if (this.commonWindow = !!stream.read(1)) {
        left.info.decode(stream, config, true);
        right.info = left.info;

        var mask = stream.read(2);
        this.maskPresent = !!mask;
        
        switch (mask) {
            case MASK_TYPE_USED:
                var len = left.info.groupCount * left.info.maxSFB;
                for (var i = 0; i < len; i++) {
                    ms_used[i] = !!stream.read(1);
                }
                break;
            
            case MASK_TYPE_ALL_0:    
            case MASK_TYPE_ALL_1:
                var val = !!mask;
                for (var i = 0; i < MAX_MS_MASK; i++) {
                    ms_used[i] = val;
                }
                break;
                
            default:
                throw new Error("Reserved ms mask type: " + mask);
        }
    } else {
        for (var i = 0; i < MAX_MS_MASK; i++)
            ms_used[i] = false;
    }
    
    left.decode(stream, config, this.commonWindow);
    right.decode(stream, config, this.commonWindow);
};

module.exports = CPEElement;

},{"./ics":18}],15:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */
    
function FFT(length) {
    this.length = length;

    switch (length) {
        case 64:
            this.roots = generateFFTTableShort(64);
            break;

        case 512:
            this.roots = generateFFTTableLong(512);
            break;

        case 60:
            this.roots = generateFFTTableShort(60);
            break;

        case 480:
            this.roots = generateFFTTableLong(480);
            break;

        default:
            throw new Error("unexpected FFT length: " + length);
    }

    // processing buffers
    this.rev = new Array(length);
    for (var i = 0; i < length; i++) {
        this.rev[i] = new Float32Array(2);
    }

    this.a = new Float32Array(2);
    this.b = new Float32Array(2);
    this.c = new Float32Array(2);
    this.d = new Float32Array(2);     
    this.e1 = new Float32Array(2);
    this.e2 = new Float32Array(2);
}

function generateFFTTableShort(len) {
    var t = 2 * Math.PI / len,
        cosT = Math.cos(t),
        sinT = Math.sin(t),
        f = new Array(len);

    for (var i = 0; i < len; i++) {
        f[i] = new Float32Array(2);
    }

    f[0][0] = 1;
    f[0][1] = 0;
    var lastImag = 0;

    for (var i = 1; i < len; i++) {
        f[i][0] = f[i - 1][0] * cosT + lastImag * sinT;
        lastImag = lastImag * cosT - f[i - 1][0] * sinT;
        f[i][1] = -lastImag;
    }

    return f;
}

function generateFFTTableLong(len) {
    var t = 2 * Math.PI / len,
        cosT = Math.cos(t),
        sinT = Math.sin(t),
        f = new Array(len);

    for (var i = 0; i < len; i++) {
        f[i] = new Float32Array(3);
    }

    f[0][0] = 1;
    f[0][1] = 0;
    f[0][2] = 0;

    for (var i = 1; i < len; i++) {
        f[i][0] = f[i - 1][0] * cosT + f[i - 1][2] * sinT;
        f[i][2] = f[i - 1][2] * cosT - f[i - 1][0] * sinT;
        f[i][1] = -f[i][2];
    }

    return f;
}

FFT.prototype.process = function(input, forward) {
    var length = this.length,
        imOffset = (forward ? 2 : 1),
        scale = (forward ? length : 1),
        rev = this.rev,
        roots = this.roots;

    // bit-reversal
    var ii = 0;
    for (var i = 0; i < length; i++) {
        rev[i][0] = input[ii][0];
        rev[i][1] = input[ii][1];

        var k = length >>> 1;
        while (ii >= k && k > 0) {
            ii -= k;
            k >>= 1;
        }

        ii += k;
    }

    var a = this.a,
        b = this.b,
        c = this.c,
        d = this.d,
        e1 = this.e1,
        e2 = this.e2;

    for (var i = 0; i < length; i++) {
        input[i][0] = rev[i][0];
        input[i][1] = rev[i][1];
    }

    // bottom base-4 round
    for (var i = 0; i < length; i += 4) {
        a[0] = input[i][0] + input[i + 1][0];
        a[1] = input[i][1] + input[i + 1][1];
        b[0] = input[i + 2][0] + input[i + 3][0];
        b[1] = input[i + 2][1] + input[i + 3][1];
        c[0] = input[i][0] - input[i + 1][0];
        c[1] = input[i][1] - input[i + 1][1];
        d[0] = input[i + 2][0] - input[i + 3][0];
        d[1] = input[i + 2][1] - input[i + 3][1];
        input[i][0] = a[0] + b[0];
        input[i][1] = a[1] + b[1];
        input[i + 2][0] = a[0] - b[0];
        input[i + 2][1] = a[1] - b[1];

        e1[0] = c[0] - d[1];
        e1[1] = c[1] + d[0];
        e2[0] = c[0] + d[1];
        e2[1] = c[1] - d[0];

        if (forward) {
            input[i + 1][0] = e2[0];
            input[i + 1][1] = e2[1];
            input[i + 3][0] = e1[0];
            input[i + 3][1] = e1[1];
        } else {
            input[i + 1][0] = e1[0];
            input[i + 1][1] = e1[1];
            input[i + 3][0] = e2[0];
            input[i + 3][1] = e2[1];
        }
    }

    // iterations from bottom to top
    for (var i = 4; i < length; i <<= 1) {
        var shift = i << 1,
            m = length / shift;

        for(var j = 0; j < length; j += shift) {
            for(var k = 0; k < i; k++) {
                var km = k * m,
                    rootRe = roots[km][0],
                    rootIm = roots[km][imOffset],
                    zRe = input[i + j + k][0] * rootRe - input[i + j + k][1] * rootIm,
                    zIm = input[i + j + k][0] * rootIm + input[i + j + k][1] * rootRe;

                input[i + j + k][0] = (input[j + k][0] - zRe) * scale;
                input[i + j + k][1] = (input[j + k][1] - zIm) * scale;
                input[j + k][0] = (input[j + k][0] + zRe) * scale;
                input[j + k][1] = (input[j + k][1] + zIm) * scale;
            }
        }
    }
};

module.exports = FFT;

},{}],16:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

var ICStream = _dereq_('./ics');
var MDCT = _dereq_('./mdct');
  
function FilterBank(smallFrames, channels) {
    if (smallFrames) {
        throw new Error("WHA?? No small frames allowed.");
    }

    this.length = 1024;
    this.shortLength = 128;

    this.mid = (this.length - this.shortLength) / 2;
    this.trans = this.shortLength / 2;

    this.mdctShort = new MDCT(this.shortLength * 2);
    this.mdctLong  = new MDCT(this.length * 2);

    this.overlaps = new Array(channels);
    for (var i = 0; i < channels; i++) {
        this.overlaps[i] = new Float32Array(this.length);
    }

    this.buf = new Float32Array(2 * this.length);
}
  
function generateSineWindow(len) {
    var d = new Float32Array(len);
    for (var i = 0; i < len; i++) {
        d[i] = Math.sin((i + 0.5) * (Math.PI / (2.0 * len)))
    }
    return d;
}

function generateKBDWindow(alpha, len) {
    var PIN = Math.PI / len,
        out = new Float32Array(len),
        sum = 0,
        f = new Float32Array(len),
        alpha2 = (alpha * PIN) * (alpha * PIN);

    for (var n = 0; n < len; n++) {
        var tmp = n * (len - n) * alpha2,
            bessel = 1;

        for (var j = 50; j > 0; j--) {
            bessel = bessel * tmp / (j * j) + 1;
        }

        sum += bessel;
        f[n] = sum;
    }

    sum++;
    for (var n = 0; n < len; n++) {
        out[n] = Math.sqrt(f[n] / sum);
    }

    return out;
}

const SINE_1024 = generateSineWindow(1024),
      SINE_128  = generateSineWindow(128),
      KBD_1024  = generateKBDWindow(4, 1024),
      KBD_128   = generateKBDWindow(6, 128),
      LONG_WINDOWS = [SINE_1024, KBD_1024],
      SHORT_WINDOWS = [SINE_128, KBD_128];

FilterBank.prototype.process = function(info, input, output, channel) {
    var overlap = this.overlaps[channel],
        windowShape = info.windowShape[1],
        windowShapePrev = info.windowShape[0],
        longWindows = LONG_WINDOWS[windowShape],
        shortWindows = SHORT_WINDOWS[windowShape],
        longWindowsPrev = LONG_WINDOWS[windowShapePrev],
        shortWindowsPrev = SHORT_WINDOWS[windowShapePrev],
        length = this.length,
        shortLen = this.shortLength,
        mid = this.mid,
        trans = this.trans,
        buf = this.buf,
        mdctLong = this.mdctLong,
        mdctShort = this.mdctShort;

    switch (info.windowSequence) {
        case ICStream.ONLY_LONG_SEQUENCE:
            mdctLong.process(input, 0, buf, 0);

            // add second half output of previous frame to windowed output of current frame
            for (var i = 0; i < length; i++) {
                output[i] = overlap[i] + (buf[i] * longWindowsPrev[i]);
            }

            // window the second half and save as overlap for next frame
            for (var i = 0; i < length; i++) {
                overlap[i] = buf[length + i] * longWindows[length - 1 - i];
            }

            break;

        case ICStream.LONG_START_SEQUENCE:
            mdctLong.process(input, 0, buf, 0);

            // add second half output of previous frame to windowed output of current frame
            for (var i = 0; i < length; i++) {
                output[i] = overlap[i] + (buf[i] * longWindowsPrev[i]);
            }

            // window the second half and save as overlap for next frame
            for (var i = 0; i < mid; i++) {
                overlap[i] = buf[length + i];
            }

            for (var i = 0; i < shortLen; i++) {
                overlap[mid + i] = buf[length + mid + i] * shortWindows[shortLen - i - 1];
            }

            for (var i = 0; i < mid; i++) {
                overlap[mid + shortLen + i] = 0;
            }

            break;

        case ICStream.EIGHT_SHORT_SEQUENCE:
            for (var i = 0; i < 8; i++) {
                mdctShort.process(input, i * shortLen, buf, 2 * i * shortLen);
            }

            // add second half output of previous frame to windowed output of current frame
            for (var i = 0; i < mid; i++) {
                output[i] = overlap[i];
            }

            for (var i = 0; i < shortLen; i++) {
                output[mid + i] = overlap[mid + i] + buf[i] * shortWindowsPrev[i];
                output[mid + 1 * shortLen + i] = overlap[mid + shortLen * 1 + i] + (buf[shortLen * 1 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 2 + i]  * shortWindows[i]);
                output[mid + 2 * shortLen + i] = overlap[mid + shortLen * 2 + i] + (buf[shortLen * 3 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 4 + i] * shortWindows[i]);
                output[mid + 3 * shortLen + i] = overlap[mid + shortLen * 3 + i] + (buf[shortLen * 5 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 6 + i] * shortWindows[i]);

                if (i < trans)
                    output[mid + 4 * shortLen + i] = overlap[mid + shortLen * 4 + i] + (buf[shortLen * 7 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 8 + i] * shortWindows[i]);
            }

            // window the second half and save as overlap for next frame
            for (var i = 0; i < shortLen; i++) {
                if(i >= trans) 
                    overlap[mid + 4 * shortLen + i - length] = (buf[shortLen * 7 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 8 + i] * shortWindows[i]);

                overlap[mid + 5 * shortLen + i - length] = (buf[shortLen * 9 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 10 + i] * shortWindows[i]);
                overlap[mid + 6 * shortLen + i - length] = (buf[shortLen * 11 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 12 + i]*shortWindows[i]);
                overlap[mid + 7 * shortLen + i - length] = (buf[shortLen * 13 + i] * shortWindows[shortLen - 1 - i]) + (buf[shortLen * 14 + i]*shortWindows[i]);
                overlap[mid + 8 * shortLen + i - length] = (buf[shortLen * 15 + i] * shortWindows[shortLen - 1 - i]);
            }

            for (var i = 0; i < mid; i++) {
                overlap[mid + shortLen + i] = 0;
            }

            break;

        case ICStream.LONG_STOP_SEQUENCE:
            mdctLong.process(input, 0, buf, 0);

            // add second half output of previous frame to windowed output of current frame
            // construct first half window using padding with 1's and 0's
            for (var i = 0; i < mid; i++) {
                output[i] = overlap[i];
            }

            for (var i = 0; i < shortLen; i++) {
                output[mid + i] = overlap[mid + i] + (buf[mid + i] * shortWindowsPrev[i]);
            }

            for (var i = 0; i < mid; i++) {
                output[mid + shortLen + i] = overlap[mid + shortLen + i] + buf[mid + shortLen + i];
            }

            // window the second half and save as overlap for next frame
            for (var i = 0; i < length; i++) {
                overlap[i] = buf[length + i] * longWindows[length - 1 - i];
            }

            break;
    }
};

module.exports = FilterBank;

},{"./ics":18,"./mdct":20}],17:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

// [bit length, codeword, values...]
const HCB1 = [
    [1, 0, 0, 0, 0, 0],
    [5, 16, 1, 0, 0, 0],
    [5, 17, -1, 0, 0, 0],
    [5, 18, 0, 0, 0, -1],
    [5, 19, 0, 1, 0, 0],
    [5, 20, 0, 0, 0, 1],
    [5, 21, 0, 0, -1, 0],
    [5, 22, 0, 0, 1, 0],
    [5, 23, 0, -1, 0, 0],
    [7, 96, 1, -1, 0, 0],
    [7, 97, -1, 1, 0, 0],
    [7, 98, 0, 0, -1, 1],
    [7, 99, 0, 1, -1, 0],
    [7, 100, 0, -1, 1, 0],
    [7, 101, 0, 0, 1, -1],
    [7, 102, 1, 1, 0, 0],
    [7, 103, 0, 0, -1, -1],
    [7, 104, -1, -1, 0, 0],
    [7, 105, 0, -1, -1, 0],
    [7, 106, 1, 0, -1, 0],
    [7, 107, 0, 1, 0, -1],
    [7, 108, -1, 0, 1, 0],
    [7, 109, 0, 0, 1, 1],
    [7, 110, 1, 0, 1, 0],
    [7, 111, 0, -1, 0, 1],
    [7, 112, 0, 1, 1, 0],
    [7, 113, 0, 1, 0, 1],
    [7, 114, -1, 0, -1, 0],
    [7, 115, 1, 0, 0, 1],
    [7, 116, -1, 0, 0, -1],
    [7, 117, 1, 0, 0, -1],
    [7, 118, -1, 0, 0, 1],
    [7, 119, 0, -1, 0, -1],
    [9, 480, 1, 1, -1, 0],
    [9, 481, -1, 1, -1, 0],
    [9, 482, 1, -1, 1, 0],
    [9, 483, 0, 1, 1, -1],
    [9, 484, 0, 1, -1, 1],
    [9, 485, 0, -1, 1, 1],
    [9, 486, 0, -1, 1, -1],
    [9, 487, 1, -1, -1, 0],
    [9, 488, 1, 0, -1, 1],
    [9, 489, 0, 1, -1, -1],
    [9, 490, -1, 1, 1, 0],
    [9, 491, -1, 0, 1, -1],
    [9, 492, -1, -1, 1, 0],
    [9, 493, 0, -1, -1, 1],
    [9, 494, 1, -1, 0, 1],
    [9, 495, 1, -1, 0, -1],
    [9, 496, -1, 1, 0, -1],
    [9, 497, -1, -1, -1, 0],
    [9, 498, 0, -1, -1, -1],
    [9, 499, 0, 1, 1, 1],
    [9, 500, 1, 0, 1, -1],
    [9, 501, 1, 1, 0, 1],
    [9, 502, -1, 1, 0, 1],
    [9, 503, 1, 1, 1, 0],
    [10, 1008, -1, -1, 0, 1],
    [10, 1009, -1, 0, -1, -1],
    [10, 1010, 1, 1, 0, -1],
    [10, 1011, 1, 0, -1, -1],
    [10, 1012, -1, 0, -1, 1],
    [10, 1013, -1, -1, 0, -1],
    [10, 1014, -1, 0, 1, 1],
    [10, 1015, 1, 0, 1, 1],
    [11, 2032, 1, -1, 1, -1],
    [11, 2033, -1, 1, -1, 1],
    [11, 2034, -1, 1, 1, -1],
    [11, 2035, 1, -1, -1, 1],
    [11, 2036, 1, 1, 1, 1],
    [11, 2037, -1, -1, 1, 1],
    [11, 2038, 1, 1, -1, -1],
    [11, 2039, -1, -1, 1, -1],
    [11, 2040, -1, -1, -1, -1],
    [11, 2041, 1, 1, -1, 1],
    [11, 2042, 1, -1, 1, 1],
    [11, 2043, -1, 1, 1, 1],
    [11, 2044, -1, 1, -1, -1],
    [11, 2045, -1, -1, -1, 1],
    [11, 2046, 1, -1, -1, -1],
    [11, 2047, 1, 1, 1, -1]
];

const HCB2 = [
    [3, 0, 0, 0, 0, 0],
    [4, 2, 1, 0, 0, 0],
    [5, 6, -1, 0, 0, 0],
    [5, 7, 0, 0, 0, 1],
    [5, 8, 0, 0, -1, 0],
    [5, 9, 0, 0, 0, -1],
    [5, 10, 0, -1, 0, 0],
    [5, 11, 0, 0, 1, 0],
    [5, 12, 0, 1, 0, 0],
    [6, 26, 0, -1, 1, 0],
    [6, 27, -1, 1, 0, 0],
    [6, 28, 0, 1, -1, 0],
    [6, 29, 0, 0, 1, -1],
    [6, 30, 0, 1, 0, -1],
    [6, 31, 0, 0, -1, 1],
    [6, 32, -1, 0, 0, -1],
    [6, 33, 1, -1, 0, 0],
    [6, 34, 1, 0, -1, 0],
    [6, 35, -1, -1, 0, 0],
    [6, 36, 0, 0, -1, -1],
    [6, 37, 1, 0, 1, 0],
    [6, 38, 1, 0, 0, 1],
    [6, 39, 0, -1, 0, 1],
    [6, 40, -1, 0, 1, 0],
    [6, 41, 0, 1, 0, 1],
    [6, 42, 0, -1, -1, 0],
    [6, 43, -1, 0, 0, 1],
    [6, 44, 0, -1, 0, -1],
    [6, 45, -1, 0, -1, 0],
    [6, 46, 1, 1, 0, 0],
    [6, 47, 0, 1, 1, 0],
    [6, 48, 0, 0, 1, 1],
    [6, 49, 1, 0, 0, -1],
    [7, 100, 0, 1, -1, 1],
    [7, 101, 1, 0, -1, 1],
    [7, 102, -1, 1, -1, 0],
    [7, 103, 0, -1, 1, -1],
    [7, 104, 1, -1, 1, 0],
    [7, 105, 1, 1, 0, -1],
    [7, 106, 1, 0, 1, 1],
    [7, 107, -1, 1, 1, 0],
    [7, 108, 0, -1, -1, 1],
    [7, 109, 1, 1, 1, 0],
    [7, 110, -1, 0, 1, -1],
    [7, 111, -1, -1, -1, 0],
    [7, 112, -1, 0, -1, 1],
    [7, 113, 1, -1, -1, 0],
    [7, 114, 1, 1, -1, 0],
    [8, 230, 1, -1, 0, 1],
    [8, 231, -1, 1, 0, -1],
    [8, 232, -1, -1, 1, 0],
    [8, 233, -1, 0, 1, 1],
    [8, 234, -1, -1, 0, 1],
    [8, 235, -1, -1, 0, -1],
    [8, 236, 0, -1, -1, -1],
    [8, 237, 1, 0, 1, -1],
    [8, 238, 1, 0, -1, -1],
    [8, 239, 0, 1, -1, -1],
    [8, 240, 0, 1, 1, 1],
    [8, 241, -1, 1, 0, 1],
    [8, 242, -1, 0, -1, -1],
    [8, 243, 0, 1, 1, -1],
    [8, 244, 1, -1, 0, -1],
    [8, 245, 0, -1, 1, 1],
    [8, 246, 1, 1, 0, 1],
    [8, 247, 1, -1, 1, -1],
    [8, 248, -1, 1, -1, 1],
    [9, 498, 1, -1, -1, 1],
    [9, 499, -1, -1, -1, -1],
    [9, 500, -1, 1, 1, -1],
    [9, 501, -1, 1, 1, 1],
    [9, 502, 1, 1, 1, 1],
    [9, 503, -1, -1, 1, -1],
    [9, 504, 1, -1, 1, 1],
    [9, 505, -1, 1, -1, -1],
    [9, 506, -1, -1, 1, 1],
    [9, 507, 1, 1, -1, -1],
    [9, 508, 1, -1, -1, -1],
    [9, 509, -1, -1, -1, 1],
    [9, 510, 1, 1, -1, 1],
    [9, 511, 1, 1, 1, -1]
];

const HCB3 = [
    [1, 0, 0, 0, 0, 0],
    [4, 8, 1, 0, 0, 0],
    [4, 9, 0, 0, 0, 1],
    [4, 10, 0, 1, 0, 0],
    [4, 11, 0, 0, 1, 0],
    [5, 24, 1, 1, 0, 0],
    [5, 25, 0, 0, 1, 1],
    [6, 52, 0, 1, 1, 0],
    [6, 53, 0, 1, 0, 1],
    [6, 54, 1, 0, 1, 0],
    [6, 55, 0, 1, 1, 1],
    [6, 56, 1, 0, 0, 1],
    [6, 57, 1, 1, 1, 0],
    [7, 116, 1, 1, 1, 1],
    [7, 117, 1, 0, 1, 1],
    [7, 118, 1, 1, 0, 1],
    [8, 238, 2, 0, 0, 0],
    [8, 239, 0, 0, 0, 2],
    [8, 240, 0, 0, 1, 2],
    [8, 241, 2, 1, 0, 0],
    [8, 242, 1, 2, 1, 0],
    [9, 486, 0, 0, 2, 1],
    [9, 487, 0, 1, 2, 1],
    [9, 488, 1, 2, 0, 0],
    [9, 489, 0, 1, 1, 2],
    [9, 490, 2, 1, 1, 0],
    [9, 491, 0, 0, 2, 0],
    [9, 492, 0, 2, 1, 0],
    [9, 493, 0, 1, 2, 0],
    [9, 494, 0, 2, 0, 0],
    [9, 495, 0, 1, 0, 2],
    [9, 496, 2, 0, 1, 0],
    [9, 497, 1, 2, 1, 1],
    [9, 498, 0, 2, 1, 1],
    [9, 499, 1, 1, 2, 0],
    [9, 500, 1, 1, 2, 1],
    [10, 1002, 1, 2, 0, 1],
    [10, 1003, 1, 0, 2, 0],
    [10, 1004, 1, 0, 2, 1],
    [10, 1005, 0, 2, 0, 1],
    [10, 1006, 2, 1, 1, 1],
    [10, 1007, 1, 1, 1, 2],
    [10, 1008, 2, 1, 0, 1],
    [10, 1009, 1, 0, 1, 2],
    [10, 1010, 0, 0, 2, 2],
    [10, 1011, 0, 1, 2, 2],
    [10, 1012, 2, 2, 1, 0],
    [10, 1013, 1, 2, 2, 0],
    [10, 1014, 1, 0, 0, 2],
    [10, 1015, 2, 0, 0, 1],
    [10, 1016, 0, 2, 2, 1],
    [11, 2034, 2, 2, 0, 0],
    [11, 2035, 1, 2, 2, 1],
    [11, 2036, 1, 1, 0, 2],
    [11, 2037, 2, 0, 1, 1],
    [11, 2038, 1, 1, 2, 2],
    [11, 2039, 2, 2, 1, 1],
    [11, 2040, 0, 2, 2, 0],
    [11, 2041, 0, 2, 1, 2],
    [12, 4084, 1, 0, 2, 2],
    [12, 4085, 2, 2, 0, 1],
    [12, 4086, 2, 1, 2, 0],
    [12, 4087, 2, 2, 2, 0],
    [12, 4088, 0, 2, 2, 2],
    [12, 4089, 2, 2, 2, 1],
    [12, 4090, 2, 1, 2, 1],
    [12, 4091, 1, 2, 1, 2],
    [12, 4092, 1, 2, 2, 2],
    [13, 8186, 0, 2, 0, 2],
    [13, 8187, 2, 0, 2, 0],
    [13, 8188, 1, 2, 0, 2],
    [14, 16378, 2, 0, 2, 1],
    [14, 16379, 2, 1, 1, 2],
    [14, 16380, 2, 1, 0, 2],
    [15, 32762, 2, 2, 2, 2],
    [15, 32763, 2, 2, 1, 2],
    [15, 32764, 2, 1, 2, 2],
    [15, 32765, 2, 0, 1, 2],
    [15, 32766, 2, 0, 0, 2],
    [16, 65534, 2, 2, 0, 2],
    [16, 65535, 2, 0, 2, 2]
];

const HCB4 = [
    [4, 0, 1, 1, 1, 1],
    [4, 1, 0, 1, 1, 1],
    [4, 2, 1, 1, 0, 1],
    [4, 3, 1, 1, 1, 0],
    [4, 4, 1, 0, 1, 1],
    [4, 5, 1, 0, 0, 0],
    [4, 6, 1, 1, 0, 0],
    [4, 7, 0, 0, 0, 0],
    [4, 8, 0, 0, 1, 1],
    [4, 9, 1, 0, 1, 0],
    [5, 20, 1, 0, 0, 1],
    [5, 21, 0, 1, 1, 0],
    [5, 22, 0, 0, 0, 1],
    [5, 23, 0, 1, 0, 1],
    [5, 24, 0, 0, 1, 0],
    [5, 25, 0, 1, 0, 0],
    [7, 104, 2, 1, 1, 1],
    [7, 105, 1, 1, 2, 1],
    [7, 106, 1, 2, 1, 1],
    [7, 107, 1, 1, 1, 2],
    [7, 108, 2, 1, 1, 0],
    [7, 109, 2, 1, 0, 1],
    [7, 110, 1, 2, 1, 0],
    [7, 111, 2, 0, 1, 1],
    [7, 112, 0, 1, 2, 1],
    [8, 226, 0, 1, 1, 2],
    [8, 227, 1, 1, 2, 0],
    [8, 228, 0, 2, 1, 1],
    [8, 229, 1, 0, 1, 2],
    [8, 230, 1, 2, 0, 1],
    [8, 231, 1, 1, 0, 2],
    [8, 232, 1, 0, 2, 1],
    [8, 233, 2, 1, 0, 0],
    [8, 234, 2, 0, 1, 0],
    [8, 235, 1, 2, 0, 0],
    [8, 236, 2, 0, 0, 1],
    [8, 237, 0, 1, 0, 2],
    [8, 238, 0, 2, 1, 0],
    [8, 239, 0, 0, 1, 2],
    [8, 240, 0, 1, 2, 0],
    [8, 241, 0, 2, 0, 1],
    [8, 242, 1, 0, 0, 2],
    [8, 243, 0, 0, 2, 1],
    [8, 244, 1, 0, 2, 0],
    [8, 245, 2, 0, 0, 0],
    [8, 246, 0, 0, 0, 2],
    [9, 494, 0, 2, 0, 0],
    [9, 495, 0, 0, 2, 0],
    [9, 496, 1, 2, 2, 1],
    [9, 497, 2, 2, 1, 1],
    [9, 498, 2, 1, 2, 1],
    [9, 499, 1, 1, 2, 2],
    [9, 500, 1, 2, 1, 2],
    [9, 501, 2, 1, 1, 2],
    [10, 1004, 1, 2, 2, 0],
    [10, 1005, 2, 2, 1, 0],
    [10, 1006, 2, 1, 2, 0],
    [10, 1007, 0, 2, 2, 1],
    [10, 1008, 0, 1, 2, 2],
    [10, 1009, 2, 2, 0, 1],
    [10, 1010, 0, 2, 1, 2],
    [10, 1011, 2, 0, 2, 1],
    [10, 1012, 1, 0, 2, 2],
    [10, 1013, 2, 2, 2, 1],
    [10, 1014, 1, 2, 0, 2],
    [10, 1015, 2, 0, 1, 2],
    [10, 1016, 2, 1, 0, 2],
    [10, 1017, 1, 2, 2, 2],
    [11, 2036, 2, 1, 2, 2],
    [11, 2037, 2, 2, 1, 2],
    [11, 2038, 0, 2, 2, 0],
    [11, 2039, 2, 2, 0, 0],
    [11, 2040, 0, 0, 2, 2],
    [11, 2041, 2, 0, 2, 0],
    [11, 2042, 0, 2, 0, 2],
    [11, 2043, 2, 0, 0, 2],
    [11, 2044, 2, 2, 2, 2],
    [11, 2045, 0, 2, 2, 2],
    [11, 2046, 2, 2, 2, 0],
    [12, 4094, 2, 2, 0, 2],
    [12, 4095, 2, 0, 2, 2]
];

const HCB5 = [
    [1, 0, 0, 0],
    [4, 8, -1, 0],
    [4, 9, 1, 0],
    [4, 10, 0, 1],
    [4, 11, 0, -1],
    [5, 24, 1, -1],
    [5, 25, -1, 1],
    [5, 26, -1, -1],
    [5, 27, 1, 1],
    [7, 112, -2, 0],
    [7, 113, 0, 2],
    [7, 114, 2, 0],
    [7, 115, 0, -2],
    [8, 232, -2, -1],
    [8, 233, 2, 1],
    [8, 234, -1, -2],
    [8, 235, 1, 2],
    [8, 236, -2, 1],
    [8, 237, 2, -1],
    [8, 238, -1, 2],
    [8, 239, 1, -2],
    [8, 240, -3, 0],
    [8, 241, 3, 0],
    [8, 242, 0, -3],
    [8, 243, 0, 3],
    [9, 488, -3, -1],
    [9, 489, 1, 3],
    [9, 490, 3, 1],
    [9, 491, -1, -3],
    [9, 492, -3, 1],
    [9, 493, 3, -1],
    [9, 494, 1, -3],
    [9, 495, -1, 3],
    [9, 496, -2, 2],
    [9, 497, 2, 2],
    [9, 498, -2, -2],
    [9, 499, 2, -2],
    [10, 1000, -3, -2],
    [10, 1001, 3, -2],
    [10, 1002, -2, 3],
    [10, 1003, 2, -3],
    [10, 1004, 3, 2],
    [10, 1005, 2, 3],
    [10, 1006, -3, 2],
    [10, 1007, -2, -3],
    [10, 1008, 0, -4],
    [10, 1009, -4, 0],
    [10, 1010, 4, 1],
    [10, 1011, 4, 0],
    [11, 2024, -4, -1],
    [11, 2025, 0, 4],
    [11, 2026, 4, -1],
    [11, 2027, -1, -4],
    [11, 2028, 1, 4],
    [11, 2029, -1, 4],
    [11, 2030, -4, 1],
    [11, 2031, 1, -4],
    [11, 2032, 3, -3],
    [11, 2033, -3, -3],
    [11, 2034, -3, 3],
    [11, 2035, -2, 4],
    [11, 2036, -4, -2],
    [11, 2037, 4, 2],
    [11, 2038, 2, -4],
    [11, 2039, 2, 4],
    [11, 2040, 3, 3],
    [11, 2041, -4, 2],
    [12, 4084, -2, -4],
    [12, 4085, 4, -2],
    [12, 4086, 3, -4],
    [12, 4087, -4, -3],
    [12, 4088, -4, 3],
    [12, 4089, 3, 4],
    [12, 4090, -3, 4],
    [12, 4091, 4, 3],
    [12, 4092, 4, -3],
    [12, 4093, -3, -4],
    [13, 8188, 4, -4],
    [13, 8189, -4, 4],
    [13, 8190, 4, 4],
    [13, 8191, -4, -4]
];

const HCB6 = [
    [4, 0, 0, 0],
    [4, 1, 1, 0],
    [4, 2, 0, -1],
    [4, 3, 0, 1],
    [4, 4, -1, 0],
    [4, 5, 1, 1],
    [4, 6, -1, 1],
    [4, 7, 1, -1],
    [4, 8, -1, -1],
    [6, 36, 2, -1],
    [6, 37, 2, 1],
    [6, 38, -2, 1],
    [6, 39, -2, -1],
    [6, 40, -2, 0],
    [6, 41, -1, 2],
    [6, 42, 2, 0],
    [6, 43, 1, -2],
    [6, 44, 1, 2],
    [6, 45, 0, -2],
    [6, 46, -1, -2],
    [6, 47, 0, 2],
    [6, 48, 2, -2],
    [6, 49, -2, 2],
    [6, 50, -2, -2],
    [6, 51, 2, 2],
    [7, 104, -3, 1],
    [7, 105, 3, 1],
    [7, 106, 3, -1],
    [7, 107, -1, 3],
    [7, 108, -3, -1],
    [7, 109, 1, 3],
    [7, 110, 1, -3],
    [7, 111, -1, -3],
    [7, 112, 3, 0],
    [7, 113, -3, 0],
    [7, 114, 0, -3],
    [7, 115, 0, 3],
    [7, 116, 3, 2],
    [8, 234, -3, -2],
    [8, 235, -2, 3],
    [8, 236, 2, 3],
    [8, 237, 3, -2],
    [8, 238, 2, -3],
    [8, 239, -2, -3],
    [8, 240, -3, 2],
    [8, 241, 3, 3],
    [9, 484, 3, -3],
    [9, 485, -3, -3],
    [9, 486, -3, 3],
    [9, 487, 1, -4],
    [9, 488, -1, -4],
    [9, 489, 4, 1],
    [9, 490, -4, 1],
    [9, 491, -4, -1],
    [9, 492, 1, 4],
    [9, 493, 4, -1],
    [9, 494, -1, 4],
    [9, 495, 0, -4],
    [9, 496, -4, 2],
    [9, 497, -4, -2],
    [9, 498, 2, 4],
    [9, 499, -2, -4],
    [9, 500, -4, 0],
    [9, 501, 4, 2],
    [9, 502, 4, -2],
    [9, 503, -2, 4],
    [9, 504, 4, 0],
    [9, 505, 2, -4],
    [9, 506, 0, 4],
    [10, 1014, -3, -4],
    [10, 1015, -3, 4],
    [10, 1016, 3, -4],
    [10, 1017, 4, -3],
    [10, 1018, 3, 4],
    [10, 1019, 4, 3],
    [10, 1020, -4, 3],
    [10, 1021, -4, -3],
    [11, 2044, 4, 4],
    [11, 2045, -4, 4],
    [11, 2046, -4, -4],
    [11, 2047, 4, -4]
];

const HCB7 = [
    [1, 0, 0, 0],
    [3, 4, 1, 0],
    [3, 5, 0, 1],
    [4, 12, 1, 1],
    [6, 52, 2, 1],
    [6, 53, 1, 2],
    [6, 54, 2, 0],
    [6, 55, 0, 2],
    [7, 112, 3, 1],
    [7, 113, 1, 3],
    [7, 114, 2, 2],
    [7, 115, 3, 0],
    [7, 116, 0, 3],
    [8, 234, 2, 3],
    [8, 235, 3, 2],
    [8, 236, 1, 4],
    [8, 237, 4, 1],
    [8, 238, 1, 5],
    [8, 239, 5, 1],
    [8, 240, 3, 3],
    [8, 241, 2, 4],
    [8, 242, 0, 4],
    [8, 243, 4, 0],
    [9, 488, 4, 2],
    [9, 489, 2, 5],
    [9, 490, 5, 2],
    [9, 491, 0, 5],
    [9, 492, 6, 1],
    [9, 493, 5, 0],
    [9, 494, 1, 6],
    [9, 495, 4, 3],
    [9, 496, 3, 5],
    [9, 497, 3, 4],
    [9, 498, 5, 3],
    [9, 499, 2, 6],
    [9, 500, 6, 2],
    [9, 501, 1, 7],
    [10, 1004, 3, 6],
    [10, 1005, 0, 6],
    [10, 1006, 6, 0],
    [10, 1007, 4, 4],
    [10, 1008, 7, 1],
    [10, 1009, 4, 5],
    [10, 1010, 7, 2],
    [10, 1011, 5, 4],
    [10, 1012, 6, 3],
    [10, 1013, 2, 7],
    [10, 1014, 7, 3],
    [10, 1015, 6, 4],
    [10, 1016, 5, 5],
    [10, 1017, 4, 6],
    [10, 1018, 3, 7],
    [11, 2038, 7, 0],
    [11, 2039, 0, 7],
    [11, 2040, 6, 5],
    [11, 2041, 5, 6],
    [11, 2042, 7, 4],
    [11, 2043, 4, 7],
    [11, 2044, 5, 7],
    [11, 2045, 7, 5],
    [12, 4092, 7, 6],
    [12, 4093, 6, 6],
    [12, 4094, 6, 7],
    [12, 4095, 7, 7]
];

const HCB8 = [
    [3, 0, 1, 1],
    [4, 2, 2, 1],
    [4, 3, 1, 0],
    [4, 4, 1, 2],
    [4, 5, 0, 1],
    [4, 6, 2, 2],
    [5, 14, 0, 0],
    [5, 15, 2, 0],
    [5, 16, 0, 2],
    [5, 17, 3, 1],
    [5, 18, 1, 3],
    [5, 19, 3, 2],
    [5, 20, 2, 3],
    [6, 42, 3, 3],
    [6, 43, 4, 1],
    [6, 44, 1, 4],
    [6, 45, 4, 2],
    [6, 46, 2, 4],
    [6, 47, 3, 0],
    [6, 48, 0, 3],
    [6, 49, 4, 3],
    [6, 50, 3, 4],
    [6, 51, 5, 2],
    [7, 104, 5, 1],
    [7, 105, 2, 5],
    [7, 106, 1, 5],
    [7, 107, 5, 3],
    [7, 108, 3, 5],
    [7, 109, 4, 4],
    [7, 110, 5, 4],
    [7, 111, 0, 4],
    [7, 112, 4, 5],
    [7, 113, 4, 0],
    [7, 114, 2, 6],
    [7, 115, 6, 2],
    [7, 116, 6, 1],
    [7, 117, 1, 6],
    [8, 236, 3, 6],
    [8, 237, 6, 3],
    [8, 238, 5, 5],
    [8, 239, 5, 0],
    [8, 240, 6, 4],
    [8, 241, 0, 5],
    [8, 242, 4, 6],
    [8, 243, 7, 1],
    [8, 244, 7, 2],
    [8, 245, 2, 7],
    [8, 246, 6, 5],
    [8, 247, 7, 3],
    [8, 248, 1, 7],
    [8, 249, 5, 6],
    [8, 250, 3, 7],
    [9, 502, 6, 6],
    [9, 503, 7, 4],
    [9, 504, 6, 0],
    [9, 505, 4, 7],
    [9, 506, 0, 6],
    [9, 507, 7, 5],
    [9, 508, 7, 6],
    [9, 509, 6, 7],
    [10, 1020, 5, 7],
    [10, 1021, 7, 0],
    [10, 1022, 0, 7],
    [10, 1023, 7, 7]
];

const HCB9 = [
    [1, 0, 0, 0],
    [3, 4, 1, 0],
    [3, 5, 0, 1],
    [4, 12, 1, 1],
    [6, 52, 2, 1],
    [6, 53, 1, 2],
    [6, 54, 2, 0],
    [6, 55, 0, 2],
    [7, 112, 3, 1],
    [7, 113, 2, 2],
    [7, 114, 1, 3],
    [8, 230, 3, 0],
    [8, 231, 0, 3],
    [8, 232, 2, 3],
    [8, 233, 3, 2],
    [8, 234, 1, 4],
    [8, 235, 4, 1],
    [8, 236, 2, 4],
    [8, 237, 1, 5],
    [9, 476, 4, 2],
    [9, 477, 3, 3],
    [9, 478, 0, 4],
    [9, 479, 4, 0],
    [9, 480, 5, 1],
    [9, 481, 2, 5],
    [9, 482, 1, 6],
    [9, 483, 3, 4],
    [9, 484, 5, 2],
    [9, 485, 6, 1],
    [9, 486, 4, 3],
    [10, 974, 0, 5],
    [10, 975, 2, 6],
    [10, 976, 5, 0],
    [10, 977, 1, 7],
    [10, 978, 3, 5],
    [10, 979, 1, 8],
    [10, 980, 8, 1],
    [10, 981, 4, 4],
    [10, 982, 5, 3],
    [10, 983, 6, 2],
    [10, 984, 7, 1],
    [10, 985, 0, 6],
    [10, 986, 8, 2],
    [10, 987, 2, 8],
    [10, 988, 3, 6],
    [10, 989, 2, 7],
    [10, 990, 4, 5],
    [10, 991, 9, 1],
    [10, 992, 1, 9],
    [10, 993, 7, 2],
    [11, 1988, 6, 0],
    [11, 1989, 5, 4],
    [11, 1990, 6, 3],
    [11, 1991, 8, 3],
    [11, 1992, 0, 7],
    [11, 1993, 9, 2],
    [11, 1994, 3, 8],
    [11, 1995, 4, 6],
    [11, 1996, 3, 7],
    [11, 1997, 0, 8],
    [11, 1998, 10, 1],
    [11, 1999, 6, 4],
    [11, 2000, 2, 9],
    [11, 2001, 5, 5],
    [11, 2002, 8, 0],
    [11, 2003, 7, 0],
    [11, 2004, 7, 3],
    [11, 2005, 10, 2],
    [11, 2006, 9, 3],
    [11, 2007, 8, 4],
    [11, 2008, 1, 10],
    [11, 2009, 7, 4],
    [11, 2010, 6, 5],
    [11, 2011, 5, 6],
    [11, 2012, 4, 8],
    [11, 2013, 4, 7],
    [11, 2014, 3, 9],
    [11, 2015, 11, 1],
    [11, 2016, 5, 8],
    [11, 2017, 9, 0],
    [11, 2018, 8, 5],
    [12, 4038, 10, 3],
    [12, 4039, 2, 10],
    [12, 4040, 0, 9],
    [12, 4041, 11, 2],
    [12, 4042, 9, 4],
    [12, 4043, 6, 6],
    [12, 4044, 12, 1],
    [12, 4045, 4, 9],
    [12, 4046, 8, 6],
    [12, 4047, 1, 11],
    [12, 4048, 9, 5],
    [12, 4049, 10, 4],
    [12, 4050, 5, 7],
    [12, 4051, 7, 5],
    [12, 4052, 2, 11],
    [12, 4053, 1, 12],
    [12, 4054, 12, 2],
    [12, 4055, 11, 3],
    [12, 4056, 3, 10],
    [12, 4057, 5, 9],
    [12, 4058, 6, 7],
    [12, 4059, 8, 7],
    [12, 4060, 11, 4],
    [12, 4061, 0, 10],
    [12, 4062, 7, 6],
    [12, 4063, 12, 3],
    [12, 4064, 10, 0],
    [12, 4065, 10, 5],
    [12, 4066, 4, 10],
    [12, 4067, 6, 8],
    [12, 4068, 2, 12],
    [12, 4069, 9, 6],
    [12, 4070, 9, 7],
    [12, 4071, 4, 11],
    [12, 4072, 11, 0],
    [12, 4073, 6, 9],
    [12, 4074, 3, 11],
    [12, 4075, 5, 10],
    [13, 8152, 8, 8],
    [13, 8153, 7, 8],
    [13, 8154, 12, 5],
    [13, 8155, 3, 12],
    [13, 8156, 11, 5],
    [13, 8157, 7, 7],
    [13, 8158, 12, 4],
    [13, 8159, 11, 6],
    [13, 8160, 10, 6],
    [13, 8161, 4, 12],
    [13, 8162, 7, 9],
    [13, 8163, 5, 11],
    [13, 8164, 0, 11],
    [13, 8165, 12, 6],
    [13, 8166, 6, 10],
    [13, 8167, 12, 0],
    [13, 8168, 10, 7],
    [13, 8169, 5, 12],
    [13, 8170, 7, 10],
    [13, 8171, 9, 8],
    [13, 8172, 0, 12],
    [13, 8173, 11, 7],
    [13, 8174, 8, 9],
    [13, 8175, 9, 9],
    [13, 8176, 10, 8],
    [13, 8177, 7, 11],
    [13, 8178, 12, 7],
    [13, 8179, 6, 11],
    [13, 8180, 8, 11],
    [13, 8181, 11, 8],
    [13, 8182, 7, 12],
    [13, 8183, 6, 12],
    [14, 16368, 8, 10],
    [14, 16369, 10, 9],
    [14, 16370, 8, 12],
    [14, 16371, 9, 10],
    [14, 16372, 9, 11],
    [14, 16373, 9, 12],
    [14, 16374, 10, 11],
    [14, 16375, 12, 9],
    [14, 16376, 10, 10],
    [14, 16377, 11, 9],
    [14, 16378, 12, 8],
    [14, 16379, 11, 10],
    [14, 16380, 12, 10],
    [14, 16381, 12, 11],
    [15, 32764, 10, 12],
    [15, 32765, 11, 11],
    [15, 32766, 11, 12],
    [15, 32767, 12, 12]
];

const HCB10 = [
    [4, 0, 1, 1],
    [4, 1, 1, 2],
    [4, 2, 2, 1],
    [5, 6, 2, 2],
    [5, 7, 1, 0],
    [5, 8, 0, 1],
    [5, 9, 1, 3],
    [5, 10, 3, 2],
    [5, 11, 3, 1],
    [5, 12, 2, 3],
    [5, 13, 3, 3],
    [6, 28, 2, 0],
    [6, 29, 0, 2],
    [6, 30, 2, 4],
    [6, 31, 4, 2],
    [6, 32, 1, 4],
    [6, 33, 4, 1],
    [6, 34, 0, 0],
    [6, 35, 4, 3],
    [6, 36, 3, 4],
    [6, 37, 3, 0],
    [6, 38, 0, 3],
    [6, 39, 4, 4],
    [6, 40, 2, 5],
    [6, 41, 5, 2],
    [7, 84, 1, 5],
    [7, 85, 5, 1],
    [7, 86, 5, 3],
    [7, 87, 3, 5],
    [7, 88, 5, 4],
    [7, 89, 4, 5],
    [7, 90, 6, 2],
    [7, 91, 2, 6],
    [7, 92, 6, 3],
    [7, 93, 4, 0],
    [7, 94, 6, 1],
    [7, 95, 0, 4],
    [7, 96, 1, 6],
    [7, 97, 3, 6],
    [7, 98, 5, 5],
    [7, 99, 6, 4],
    [7, 100, 4, 6],
    [8, 202, 6, 5],
    [8, 203, 7, 2],
    [8, 204, 3, 7],
    [8, 205, 2, 7],
    [8, 206, 5, 6],
    [8, 207, 8, 2],
    [8, 208, 7, 3],
    [8, 209, 5, 0],
    [8, 210, 7, 1],
    [8, 211, 0, 5],
    [8, 212, 8, 1],
    [8, 213, 1, 7],
    [8, 214, 8, 3],
    [8, 215, 7, 4],
    [8, 216, 4, 7],
    [8, 217, 2, 8],
    [8, 218, 6, 6],
    [8, 219, 7, 5],
    [8, 220, 1, 8],
    [8, 221, 3, 8],
    [8, 222, 8, 4],
    [8, 223, 4, 8],
    [8, 224, 5, 7],
    [8, 225, 8, 5],
    [8, 226, 5, 8],
    [9, 454, 7, 6],
    [9, 455, 6, 7],
    [9, 456, 9, 2],
    [9, 457, 6, 0],
    [9, 458, 6, 8],
    [9, 459, 9, 3],
    [9, 460, 3, 9],
    [9, 461, 9, 1],
    [9, 462, 2, 9],
    [9, 463, 0, 6],
    [9, 464, 8, 6],
    [9, 465, 9, 4],
    [9, 466, 4, 9],
    [9, 467, 10, 2],
    [9, 468, 1, 9],
    [9, 469, 7, 7],
    [9, 470, 8, 7],
    [9, 471, 9, 5],
    [9, 472, 7, 8],
    [9, 473, 10, 3],
    [9, 474, 5, 9],
    [9, 475, 10, 4],
    [9, 476, 2, 10],
    [9, 477, 10, 1],
    [9, 478, 3, 10],
    [9, 479, 9, 6],
    [9, 480, 6, 9],
    [9, 481, 8, 0],
    [9, 482, 4, 10],
    [9, 483, 7, 0],
    [9, 484, 11, 2],
    [10, 970, 7, 9],
    [10, 971, 11, 3],
    [10, 972, 10, 6],
    [10, 973, 1, 10],
    [10, 974, 11, 1],
    [10, 975, 9, 7],
    [10, 976, 0, 7],
    [10, 977, 8, 8],
    [10, 978, 10, 5],
    [10, 979, 3, 11],
    [10, 980, 5, 10],
    [10, 981, 8, 9],
    [10, 982, 11, 5],
    [10, 983, 0, 8],
    [10, 984, 11, 4],
    [10, 985, 2, 11],
    [10, 986, 7, 10],
    [10, 987, 6, 10],
    [10, 988, 10, 7],
    [10, 989, 4, 11],
    [10, 990, 1, 11],
    [10, 991, 12, 2],
    [10, 992, 9, 8],
    [10, 993, 12, 3],
    [10, 994, 11, 6],
    [10, 995, 5, 11],
    [10, 996, 12, 4],
    [10, 997, 11, 7],
    [10, 998, 12, 5],
    [10, 999, 3, 12],
    [10, 1000, 6, 11],
    [10, 1001, 9, 0],
    [10, 1002, 10, 8],
    [10, 1003, 10, 0],
    [10, 1004, 12, 1],
    [10, 1005, 0, 9],
    [10, 1006, 4, 12],
    [10, 1007, 9, 9],
    [10, 1008, 12, 6],
    [10, 1009, 2, 12],
    [10, 1010, 8, 10],
    [11, 2022, 9, 10],
    [11, 2023, 1, 12],
    [11, 2024, 11, 8],
    [11, 2025, 12, 7],
    [11, 2026, 7, 11],
    [11, 2027, 5, 12],
    [11, 2028, 6, 12],
    [11, 2029, 10, 9],
    [11, 2030, 8, 11],
    [11, 2031, 12, 8],
    [11, 2032, 0, 10],
    [11, 2033, 7, 12],
    [11, 2034, 11, 0],
    [11, 2035, 10, 10],
    [11, 2036, 11, 9],
    [11, 2037, 11, 10],
    [11, 2038, 0, 11],
    [11, 2039, 11, 11],
    [11, 2040, 9, 11],
    [11, 2041, 10, 11],
    [11, 2042, 12, 0],
    [11, 2043, 8, 12],
    [12, 4088, 12, 9],
    [12, 4089, 10, 12],
    [12, 4090, 9, 12],
    [12, 4091, 11, 12],
    [12, 4092, 12, 11],
    [12, 4093, 0, 12],
    [12, 4094, 12, 10],
    [12, 4095, 12, 12]
];

const HCB11 = [
    [4, 0, 0, 0],
    [4, 1, 1, 1],
    [5, 4, 16, 16],
    [5, 5, 1, 0],
    [5, 6, 0, 1],
    [5, 7, 2, 1],
    [5, 8, 1, 2],
    [5, 9, 2, 2],
    [6, 20, 1, 3],
    [6, 21, 3, 1],
    [6, 22, 3, 2],
    [6, 23, 2, 0],
    [6, 24, 2, 3],
    [6, 25, 0, 2],
    [6, 26, 3, 3],
    [7, 54, 4, 1],
    [7, 55, 1, 4],
    [7, 56, 4, 2],
    [7, 57, 2, 4],
    [7, 58, 4, 3],
    [7, 59, 3, 4],
    [7, 60, 3, 0],
    [7, 61, 0, 3],
    [7, 62, 5, 1],
    [7, 63, 5, 2],
    [7, 64, 2, 5],
    [7, 65, 4, 4],
    [7, 66, 1, 5],
    [7, 67, 5, 3],
    [7, 68, 3, 5],
    [7, 69, 5, 4],
    [8, 140, 4, 5],
    [8, 141, 6, 2],
    [8, 142, 2, 6],
    [8, 143, 6, 1],
    [8, 144, 6, 3],
    [8, 145, 3, 6],
    [8, 146, 1, 6],
    [8, 147, 4, 16],
    [8, 148, 3, 16],
    [8, 149, 16, 5],
    [8, 150, 16, 3],
    [8, 151, 16, 4],
    [8, 152, 6, 4],
    [8, 153, 16, 6],
    [8, 154, 4, 0],
    [8, 155, 4, 6],
    [8, 156, 0, 4],
    [8, 157, 2, 16],
    [8, 158, 5, 5],
    [8, 159, 5, 16],
    [8, 160, 16, 7],
    [8, 161, 16, 2],
    [8, 162, 16, 8],
    [8, 163, 2, 7],
    [8, 164, 7, 2],
    [8, 165, 3, 7],
    [8, 166, 6, 5],
    [8, 167, 5, 6],
    [8, 168, 6, 16],
    [8, 169, 16, 10],
    [8, 170, 7, 3],
    [8, 171, 7, 1],
    [8, 172, 16, 9],
    [8, 173, 7, 16],
    [8, 174, 1, 16],
    [8, 175, 1, 7],
    [8, 176, 4, 7],
    [8, 177, 16, 11],
    [8, 178, 7, 4],
    [8, 179, 16, 12],
    [8, 180, 8, 16],
    [8, 181, 16, 1],
    [8, 182, 6, 6],
    [8, 183, 9, 16],
    [8, 184, 2, 8],
    [8, 185, 5, 7],
    [8, 186, 10, 16],
    [8, 187, 16, 13],
    [8, 188, 8, 3],
    [8, 189, 8, 2],
    [8, 190, 3, 8],
    [8, 191, 5, 0],
    [8, 192, 16, 14],
    [8, 193, 11, 16],
    [8, 194, 7, 5],
    [8, 195, 4, 8],
    [8, 196, 6, 7],
    [8, 197, 7, 6],
    [8, 198, 0, 5],
    [9, 398, 8, 4],
    [9, 399, 16, 15],
    [9, 400, 12, 16],
    [9, 401, 1, 8],
    [9, 402, 8, 1],
    [9, 403, 14, 16],
    [9, 404, 5, 8],
    [9, 405, 13, 16],
    [9, 406, 3, 9],
    [9, 407, 8, 5],
    [9, 408, 7, 7],
    [9, 409, 2, 9],
    [9, 410, 8, 6],
    [9, 411, 9, 2],
    [9, 412, 9, 3],
    [9, 413, 15, 16],
    [9, 414, 4, 9],
    [9, 415, 6, 8],
    [9, 416, 6, 0],
    [9, 417, 9, 4],
    [9, 418, 5, 9],
    [9, 419, 8, 7],
    [9, 420, 7, 8],
    [9, 421, 1, 9],
    [9, 422, 10, 3],
    [9, 423, 0, 6],
    [9, 424, 10, 2],
    [9, 425, 9, 1],
    [9, 426, 9, 5],
    [9, 427, 4, 10],
    [9, 428, 2, 10],
    [9, 429, 9, 6],
    [9, 430, 3, 10],
    [9, 431, 6, 9],
    [9, 432, 10, 4],
    [9, 433, 8, 8],
    [9, 434, 10, 5],
    [9, 435, 9, 7],
    [9, 436, 11, 3],
    [9, 437, 1, 10],
    [9, 438, 7, 0],
    [9, 439, 10, 6],
    [9, 440, 7, 9],
    [9, 441, 3, 11],
    [9, 442, 5, 10],
    [9, 443, 10, 1],
    [9, 444, 4, 11],
    [9, 445, 11, 2],
    [9, 446, 13, 2],
    [9, 447, 6, 10],
    [9, 448, 13, 3],
    [9, 449, 2, 11],
    [9, 450, 16, 0],
    [9, 451, 5, 11],
    [9, 452, 11, 5],
    [10, 906, 11, 4],
    [10, 907, 9, 8],
    [10, 908, 7, 10],
    [10, 909, 8, 9],
    [10, 910, 0, 16],
    [10, 911, 4, 13],
    [10, 912, 0, 7],
    [10, 913, 3, 13],
    [10, 914, 11, 6],
    [10, 915, 13, 1],
    [10, 916, 13, 4],
    [10, 917, 12, 3],
    [10, 918, 2, 13],
    [10, 919, 13, 5],
    [10, 920, 8, 10],
    [10, 921, 6, 11],
    [10, 922, 10, 8],
    [10, 923, 10, 7],
    [10, 924, 14, 2],
    [10, 925, 12, 4],
    [10, 926, 1, 11],
    [10, 927, 4, 12],
    [10, 928, 11, 1],
    [10, 929, 3, 12],
    [10, 930, 1, 13],
    [10, 931, 12, 2],
    [10, 932, 7, 11],
    [10, 933, 3, 14],
    [10, 934, 5, 12],
    [10, 935, 5, 13],
    [10, 936, 14, 4],
    [10, 937, 4, 14],
    [10, 938, 11, 7],
    [10, 939, 14, 3],
    [10, 940, 12, 5],
    [10, 941, 13, 6],
    [10, 942, 12, 6],
    [10, 943, 8, 0],
    [10, 944, 11, 8],
    [10, 945, 2, 12],
    [10, 946, 9, 9],
    [10, 947, 14, 5],
    [10, 948, 6, 13],
    [10, 949, 10, 10],
    [10, 950, 15, 2],
    [10, 951, 8, 11],
    [10, 952, 9, 10],
    [10, 953, 14, 6],
    [10, 954, 10, 9],
    [10, 955, 5, 14],
    [10, 956, 11, 9],
    [10, 957, 14, 1],
    [10, 958, 2, 14],
    [10, 959, 6, 12],
    [10, 960, 1, 12],
    [10, 961, 13, 8],
    [10, 962, 0, 8],
    [10, 963, 13, 7],
    [10, 964, 7, 12],
    [10, 965, 12, 7],
    [10, 966, 7, 13],
    [10, 967, 15, 3],
    [10, 968, 12, 1],
    [10, 969, 6, 14],
    [10, 970, 2, 15],
    [10, 971, 15, 5],
    [10, 972, 15, 4],
    [10, 973, 1, 14],
    [10, 974, 9, 11],
    [10, 975, 4, 15],
    [10, 976, 14, 7],
    [10, 977, 8, 13],
    [10, 978, 13, 9],
    [10, 979, 8, 12],
    [10, 980, 5, 15],
    [10, 981, 3, 15],
    [10, 982, 10, 11],
    [10, 983, 11, 10],
    [10, 984, 12, 8],
    [10, 985, 15, 6],
    [10, 986, 15, 7],
    [10, 987, 8, 14],
    [10, 988, 15, 1],
    [10, 989, 7, 14],
    [10, 990, 9, 0],
    [10, 991, 0, 9],
    [10, 992, 9, 13],
    [10, 993, 9, 12],
    [10, 994, 12, 9],
    [10, 995, 14, 8],
    [10, 996, 10, 13],
    [10, 997, 14, 9],
    [10, 998, 12, 10],
    [10, 999, 6, 15],
    [10, 1000, 7, 15],
    [11, 2002, 9, 14],
    [11, 2003, 15, 8],
    [11, 2004, 11, 11],
    [11, 2005, 11, 14],
    [11, 2006, 1, 15],
    [11, 2007, 10, 12],
    [11, 2008, 10, 14],
    [11, 2009, 13, 11],
    [11, 2010, 13, 10],
    [11, 2011, 11, 13],
    [11, 2012, 11, 12],
    [11, 2013, 8, 15],
    [11, 2014, 14, 11],
    [11, 2015, 13, 12],
    [11, 2016, 12, 13],
    [11, 2017, 15, 9],
    [11, 2018, 14, 10],
    [11, 2019, 10, 0],
    [11, 2020, 12, 11],
    [11, 2021, 9, 15],
    [11, 2022, 0, 10],
    [11, 2023, 12, 12],
    [11, 2024, 11, 0],
    [11, 2025, 12, 14],
    [11, 2026, 10, 15],
    [11, 2027, 13, 13],
    [11, 2028, 0, 13],
    [11, 2029, 14, 12],
    [11, 2030, 15, 10],
    [11, 2031, 15, 11],
    [11, 2032, 11, 15],
    [11, 2033, 14, 13],
    [11, 2034, 13, 0],
    [11, 2035, 0, 11],
    [11, 2036, 13, 14],
    [11, 2037, 15, 12],
    [11, 2038, 15, 13],
    [11, 2039, 12, 15],
    [11, 2040, 14, 0],
    [11, 2041, 14, 14],
    [11, 2042, 13, 15],
    [11, 2043, 12, 0],
    [11, 2044, 14, 15],
    [12, 4090, 0, 14],
    [12, 4091, 0, 12],
    [12, 4092, 15, 14],
    [12, 4093, 15, 0],
    [12, 4094, 0, 15],
    [12, 4095, 15, 15]
];

const HCB_SF = [
    [1, 0, 60],
    [3, 4, 59],
    [4, 10, 61],
    [4, 11, 58],
    [4, 12, 62],
    [5, 26, 57],
    [5, 27, 63],
    [6, 56, 56],
    [6, 57, 64],
    [6, 58, 55],
    [6, 59, 65],
    [7, 120, 66],
    [7, 121, 54],
    [7, 122, 67],
    [8, 246, 53],
    [8, 247, 68],
    [8, 248, 52],
    [8, 249, 69],
    [8, 250, 51],
    [9, 502, 70],
    [9, 503, 50],
    [9, 504, 49],
    [9, 505, 71],
    [10, 1012, 72],
    [10, 1013, 48],
    [10, 1014, 73],
    [10, 1015, 47],
    [10, 1016, 74],
    [10, 1017, 46],
    [11, 2036, 76],
    [11, 2037, 75],
    [11, 2038, 77],
    [11, 2039, 78],
    [11, 2040, 45],
    [11, 2041, 43],
    [12, 4084, 44],
    [12, 4085, 79],
    [12, 4086, 42],
    [12, 4087, 41],
    [12, 4088, 80],
    [12, 4089, 40],
    [13, 8180, 81],
    [13, 8181, 39],
    [13, 8182, 82],
    [13, 8183, 38],
    [13, 8184, 83],
    [14, 16370, 37],
    [14, 16371, 35],
    [14, 16372, 85],
    [14, 16373, 33],
    [14, 16374, 36],
    [14, 16375, 34],
    [14, 16376, 84],
    [14, 16377, 32],
    [15, 32756, 87],
    [15, 32757, 89],
    [15, 32758, 30],
    [15, 32759, 31],
    [16, 65520, 86],
    [16, 65521, 29],
    [16, 65522, 26],
    [16, 65523, 27],
    [16, 65524, 28],
    [16, 65525, 24],
    [16, 65526, 88],
    [17, 131054, 25],
    [17, 131055, 22],
    [17, 131056, 23],
    [18, 262114, 90],
    [18, 262115, 21],
    [18, 262116, 19],
    [18, 262117, 3],
    [18, 262118, 1],
    [18, 262119, 2],
    [18, 262120, 0],
    [19, 524242, 98],
    [19, 524243, 99],
    [19, 524244, 100],
    [19, 524245, 101],
    [19, 524246, 102],
    [19, 524247, 117],
    [19, 524248, 97],
    [19, 524249, 91],
    [19, 524250, 92],
    [19, 524251, 93],
    [19, 524252, 94],
    [19, 524253, 95],
    [19, 524254, 96],
    [19, 524255, 104],
    [19, 524256, 111],
    [19, 524257, 112],
    [19, 524258, 113],
    [19, 524259, 114],
    [19, 524260, 115],
    [19, 524261, 116],
    [19, 524262, 110],
    [19, 524263, 105],
    [19, 524264, 106],
    [19, 524265, 107],
    [19, 524266, 108],
    [19, 524267, 109],
    [19, 524268, 118],
    [19, 524269, 6],
    [19, 524270, 8],
    [19, 524271, 9],
    [19, 524272, 10],
    [19, 524273, 5],
    [19, 524274, 103],
    [19, 524275, 120],
    [19, 524276, 119],
    [19, 524277, 4],
    [19, 524278, 7],
    [19, 524279, 15],
    [19, 524280, 16],
    [19, 524281, 18],
    [19, 524282, 20],
    [19, 524283, 17],
    [19, 524284, 11],
    [19, 524285, 12],
    [19, 524286, 14],
    [19, 524287, 13]
];

const CODEBOOKS = [HCB1, HCB2, HCB3, HCB4, HCB5, HCB6, HCB7, HCB8, HCB9, HCB10, HCB11];
const UNSIGNED = [false, false, true, true, false, false, true, true, true, true, true],
      QUAD_LEN = 4, 
      PAIR_LEN = 2;

var Huffman = {
    findOffset: function(stream, table) {
        var off = 0,
            len = table[off][0],
            cw = stream.read(len);
            
        while (cw !== table[off][1]) {
            var j = table[++off][0] - len;
            len = table[off][0];
            cw <<= j;
            cw |= stream.read(j);
        }
        
        return off;
    },
    
    signValues: function(stream, data, off, len) {
        for (var i = off; i < off + len; i++) {
            if (data[i] && stream.read(1))
                data[i] = -data[i];
        }
    },
    
    getEscape: function(stream, s) {
        var i = 4;
        while (stream.read(1))
            i++;
            
        var j = stream.read(i) | (1 << i);
        return s < 0 ? -j : j;
    },
    
    decodeScaleFactor: function(stream) {
        var offset = this.findOffset(stream, HCB_SF);
        return HCB_SF[offset][2];
    },
    
    decodeSpectralData: function(stream, cb, data, off) {
        var HCB = CODEBOOKS[cb - 1],
            offset = this.findOffset(stream, HCB);
            
        data[off] = HCB[offset][2];
        data[off + 1] = HCB[offset][3];
        
        if (cb < 5) {
            data[off + 2] = HCB[offset][4];
            data[off + 3] = HCB[offset][5];
        }
        
        // sign and escape
        if (cb < 11) {
            if (UNSIGNED[cb - 1])
                this.signValues(stream, data, off, cb < 5 ? QUAD_LEN : PAIR_LEN);
                
        } else if (cb === 11 || cb > 15) {
            this.signValues(stream, data, off, cb < 5 ? QUAD_LEN : PAIR_LEN);
            
            if (Math.abs(data[off]) === 16) 
                data[off] = this.getEscape(stream, data[off]);
                
            if (Math.abs(data[off + 1]) === 16)
                data[off + 1] = this.getEscape(stream, data[off + 1]);
        } else {
            throw new Error("Huffman: unknown spectral codebook: " + cb);
        }
    }
};

module.exports = Huffman;

},{}],18:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

var tables = _dereq_('./tables');
var Huffman = _dereq_('./huffman');
var TNS = _dereq_('./tns');
    
// Individual Channel Stream
function ICStream(config) {
    this.info = new ICSInfo();
    this.bandTypes = new Int32Array(MAX_SECTIONS);
    this.sectEnd = new Int32Array(MAX_SECTIONS);
    this.data = new Float32Array(config.frameLength);
    this.scaleFactors = new Float32Array(MAX_SECTIONS);
    this.randomState = 0x1F2E3D4C;
    this.tns = new TNS(config);
    this.specBuf = new Int32Array(4);
}
      
ICStream.ZERO_BT = 0;         // Scalefactors and spectral data are all zero.
ICStream.FIRST_PAIR_BT = 5;   // This and later band types encode two values (rather than four) with one code word.
ICStream.ESC_BT = 11;         // Spectral data are coded with an escape sequence.
ICStream.NOISE_BT = 13;       // Spectral data are scaled white noise not coded in the bitstream.
ICStream.INTENSITY_BT2 = 14;  // Scalefactor data are intensity stereo positions.
ICStream.INTENSITY_BT = 15;   // Scalefactor data are intensity stereo positions.

ICStream.ONLY_LONG_SEQUENCE = 0;
ICStream.LONG_START_SEQUENCE = 1;
ICStream.EIGHT_SHORT_SEQUENCE = 2;
ICStream.LONG_STOP_SEQUENCE = 3;

const MAX_SECTIONS = 120,
      MAX_WINDOW_GROUP_COUNT = 8;

const SF_DELTA = 60,
      SF_OFFSET = 200;

ICStream.prototype = {
    decode: function(stream, config, commonWindow) {
        this.globalGain = stream.read(8);
        
        if (!commonWindow)
            this.info.decode(stream, config, commonWindow);
            
        this.decodeBandTypes(stream, config);
        this.decodeScaleFactors(stream);
        
        if (this.pulsePresent = stream.read(1)) {
            if (this.info.windowSequence === ICStream.EIGHT_SHORT_SEQUENCE)
                throw new Error("Pulse tool not allowed in eight short sequence.");
                
            this.decodePulseData(stream);
        }
        
        if (this.tnsPresent = stream.read(1)) {
            this.tns.decode(stream, this.info);
        }
        
        if (this.gainPresent = stream.read(1)) {
            throw new Error("TODO: decode gain control/SSR");
        }
        
        this.decodeSpectralData(stream);
    },
    
    decodeBandTypes: function(stream, config) {
        var bits = this.info.windowSequence === ICStream.EIGHT_SHORT_SEQUENCE ? 3 : 5,
            groupCount = this.info.groupCount,
            maxSFB = this.info.maxSFB,
            bandTypes = this.bandTypes,
            sectEnd = this.sectEnd,
            idx = 0,
            escape = (1 << bits) - 1;
        
        for (var g = 0; g < groupCount; g++) {
            var k = 0;
            while (k < maxSFB) {
                var end = k,
                    bandType = stream.read(4);
                    
                if (bandType === 12)
                    throw new Error("Invalid band type: 12");
                    
                var incr;
                while ((incr = stream.read(bits)) === escape)
                    end += incr;
                    
                end += incr;
                
                if (end > maxSFB)
                    throw new Error("Too many bands (" + end + " > " + maxSFB + ")");
                    
                for (; k < end; k++) {
                    bandTypes[idx] = bandType;
                    sectEnd[idx++] = end;
                }
            }
        }
    },
    
    decodeScaleFactors: function(stream) {
        var groupCount = this.info.groupCount,
            maxSFB = this.info.maxSFB,
            offset = [this.globalGain, this.globalGain - 90, 0], // spectrum, noise, intensity
            idx = 0,
            noiseFlag = true,
            scaleFactors = this.scaleFactors,
            sectEnd = this.sectEnd,
            bandTypes = this.bandTypes;
                        
        for (var g = 0; g < groupCount; g++) {
            for (var i = 0; i < maxSFB;) {
                var runEnd = sectEnd[idx];
                
                switch (bandTypes[idx]) {
                    case ICStream.ZERO_BT:
                        for (; i < runEnd; i++, idx++) {
                            scaleFactors[idx] = 0;
                        }
                        break;
                        
                    case ICStream.INTENSITY_BT:
                    case ICStream.INTENSITY_BT2:
                        for(; i < runEnd; i++, idx++) {
                            offset[2] += Huffman.decodeScaleFactor(stream) - SF_DELTA;
                            var tmp = Math.min(Math.max(offset[2], -155), 100);
                            scaleFactors[idx] = tables.SCALEFACTOR_TABLE[-tmp + SF_OFFSET];
                        }
                        break;
                        
                    case ICStream.NOISE_BT:
                        for(; i < runEnd; i++, idx++) {
                            if (noiseFlag) {
                                offset[1] += stream.read(9) - 256;
                                noiseFlag = false;
                            } else {
                                offset[1] += Huffman.decodeScaleFactor(stream) - SF_DELTA;
                            }
                            var tmp = Math.min(Math.max(offset[1], -100), 155);
                            scaleFactors[idx] = -tables.SCALEFACTOR_TABLE[tmp + SF_OFFSET];
                        }
                        break;
                        
                    default:
                        for(; i < runEnd; i++, idx++) {
                            offset[0] += Huffman.decodeScaleFactor(stream) - SF_DELTA;
                            if(offset[0] > 255) 
                                throw new Error("Scalefactor out of range: " + offset[0]);
                                
                            scaleFactors[idx] = tables.SCALEFACTOR_TABLE[offset[0] - 100 + SF_OFFSET];
                        }
                        break;
                }
            }
        }
    },
    
    decodePulseData: function(stream) {
        var pulseCount = stream.read(2) + 1,
            pulseSWB = stream.read(6);
            
        if (pulseSWB >= this.info.swbCount)
            throw new Error("Pulse SWB out of range: " + pulseSWB);
            
        if (!this.pulseOffset || this.pulseOffset.length !== pulseCount) {
            // only reallocate if needed
            this.pulseOffset = new Int32Array(pulseCount);
            this.pulseAmp = new Int32Array(pulseCount);
        }
        
        this.pulseOffset[0] = this.info.swbOffsets[pulseSWB] + stream.read(5);
        this.pulseAmp[0] = stream.read(4);
        
        if (this.pulseOffset[0] > 1023)
            throw new Error("Pulse offset out of range: " + this.pulseOffset[0]);
        
        for (var i = 1; i < pulseCount; i++) {
            this.pulseOffset[i] = stream.read(5) + this.pulseOffset[i - 1];
            if (this.pulseOffset[i] > 1023)
                throw new Error("Pulse offset out of range: " + this.pulseOffset[i]);
                
            this.pulseAmp[i] = stream.read(4);
        }
    },
    
    decodeSpectralData: function(stream) {
        var data = this.data,
            info = this.info,
            maxSFB = info.maxSFB,
            windowGroups = info.groupCount,
            offsets = info.swbOffsets,
            bandTypes = this.bandTypes,
            scaleFactors = this.scaleFactors,
            buf = this.specBuf;
            
        var groupOff = 0, idx = 0;
        for (var g = 0; g < windowGroups; g++) {
            var groupLen = info.groupLength[g];
            
            for (var sfb = 0; sfb < maxSFB; sfb++, idx++) {
                var hcb = bandTypes[idx],
                    off = groupOff + offsets[sfb],
                    width = offsets[sfb + 1] - offsets[sfb];
                    
                if (hcb === ICStream.ZERO_BT || hcb === ICStream.INTENSITY_BT || hcb === ICStream.INTENSITY_BT2) {
                    for (var group = 0; group < groupLen; group++, off += 128) {
                        for (var i = off; i < off + width; i++) {
                            data[i] = 0;
                        }
                    }
                } else if (hcb === ICStream.NOISE_BT) {
                    // fill with random values
                    for (var group = 0; group < groupLen; group++, off += 128) {
                        var energy = 0;
                        
                        for (var k = 0; k < width; k++) {
                            this.randomState *= 1664525 + 1013904223;
                            data[off + k] = this.randomState;
                            energy += data[off + k] * data[off + k];
                        }
                        
                        var scale = scaleFactors[idx] / Math.sqrt(energy);
                        for (var k = 0; k < width; k++) {
                            data[off + k] *= scale;
                        }
                    }
                } else {
                    for (var group = 0; group < groupLen; group++, off += 128) {
                        var num = (hcb >= ICStream.FIRST_PAIR_BT) ? 2 : 4;
                        for (var k = 0; k < width; k += num) {
                            Huffman.decodeSpectralData(stream, hcb, buf, 0);
                            
                            // inverse quantization & scaling
                            for (var j = 0; j < num; j++) {
                                data[off + k + j] = (buf[j] > 0) ? tables.IQ_TABLE[buf[j]] : -tables.IQ_TABLE[-buf[j]];
                                data[off + k + j] *= scaleFactors[idx];
                            }
                        }
                    }
                }
            }
            groupOff += groupLen << 7;
        }
        
        // add pulse data, if present
        if (this.pulsePresent) {
            throw new Error('TODO: add pulse data');
        }
    }
}

// Individual Channel Stream Info
function ICSInfo() {
    this.windowShape = new Int32Array(2);
    this.windowSequence = ICStream.ONLY_LONG_SEQUENCE;
    this.groupLength = new Int32Array(MAX_WINDOW_GROUP_COUNT);
    this.ltpData1Present = false;
    this.ltpData2Present = false;
}

ICSInfo.prototype = {
    decode: function(stream, config, commonWindow) {
        stream.advance(1); // reserved
        
        this.windowSequence = stream.read(2);
        this.windowShape[0] = this.windowShape[1];
        this.windowShape[1] = stream.read(1);
        
        this.groupCount = 1;
        this.groupLength[0] = 1;
        
        if (this.windowSequence === ICStream.EIGHT_SHORT_SEQUENCE) {
            this.maxSFB = stream.read(4);
            for (var i = 0; i < 7; i++) {
                if (stream.read(1)) {
                    this.groupLength[this.groupCount - 1]++;
                } else {
                    this.groupCount++;
                    this.groupLength[this.groupCount - 1] = 1;
                }
            }
            
            this.windowCount = 8;
            this.swbOffsets = tables.SWB_OFFSET_128[config.sampleIndex];
            this.swbCount = tables.SWB_SHORT_WINDOW_COUNT[config.sampleIndex];
            this.predictorPresent = false;
        } else {
            this.maxSFB = stream.read(6);
            this.windowCount = 1;
            this.swbOffsets = tables.SWB_OFFSET_1024[config.sampleIndex];
            this.swbCount = tables.SWB_LONG_WINDOW_COUNT[config.sampleIndex];
            this.predictorPresent = !!stream.read(1);
            
            if (this.predictorPresent)
                this.decodePrediction(stream, config, commonWindow);
        }
    },
    
    decodePrediction: function(stream, config, commonWindow) {
        throw new Error('Prediction not implemented.');
        
        switch (config.profile) {
            case AOT_AAC_MAIN:
                throw new Error('Prediction not implemented.');
                break;
                
            case AOT_AAC_LTP:
                throw new Error('LTP prediction not implemented.');
                break;
                
            default:
                throw new Error('Unsupported profile for prediction ' + config.profile);
        }
    }
};

module.exports = ICStream;

},{"./huffman":17,"./tables":22,"./tns":23}],19:[function(_dereq_,module,exports){

/*
   AAC.js - Advanced Audio Coding decoder in JavaScript
   Created by Devon Govett
   Copyright (c) 2012, Official.fm Labs

   AAC.js is free software; you can redistribute it and/or modify it
   under the terms of the GNU Lesser General Public License as
   published by the Free Software Foundation; either version 3 of the
   License, or (at your option) any later version.

   AAC.js is distributed in the hope that it will be useful, but WITHOUT
   ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
   or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General
   Public License for more details.

   You should have received a copy of the GNU Lesser General Public
   License along with this library.
   If not, see <http://www.gnu.org/licenses/>.
 */
var AACDecoder, ADTSDemuxer, Bitstream, CCEElement, CPEElement, Decoder, FilterBank, ICStream, Stream, tables,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

ADTSDemuxer = _dereq_('../../demuxers/adts');

Decoder = _dereq_('../../decoder');

Bitstream = _dereq_('../../core/bitstream');

Stream = _dereq_('../../core/stream');

ICStream = _dereq_('./ics');

CPEElement = _dereq_('./cpe');

CCEElement = _dereq_('./cce');

FilterBank = _dereq_('./filter_bank');

tables = _dereq_('./tables');

AACDecoder = (function(_super) {
  var AOT_AAC_LC, AOT_AAC_LTP, AOT_AAC_MAIN, AOT_ESCAPE, CCE_ELEMENT, CHANNEL_CONFIG_FIVE, CHANNEL_CONFIG_FIVE_PLUS_ONE, CHANNEL_CONFIG_MONO, CHANNEL_CONFIG_NONE, CHANNEL_CONFIG_SEVEN_PLUS_ONE, CHANNEL_CONFIG_STEREO, CHANNEL_CONFIG_STEREO_PLUS_CENTER, CHANNEL_CONFIG_STEREO_PLUS_CENTER_PLUS_REAR_MONO, CPE_ELEMENT, DSE_ELEMENT, END_ELEMENT, FIL_ELEMENT, LFE_ELEMENT, PCE_ELEMENT, SCE_ELEMENT;

  __extends(AACDecoder, _super);

  function AACDecoder() {
    return AACDecoder.__super__.constructor.apply(this, arguments);
  }

  Decoder.register('mp4a', AACDecoder);

  Decoder.register('aac ', AACDecoder);

  AOT_AAC_MAIN = 1;

  AOT_AAC_LC = 2;

  AOT_AAC_LTP = 4;

  AOT_ESCAPE = 31;

  CHANNEL_CONFIG_NONE = 0;

  CHANNEL_CONFIG_MONO = 1;

  CHANNEL_CONFIG_STEREO = 2;

  CHANNEL_CONFIG_STEREO_PLUS_CENTER = 3;

  CHANNEL_CONFIG_STEREO_PLUS_CENTER_PLUS_REAR_MONO = 4;

  CHANNEL_CONFIG_FIVE = 5;

  CHANNEL_CONFIG_FIVE_PLUS_ONE = 6;

  CHANNEL_CONFIG_SEVEN_PLUS_ONE = 8;

  AACDecoder.prototype.init = function() {
    return this.format.floatingPoint = true;
  };

  AACDecoder.prototype.setCookie = function(buffer) {
    CHANNEL_CONFIG_FIVE_PLUS_ONE;
    var data, i, stream, _i, _ref;
    data = Stream.fromBuffer(buffer);
    stream = new Bitstream(data);
    this.config = {};
    this.config.profile = stream.read(5);
    if (this.config.profile === AOT_ESCAPE) {
      this.config.profile = 32 + stream.read(6);
    }
    this.config.sampleIndex = stream.read(4);
    if (this.config.sampleIndex === 0x0f) {
      this.config.sampleRate = stream.read(24);
      for (i = _i = 0, _ref = tables.SAMPLE_RATES.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        if (tables.SAMPLE_RATES[i] === this.config.sampleRate) {
          this.config.sampleIndex = i;
          break;
        }
      }
    } else {
      this.config.sampleRate = tables.SAMPLE_RATES[this.config.sampleIndex];
    }
    this.config.chanConfig = stream.read(4);
    this.format.channelsPerFrame = this.config.chanConfig;
    switch (this.config.profile) {
      case AOT_AAC_LTP:
      case AOT_AAC_MAIN:
      case AOT_AAC_LC:
        if (stream.read(1)) {
          throw new Error('frameLengthFlag not supported');
        }
        this.config.frameLength = 1024;
        if (stream.read(1)) {
          stream.advance(14);
        }
        if (stream.read(1)) {
          if (this.config.profile > 16) {
            this.config.sectionDataResilience = stream.read(1);
            this.config.scalefactorResilience = stream.read(1);
            this.config.spectralDataResilience = stream.read(1);
          }
          stream.advance(1);
        }
        if (this.config.chanConfig === CHANNEL_CONFIG_NONE) {
          stream.advance(4);
          throw new Error('PCE unimplemented');
        }
        break;
      default:
        throw new Error("AAC profile" + this.config.profile + "not supported.");
    }
    this.filter_bank = new FilterBank(false, this.config.chanConfig);
    this.ics = new ICStream(this.config);
    this.cpe = new CPEElement(this.config);
    return this.cce = new CCEElement(this.config);
  };

  SCE_ELEMENT = 0;

  CPE_ELEMENT = 1;

  CCE_ELEMENT = 2;

  LFE_ELEMENT = 3;

  DSE_ELEMENT = 4;

  PCE_ELEMENT = 5;

  FIL_ELEMENT = 6;

  END_ELEMENT = 7;

  AACDecoder.prototype.readChunk = function() {
    var align, cce, channels, config, count, cpe, data, elementType, elements, frameLength, i, ics, id, j, k, output, stream, _i, _j;
    stream = this.bitstream;
    if (stream.peek(12) === 0xfff) {
      ADTSDemuxer.readHeader(stream);
    }
    this.cces = [];
    elements = [];
    config = this.config;
    frameLength = config.frameLength;
    elementType = null;
    while ((elementType = stream.read(3)) !== END_ELEMENT) {
      id = stream.read(4);
      console.log(elementType);
      switch (elementType) {
        case SCE_ELEMENT:
        case LFE_ELEMENT:
          ics = this.ics;
          ics.id = id;
          elements.push(ics);
          ics.decode(stream, config, false);
          break;
        case CPE_ELEMENT:
          cpe = this.cpe;
          cpe.id = id;
          elements.push(cpe);
          cpe.decode(stream, config);
          break;
        case CCE_ELEMENT:
          cce = this.cce;
          this.cces.push(cce);
          cce.decode(stream, config);
          break;
        case DSE_ELEMENT:
          align = stream.read(1);
          count = stream.read(8);
          if (count === 255) {
            count += stream.read(8);
          }
          if (align) {
            stream.align();
          }
          stream.advance(count * 8);
          break;
        case PCE_ELEMENT:
          throw new Error("TODO: PCE_ELEMENT");
          break;
        case FIL_ELEMENT:
          if (id === 15) {
            id += stream.read(8) - 1;
          }
          stream.advance(id * 8);
          break;
        default:
          throw new Error('Unknown element');
      }
    }
    stream.align();
    this.process(elements);
    data = this.data;
    channels = data.length;
    output = new Float32Array(frameLength * channels);
    j = 0;
    for (k = _i = 0; 0 <= frameLength ? _i < frameLength : _i > frameLength; k = 0 <= frameLength ? ++_i : --_i) {
      for (i = _j = 0; 0 <= channels ? _j < channels : _j > channels; i = 0 <= channels ? ++_j : --_j) {
        output[j++] = data[i][k] / 32768;
      }
    }
    return output;
  };

  AACDecoder.prototype.process = function(elements) {
    var channel, channels, data, e, i, len, mult, _i, _j, _ref, _results;
    channels = this.config.chanConfig;
    mult = 1;
    len = mult * this.config.frameLength;
    data = this.data = [];
    for (i = _i = 0; 0 <= channels ? _i < channels : _i > channels; i = 0 <= channels ? ++_i : --_i) {
      data[i] = new Float32Array(len);
    }
    channel = 0;
    _results = [];
    for (i = _j = 0, _ref = elements.length; 0 <= _ref ? _j < _ref : _j > _ref; i = 0 <= _ref ? ++_j : --_j) {
      if (channel >= channels) {
        break;
      }
      e = elements[i];
      if (e instanceof ICStream) {
        _results.push(channel += this.processSingle(e, channel));
      } else if (e instanceof CPEElement) {
        this.processPair(e, channel);
        _results.push(channel += 2);
      } else if (e instanceof CCEElement) {
        _results.push(channel++);
      } else {
        throw new Error("Unknown element found.");
      }
    }
    return _results;
  };

  AACDecoder.prototype.processSingle = function(element, channel) {
    var data, info, profile;
    profile = this.config.profile;
    info = element.info;
    data = element.data;
    if (profile === AOT_AAC_MAIN) {
      throw new Error("Main prediction unimplemented");
    }
    if (profile === AOT_AAC_LTP) {
      throw new Error("LTP prediction unimplemented");
    }
    this.applyChannelCoupling(element, CCEElement.BEFORE_TNS, data, null);
    if (element.tnsPresent) {
      element.tns.process(element, data, false);
    }
    this.applyChannelCoupling(element, CCEElement.AFTER_TNS, data, null);
    this.filter_bank.process(info, data, this.data[channel], channel);
    if (profile === AOT_AAC_LTP) {
      throw new Error("LTP prediction unimplemented");
    }
    this.applyChannelCoupling(element, CCEElement.AFTER_IMDCT, this.data[channel], null);
    if (element.gainPresent) {
      throw new Error("Gain control not implemented");
    }
    if (this.sbrPresent) {
      throw new Error("SBR not implemented");
    }
    return 1;
  };

  AACDecoder.prototype.processPair = function(element, channel) {
    var l_data, l_info, left, profile, r_data, r_info, right;
    profile = this.config.profile;
    left = element.left;
    right = element.right;
    l_info = left.info;
    r_info = right.info;
    l_data = left.data;
    r_data = right.data;
    if (element.commonWindow && element.maskPresent) {
      this.processMS(element, l_data, r_data);
    }
    if (profile === AOT_AAC_MAIN) {
      throw new Error("Main prediction unimplemented");
    }
    this.processIS(element, l_data, r_data);
    if (profile === AOT_AAC_LTP) {
      throw new Error("LTP prediction unimplemented");
    }
    this.applyChannelCoupling(element, CCEElement.BEFORE_TNS, l_data, r_data);
    if (left.tnsPresent) {
      left.tns.process(left, l_data, false);
    }
    if (right.tnsPresent) {
      right.tns.process(right, r_data, false);
    }
    this.applyChannelCoupling(element, CCEElement.AFTER_TNS, l_data, r_data);
    this.filter_bank.process(l_info, l_data, this.data[channel], channel);
    this.filter_bank.process(r_info, r_data, this.data[channel + 1], channel + 1);
    if (profile === AOT_AAC_LTP) {
      throw new Error("LTP prediction unimplemented");
    }
    this.applyChannelCoupling(element, CCEElement.AFTER_IMDCT, this.data[channel], this.data[channel + 1]);
    if (left.gainPresent) {
      throw new Error("Gain control not implemented");
    }
    if (right.gainPresent) {
      throw new Error("Gain control not implemented");
    }
    if (this.sbrPresent) {
      throw new Error("SBR not implemented");
    }
  };

  AACDecoder.prototype.processIS = function(element, left, right) {
    var bandTypes, c, end, g, groupOff, i, ics, idx, info, j, len, maxSFB, offset, offsets, scale, scaleFactors, sectEnd, w, windowGroups, _i, _j, _k, _ref, _results;
    ics = element.right;
    info = ics.info;
    offsets = info.swbOffsets;
    windowGroups = info.groupCount;
    maxSFB = info.maxSFB;
    bandTypes = ics.bandTypes;
    sectEnd = ics.sectEnd;
    scaleFactors = ics.scaleFactors;
    idx = 0;
    groupOff = 0;
    _results = [];
    for (g = _i = 0; 0 <= windowGroups ? _i < windowGroups : _i > windowGroups; g = 0 <= windowGroups ? ++_i : --_i) {
      i = 0;
      while (i < maxSFB) {
        end = sectEnd[idx];
        if (bandTypes[idx] === ICStream.INTENSITY_BT || bandTypes[idx] === ICStream.INTENSITY_BT2) {
          while (i < end) {
            c = bandTypes[idx] === ICStream.INTENSITY_BT ? 1 : -1;
            if (element.maskPresent) {
              c *= element.ms_used[idx] ? -1 : 1;
            }
            scale = c * scaleFactors[idx];
            for (w = _j = 0, _ref = info.groupLength[g]; 0 <= _ref ? _j < _ref : _j > _ref; w = 0 <= _ref ? ++_j : --_j) {
              offset = groupOff + w * 128 + offsets[i];
              len = offsets[i + 1] - offsets[i];
              for (j = _k = j; j <= len ? _k < len : _k > len; j = j <= len ? ++_k : --_k) {
                right[offset + j] = left[offset + j] * scale;
              }
            }
            i++;
            idx++;
          }
        } else {
          idx += end - i;
          i = end;
        }
      }
      _results.push(groupOff += info.groupLength[g] * 128);
    }
    return _results;
  };

  AACDecoder.prototype.processMS = function(element, left, right) {
    var g, groupOff, i, ics, idx, info, j, maxSFB, offset, offsets, sfbCBl, sfbCBr, t, w, windowGroups, _i, _j, _k, _l, _ref, _ref1, _results;
    ics = element.left;
    info = ics.info;
    offsets = info.swbOffsets;
    windowGroups = info.groupCount;
    maxSFB = info.maxSFB;
    sfbCBl = ics.bandTypes;
    sfbCBr = element.right.bandTypes;
    groupOff = 0;
    idx = 0;
    _results = [];
    for (g = _i = 0; 0 <= windowGroups ? _i < windowGroups : _i > windowGroups; g = 0 <= windowGroups ? ++_i : --_i) {
      for (i = _j = 0; 0 <= maxSFB ? _j < maxSFB : _j > maxSFB; i = 0 <= maxSFB ? ++_j : --_j) {
        if (element.ms_used[idx] && sfbCBl[idx] < ICStream.NOISE_BT && sfbCBr[idx] < ICStream.NOISE_BT) {
          for (w = _k = 0, _ref = info.groupLength[g]; 0 <= _ref ? _k < _ref : _k > _ref; w = 0 <= _ref ? ++_k : --_k) {
            offset = groupOff + w * 128 + offsets[i];
            for (j = _l = 0, _ref1 = offsets[i + 1] - offsets[i]; 0 <= _ref1 ? _l < _ref1 : _l > _ref1; j = 0 <= _ref1 ? ++_l : --_l) {
              t = left[offset + j] - right[offset + j];
              left[offset + j] += right[offset + j];
              right[offset + j] = t;
            }
          }
        }
        idx++;
      }
      _results.push(groupOff += info.groupLength[g] * 128);
    }
    return _results;
  };

  AACDecoder.prototype.applyChannelCoupling = function(element, couplingPoint, data1, data2) {
    var applyCoupling, c, cce, cces, chSelect, i, index, isChannelPair, _i, _ref, _ref1, _results;
    cces = this.cces;
    isChannelPair = element instanceof CPEElement;
    applyCoupling = (_ref = couplingPoint === CCEElement.AFTER_IMDCT) != null ? _ref : {
      'applyIndependentCoupling': 'applyDependentCoupling'
    };
    _results = [];
    for (i = _i = 0, _ref1 = cces.length; 0 <= _ref1 ? _i < _ref1 : _i > _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
      cce = cces[i];
      index = 0;
      if (cce.couplingPoint === couplingPoint) {
        _results.push((function() {
          var _j, _ref2, _ref3, _results1;
          _results1 = [];
          for (c = _j = 0, _ref2 = cce.coupledCount; 0 <= _ref2 ? _j < _ref2 : _j > _ref2; c = 0 <= _ref2 ? ++_j : --_j) {
            chSelect = cce.chSelect[c];
            if (cce.channelPair[c] === isChannelPair && cce.idSelect[c] === element.id) {
              if (chSelect !== 1) {
                cce[applyCoupling](index, data1);
                if (chSelect) {
                  index++;
                }
              }
              if (chSelect !== 2) {
                _results1.push(cce[applyCoupling](index++, data2));
              } else {
                _results1.push(void 0);
              }
            } else {
              _results1.push(index += 1 + ((_ref3 = chSelect === 3) != null ? _ref3 : {
                1: 0
              }));
            }
          }
          return _results1;
        })());
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  return AACDecoder;

})(Decoder);

module.exports = AACDecoder;


},{"../../core/bitstream":6,"../../core/stream":10,"../../decoder":12,"../../demuxers/adts":27,"./cce":13,"./cpe":14,"./filter_bank":16,"./ics":18,"./tables":22}],20:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

var tables = _dereq_('./mdct_tables');
var FFT = _dereq_('./fft');

// Modified Discrete Cosine Transform
function MDCT(length) {
    this.N = length;
    this.N2 = length >>> 1;
    this.N4 = length >>> 2;
    this.N8 = length >>> 3;
    
    switch (length) {
        case 2048:
            this.sincos = tables.MDCT_TABLE_2048;
            break;
            
        case 256:
            this.sincos = tables.MDCT_TABLE_256;
            break;
            
        case 1920:
            this.sincos = tables.MDCT_TABLE_1920;
            break;
            
        case 240:
            this.sincos = tables.MDCT_TABLE_240;
            break;
            
        default:
            throw new Error("unsupported MDCT length: " + length);
    }
    
    this.fft = new FFT(this.N4);
    
    this.buf = new Array(this.N4);
    for (var i = 0; i < this.N4; i++) {
        this.buf[i] = new Float32Array(2);
    }
    
    this.tmp = new Float32Array(2);
}

MDCT.prototype.process = function(input, inOffset, output, outOffset) {
    // local access
    var N2 = this.N2,
        N4 = this.N4,
        N8 = this.N8,
        buf = this.buf,
        tmp = this.tmp,
        sincos = this.sincos,
        fft = this.fft;
    
    // pre-IFFT complex multiplication
    for (var k = 0; k < N4; k++) {
        buf[k][1] = (input[inOffset + 2 * k] * sincos[k][0]) + (input[inOffset + N2 - 1 - 2 * k] * sincos[k][1]);
        buf[k][0] = (input[inOffset + N2 - 1 - 2 * k] * sincos[k][0]) - (input[inOffset + 2 * k] * sincos[k][1]);
    }
    
    // complex IFFT, non-scaling
    fft.process(buf, false);
    
    // post-IFFT complex multiplication
    for (var k = 0; k < N4; k++) {
        tmp[0] = buf[k][0];
        tmp[1] = buf[k][1];
        buf[k][1] = (tmp[1] * sincos[k][0]) + (tmp[0] * sincos[k][1]);
        buf[k][0] = (tmp[0] * sincos[k][0]) - (tmp[1] * sincos[k][1]);
    }
    
    // reordering
    for (var k = 0; k < N8; k += 2) {
        output[outOffset + 2 * k] = buf[N8 + k][1];
        output[outOffset + 2 + 2 * k] = buf[N8 + 1 + k][1];

        output[outOffset + 1 + 2 * k] = -buf[N8 - 1 - k][0];
        output[outOffset + 3 + 2 * k] = -buf[N8 - 2 - k][0];

        output[outOffset + N4 + 2 * k] = buf[k][0];
        output[outOffset + N4 + 2 + 2 * k] = buf[1 + k][0];

        output[outOffset + N4 + 1 + 2 * k] = -buf[N4 - 1 - k][1];
        output[outOffset + N4 + 3 + 2 * k] = -buf[N4 - 2 - k][1];

        output[outOffset + N2 + 2 * k] = buf[N8 + k][0];
        output[outOffset + N2 + 2 + 2 * k] = buf[N8 + 1 + k][0];

        output[outOffset + N2 + 1 + 2 * k] = -buf[N8 - 1 - k][1];
        output[outOffset + N2 + 3 + 2 * k] = -buf[N8 - 2 - k][1];

        output[outOffset + N2 + N4 + 2 * k] = -buf[k][1];
        output[outOffset + N2 + N4 + 2 + 2 * k] = -buf[1 + k][1];

        output[outOffset + N2 + N4 + 1 + 2 * k] = buf[N4 - 1 - k][0];
        output[outOffset + N2 + N4 + 3 + 2 * k] = buf[N4 - 2 - k][0];
    }
};

module.exports = MDCT;

},{"./fft":15,"./mdct_tables":21}],21:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

exports.MDCT_TABLE_2048 = [
    [0.031249997702054, 0.000011984224612],
    [0.031249813866531, 0.000107857810004],
    [0.031249335895858, 0.000203730380198],
    [0.031248563794535, 0.000299601032804],
    [0.031247497569829, 0.000395468865451],
    [0.031246137231775, 0.000491332975794],
    [0.031244482793177, 0.000587192461525],
    [0.031242534269608, 0.000683046420376],
    [0.031240291679407, 0.000778893950134],
    [0.031237755043684, 0.000874734148645],
    [0.031234924386313, 0.000970566113826],
    [0.031231799733938, 0.001066388943669],
    [0.031228381115970, 0.001162201736253],
    [0.031224668564585, 0.001258003589751],
    [0.031220662114728, 0.001353793602441],
    [0.031216361804108, 0.001449570872710],
    [0.031211767673203, 0.001545334499065],
    [0.031206879765253, 0.001641083580144],
    [0.031201698126266, 0.001736817214719],
    [0.031196222805014, 0.001832534501709],
    [0.031190453853031, 0.001928234540186],
    [0.031184391324617, 0.002023916429386],
    [0.031178035276836, 0.002119579268713],
    [0.031171385769513, 0.002215222157753],
    [0.031164442865236, 0.002310844196278],
    [0.031157206629353, 0.002406444484258],
    [0.031149677129975, 0.002502022121865],
    [0.031141854437973, 0.002597576209488],
    [0.031133738626977, 0.002693105847734],
    [0.031125329773375, 0.002788610137442],
    [0.031116627956316, 0.002884088179689],
    [0.031107633257703, 0.002979539075801],
    [0.031098345762200, 0.003074961927355],
    [0.031088765557222, 0.003170355836197],
    [0.031078892732942, 0.003265719904442],
    [0.031068727382288, 0.003361053234488],
    [0.031058269600939, 0.003456354929021],
    [0.031047519487329, 0.003551624091024],
    [0.031036477142640, 0.003646859823790],
    [0.031025142670809, 0.003742061230921],
    [0.031013516178519, 0.003837227416347],
    [0.031001597775203, 0.003932357484328],
    [0.030989387573042, 0.004027450539462],
    [0.030976885686963, 0.004122505686697],
    [0.030964092234638, 0.004217522031340],
    [0.030951007336485, 0.004312498679058],
    [0.030937631115663, 0.004407434735897],
    [0.030923963698074, 0.004502329308281],
    [0.030910005212362, 0.004597181503027],
    [0.030895755789908, 0.004691990427350],
    [0.030881215564835, 0.004786755188872],
    [0.030866384674000, 0.004881474895632],
    [0.030851263256996, 0.004976148656090],
    [0.030835851456154, 0.005070775579142],
    [0.030820149416533, 0.005165354774124],
    [0.030804157285929, 0.005259885350819],
    [0.030787875214864, 0.005354366419469],
    [0.030771303356593, 0.005448797090784],
    [0.030754441867095, 0.005543176475946],
    [0.030737290905077, 0.005637503686619],
    [0.030719850631972, 0.005731777834961],
    [0.030702121211932, 0.005825998033626],
    [0.030684102811835, 0.005920163395780],
    [0.030665795601276, 0.006014273035101],
    [0.030647199752570, 0.006108326065793],
    [0.030628315440748, 0.006202321602594],
    [0.030609142843557, 0.006296258760782],
    [0.030589682141455, 0.006390136656185],
    [0.030569933517616, 0.006483954405188],
    [0.030549897157919, 0.006577711124743],
    [0.030529573250956, 0.006671405932375],
    [0.030508961988022, 0.006765037946194],
    [0.030488063563118, 0.006858606284900],
    [0.030466878172949, 0.006952110067791],
    [0.030445406016919, 0.007045548414774],
    [0.030423647297133, 0.007138920446372],
    [0.030401602218392, 0.007232225283733],
    [0.030379270988192, 0.007325462048634],
    [0.030356653816724, 0.007418629863497],
    [0.030333750916869, 0.007511727851390],
    [0.030310562504198, 0.007604755136040],
    [0.030287088796968, 0.007697710841838],
    [0.030263330016124, 0.007790594093851],
    [0.030239286385293, 0.007883404017824],
    [0.030214958130781, 0.007976139740197],
    [0.030190345481576, 0.008068800388104],
    [0.030165448669342, 0.008161385089390],
    [0.030140267928416, 0.008253892972610],
    [0.030114803495809, 0.008346323167047],
    [0.030089055611203, 0.008438674802711],
    [0.030063024516947, 0.008530947010354],
    [0.030036710458054, 0.008623138921475],
    [0.030010113682202, 0.008715249668328],
    [0.029983234439732, 0.008807278383932],
    [0.029956072983640, 0.008899224202078],
    [0.029928629569580, 0.008991086257336],
    [0.029900904455860, 0.009082863685067],
    [0.029872897903441, 0.009174555621425],
    [0.029844610175929, 0.009266161203371],
    [0.029816041539579, 0.009357679568679],
    [0.029787192263292, 0.009449109855944],
    [0.029758062618606, 0.009540451204587],
    [0.029728652879702, 0.009631702754871],
    [0.029698963323395, 0.009722863647900],
    [0.029668994229134, 0.009813933025633],
    [0.029638745879000, 0.009904910030891],
    [0.029608218557702, 0.009995793807363],
    [0.029577412552575, 0.010086583499618],
    [0.029546328153577, 0.010177278253107],
    [0.029514965653285, 0.010267877214177],
    [0.029483325346896, 0.010358379530076],
    [0.029451407532220, 0.010448784348962],
    [0.029419212509679, 0.010539090819911],
    [0.029386740582307, 0.010629298092923],
    [0.029353992055740, 0.010719405318933],
    [0.029320967238220, 0.010809411649818],
    [0.029287666440590, 0.010899316238403],
    [0.029254089976290, 0.010989118238474],
    [0.029220238161353, 0.011078816804778],
    [0.029186111314406, 0.011168411093039],
    [0.029151709756664, 0.011257900259961],
    [0.029117033811927, 0.011347283463239],
    [0.029082083806579, 0.011436559861563],
    [0.029046860069582, 0.011525728614630],
    [0.029011362932476, 0.011614788883150],
    [0.028975592729373, 0.011703739828853],
    [0.028939549796957, 0.011792580614500],
    [0.028903234474475, 0.011881310403886],
    [0.028866647103744, 0.011969928361855],
    [0.028829788029135, 0.012058433654299],
    [0.028792657597583, 0.012146825448172],
    [0.028755256158571, 0.012235102911499],
    [0.028717584064137, 0.012323265213377],
    [0.028679641668864, 0.012411311523990],
    [0.028641429329882, 0.012499241014612],
    [0.028602947406859, 0.012587052857618],
    [0.028564196262001, 0.012674746226488],
    [0.028525176260050, 0.012762320295819],
    [0.028485887768276, 0.012849774241331],
    [0.028446331156478, 0.012937107239875],
    [0.028406506796976, 0.013024318469437],
    [0.028366415064615, 0.013111407109155],
    [0.028326056336751, 0.013198372339315],
    [0.028285430993258, 0.013285213341368],
    [0.028244539416515, 0.013371929297933],
    [0.028203381991411, 0.013458519392807],
    [0.028161959105334, 0.013544982810971],
    [0.028120271148172, 0.013631318738598],
    [0.028078318512309, 0.013717526363062],
    [0.028036101592619, 0.013803604872943],
    [0.027993620786463, 0.013889553458039],
    [0.027950876493687, 0.013975371309367],
    [0.027907869116616, 0.014061057619178],
    [0.027864599060052, 0.014146611580959],
    [0.027821066731270, 0.014232032389445],
    [0.027777272540012, 0.014317319240622],
    [0.027733216898487, 0.014402471331737],
    [0.027688900221361, 0.014487487861307],
    [0.027644322925762, 0.014572368029123],
    [0.027599485431266, 0.014657111036262],
    [0.027554388159903, 0.014741716085090],
    [0.027509031536144, 0.014826182379271],
    [0.027463415986904, 0.014910509123778],
    [0.027417541941533, 0.014994695524894],
    [0.027371409831816, 0.015078740790225],
    [0.027325020091965, 0.015162644128704],
    [0.027278373158618, 0.015246404750603],
    [0.027231469470833, 0.015330021867534],
    [0.027184309470088, 0.015413494692460],
    [0.027136893600268, 0.015496822439704],
    [0.027089222307671, 0.015580004324954],
    [0.027041296040997, 0.015663039565269],
    [0.026993115251345, 0.015745927379091],
    [0.026944680392213, 0.015828666986247],
    [0.026895991919487, 0.015911257607961],
    [0.026847050291442, 0.015993698466859],
    [0.026797855968734, 0.016075988786976],
    [0.026748409414401, 0.016158127793763],
    [0.026698711093851, 0.016240114714099],
    [0.026648761474864, 0.016321948776289],
    [0.026598561027585, 0.016403629210082],
    [0.026548110224519, 0.016485155246669],
    [0.026497409540530, 0.016566526118696],
    [0.026446459452830, 0.016647741060271],
    [0.026395260440982, 0.016728799306966],
    [0.026343812986890, 0.016809700095831],
    [0.026292117574797, 0.016890442665397],
    [0.026240174691280, 0.016971026255683],
    [0.026187984825246, 0.017051450108208],
    [0.026135548467924, 0.017131713465990],
    [0.026082866112867, 0.017211815573560],
    [0.026029938255941, 0.017291755676967],
    [0.025976765395322, 0.017371533023784],
    [0.025923348031494, 0.017451146863116],
    [0.025869686667242, 0.017530596445607],
    [0.025815781807646, 0.017609881023449],
    [0.025761633960080, 0.017688999850383],
    [0.025707243634204, 0.017767952181715],
    [0.025652611341960, 0.017846737274313],
    [0.025597737597568, 0.017925354386623],
    [0.025542622917522, 0.018003802778671],
    [0.025487267820581, 0.018082081712071],
    [0.025431672827768, 0.018160190450031],
    [0.025375838462365, 0.018238128257362],
    [0.025319765249906, 0.018315894400484],
    [0.025263453718173, 0.018393488147432],
    [0.025206904397193, 0.018470908767865],
    [0.025150117819228, 0.018548155533070],
    [0.025093094518776, 0.018625227715971],
    [0.025035835032562, 0.018702124591135],
    [0.024978339899534, 0.018778845434780],
    [0.024920609660858, 0.018855389524780],
    [0.024862644859912, 0.018931756140672],
    [0.024804446042284, 0.019007944563666],
    [0.024746013755764, 0.019083954076646],
    [0.024687348550337, 0.019159783964183],
    [0.024628450978184, 0.019235433512536],
    [0.024569321593670, 0.019310902009663],
    [0.024509960953345, 0.019386188745225],
    [0.024450369615932, 0.019461293010596],
    [0.024390548142329, 0.019536214098866],
    [0.024330497095598, 0.019610951304848],
    [0.024270217040961, 0.019685503925087],
    [0.024209708545799, 0.019759871257867],
    [0.024148972179639, 0.019834052603212],
    [0.024088008514157, 0.019908047262901],
    [0.024026818123164, 0.019981854540467],
    [0.023965401582609, 0.020055473741208],
    [0.023903759470567, 0.020128904172192],
    [0.023841892367236, 0.020202145142264],
    [0.023779800854935, 0.020275195962052],
    [0.023717485518092, 0.020348055943974],
    [0.023654946943242, 0.020420724402244],
    [0.023592185719023, 0.020493200652878],
    [0.023529202436167, 0.020565484013703],
    [0.023465997687496, 0.020637573804361],
    [0.023402572067918, 0.020709469346314],
    [0.023338926174419, 0.020781169962854],
    [0.023275060606058, 0.020852674979108],
    [0.023210975963963, 0.020923983722044],
    [0.023146672851322, 0.020995095520475],
    [0.023082151873380, 0.021066009705072],
    [0.023017413637435, 0.021136725608363],
    [0.022952458752826, 0.021207242564742],
    [0.022887287830934, 0.021277559910478],
    [0.022821901485173, 0.021347676983716],
    [0.022756300330983, 0.021417593124488],
    [0.022690484985827, 0.021487307674717],
    [0.022624456069185, 0.021556819978223],
    [0.022558214202547, 0.021626129380729],
    [0.022491760009405, 0.021695235229869],
    [0.022425094115252, 0.021764136875192],
    [0.022358217147572, 0.021832833668171],
    [0.022291129735838, 0.021901324962204],
    [0.022223832511501, 0.021969610112625],
    [0.022156326107988, 0.022037688476709],
    [0.022088611160696, 0.022105559413676],
    [0.022020688306983, 0.022173222284699],
    [0.021952558186166, 0.022240676452909],
    [0.021884221439510, 0.022307921283403],
    [0.021815678710228, 0.022374956143245],
    [0.021746930643469, 0.022441780401478],
    [0.021677977886316, 0.022508393429127],
    [0.021608821087780, 0.022574794599206],
    [0.021539460898790, 0.022640983286719],
    [0.021469897972190, 0.022706958868676],
    [0.021400132962735, 0.022772720724087],
    [0.021330166527077, 0.022838268233979],
    [0.021259999323769, 0.022903600781391],
    [0.021189632013250, 0.022968717751391],
    [0.021119065257845, 0.023033618531071],
    [0.021048299721754, 0.023098302509561],
    [0.020977336071050, 0.023162769078031],
    [0.020906174973670, 0.023227017629698],
    [0.020834817099409, 0.023291047559828],
    [0.020763263119915, 0.023354858265748],
    [0.020691513708680, 0.023418449146848],
    [0.020619569541038, 0.023481819604585],
    [0.020547431294155, 0.023544969042494],
    [0.020475099647023, 0.023607896866186],
    [0.020402575280455, 0.023670602483363],
    [0.020329858877078, 0.023733085303813],
    [0.020256951121327, 0.023795344739427],
    [0.020183852699437, 0.023857380204193],
    [0.020110564299439, 0.023919191114211],
    [0.020037086611150, 0.023980776887692],
    [0.019963420326171, 0.024042136944968],
    [0.019889566137877, 0.024103270708495],
    [0.019815524741412, 0.024164177602859],
    [0.019741296833681, 0.024224857054779],
    [0.019666883113346, 0.024285308493120],
    [0.019592284280817, 0.024345531348888],
    [0.019517501038246, 0.024405525055242],
    [0.019442534089523, 0.024465289047500],
    [0.019367384140264, 0.024524822763141],
    [0.019292051897809, 0.024584125641809],
    [0.019216538071215, 0.024643197125323],
    [0.019140843371246, 0.024702036657681],
    [0.019064968510369, 0.024760643685063],
    [0.018988914202748, 0.024819017655836],
    [0.018912681164234, 0.024877158020562],
    [0.018836270112363, 0.024935064232003],
    [0.018759681766343, 0.024992735745123],
    [0.018682916847054, 0.025050172017095],
    [0.018605976077037, 0.025107372507308],
    [0.018528860180486, 0.025164336677369],
    [0.018451569883247, 0.025221063991110],
    [0.018374105912805, 0.025277553914591],
    [0.018296468998280, 0.025333805916107],
    [0.018218659870421, 0.025389819466194],
    [0.018140679261596, 0.025445594037630],
    [0.018062527905790, 0.025501129105445],
    [0.017984206538592, 0.025556424146920],
    [0.017905715897192, 0.025611478641598],
    [0.017827056720375, 0.025666292071285],
    [0.017748229748511, 0.025720863920056],
    [0.017669235723550, 0.025775193674260],
    [0.017590075389012, 0.025829280822525],
    [0.017510749489986, 0.025883124855762],
    [0.017431258773116, 0.025936725267170],
    [0.017351603986600, 0.025990081552242],
    [0.017271785880180, 0.026043193208768],
    [0.017191805205132, 0.026096059736841],
    [0.017111662714267, 0.026148680638861],
    [0.017031359161915, 0.026201055419541],
    [0.016950895303924, 0.026253183585908],
    [0.016870271897651, 0.026305064647313],
    [0.016789489701954, 0.026356698115431],
    [0.016708549477186, 0.026408083504269],
    [0.016627451985187, 0.026459220330167],
    [0.016546197989277, 0.026510108111806],
    [0.016464788254250, 0.026560746370212],
    [0.016383223546365, 0.026611134628757],
    [0.016301504633341, 0.026661272413168],
    [0.016219632284346, 0.026711159251530],
    [0.016137607269996, 0.026760794674288],
    [0.016055430362340, 0.026810178214254],
    [0.015973102334858, 0.026859309406613],
    [0.015890623962454, 0.026908187788922],
    [0.015807996021446, 0.026956812901119],
    [0.015725219289558, 0.027005184285527],
    [0.015642294545918, 0.027053301486856],
    [0.015559222571044, 0.027101164052208],
    [0.015476004146842, 0.027148771531083],
    [0.015392640056594, 0.027196123475380],
    [0.015309131084956, 0.027243219439406],
    [0.015225478017946, 0.027290058979875],
    [0.015141681642938, 0.027336641655915],
    [0.015057742748656, 0.027382967029073],
    [0.014973662125164, 0.027429034663317],
    [0.014889440563862, 0.027474844125040],
    [0.014805078857474, 0.027520394983066],
    [0.014720577800046, 0.027565686808654],
    [0.014635938186934, 0.027610719175499],
    [0.014551160814797, 0.027655491659740],
    [0.014466246481592, 0.027700003839960],
    [0.014381195986567, 0.027744255297195],
    [0.014296010130247, 0.027788245614933],
    [0.014210689714436, 0.027831974379120],
    [0.014125235542201, 0.027875441178165],
    [0.014039648417870, 0.027918645602941],
    [0.013953929147020, 0.027961587246792],
    [0.013868078536476, 0.028004265705534],
    [0.013782097394294, 0.028046680577462],
    [0.013695986529763, 0.028088831463351],
    [0.013609746753390, 0.028130717966461],
    [0.013523378876898, 0.028172339692540],
    [0.013436883713214, 0.028213696249828],
    [0.013350262076462, 0.028254787249062],
    [0.013263514781960, 0.028295612303478],
    [0.013176642646205, 0.028336171028814],
    [0.013089646486871, 0.028376463043317],
    [0.013002527122799, 0.028416487967743],
    [0.012915285373990, 0.028456245425361],
    [0.012827922061597, 0.028495735041960],
    [0.012740438007915, 0.028534956445849],
    [0.012652834036379, 0.028573909267859],
    [0.012565110971550, 0.028612593141354],
    [0.012477269639111, 0.028651007702224],
    [0.012389310865858, 0.028689152588899],
    [0.012301235479693, 0.028727027442343],
    [0.012213044309615, 0.028764631906065],
    [0.012124738185712, 0.028801965626115],
    [0.012036317939156, 0.028839028251097],
    [0.011947784402191, 0.028875819432161],
    [0.011859138408130, 0.028912338823015],
    [0.011770380791341, 0.028948586079925],
    [0.011681512387245, 0.028984560861718],
    [0.011592534032306, 0.029020262829785],
    [0.011503446564022, 0.029055691648087],
    [0.011414250820918, 0.029090846983152],
    [0.011324947642537, 0.029125728504087],
    [0.011235537869437, 0.029160335882573],
    [0.011146022343175, 0.029194668792871],
    [0.011056401906305, 0.029228726911828],
    [0.010966677402371, 0.029262509918876],
    [0.010876849675891, 0.029296017496036],
    [0.010786919572361, 0.029329249327922],
    [0.010696887938235, 0.029362205101743],
    [0.010606755620926, 0.029394884507308],
    [0.010516523468793, 0.029427287237024],
    [0.010426192331137, 0.029459412985906],
    [0.010335763058187, 0.029491261451573],
    [0.010245236501099, 0.029522832334255],
    [0.010154613511943, 0.029554125336796],
    [0.010063894943698, 0.029585140164654],
    [0.009973081650240, 0.029615876525905],
    [0.009882174486340, 0.029646334131247],
    [0.009791174307650, 0.029676512694001],
    [0.009700081970699, 0.029706411930116],
    [0.009608898332881, 0.029736031558168],
    [0.009517624252453, 0.029765371299366],
    [0.009426260588521, 0.029794430877553],
    [0.009334808201034, 0.029823210019210],
    [0.009243267950778, 0.029851708453456],
    [0.009151640699363, 0.029879925912053],
    [0.009059927309220, 0.029907862129408],
    [0.008968128643591, 0.029935516842573],
    [0.008876245566520, 0.029962889791254],
    [0.008784278942845, 0.029989980717805],
    [0.008692229638191, 0.030016789367235],
    [0.008600098518961, 0.030043315487212],
    [0.008507886452329, 0.030069558828062],
    [0.008415594306230, 0.030095519142772],
    [0.008323222949351, 0.030121196186994],
    [0.008230773251129, 0.030146589719046],
    [0.008138246081733, 0.030171699499915],
    [0.008045642312067, 0.030196525293257],
    [0.007952962813750, 0.030221066865402],
    [0.007860208459119, 0.030245323985357],
    [0.007767380121212, 0.030269296424803],
    [0.007674478673766, 0.030292983958103],
    [0.007581504991203, 0.030316386362302],
    [0.007488459948628, 0.030339503417126],
    [0.007395344421816, 0.030362334904989],
    [0.007302159287206, 0.030384880610993],
    [0.007208905421891, 0.030407140322928],
    [0.007115583703613, 0.030429113831278],
    [0.007022195010752, 0.030450800929220],
    [0.006928740222316, 0.030472201412626],
    [0.006835220217939, 0.030493315080068],
    [0.006741635877866, 0.030514141732814],
    [0.006647988082948, 0.030534681174838],
    [0.006554277714635, 0.030554933212813],
    [0.006460505654964, 0.030574897656119],
    [0.006366672786553, 0.030594574316845],
    [0.006272779992593, 0.030613963009786],
    [0.006178828156839, 0.030633063552447],
    [0.006084818163601, 0.030651875765048],
    [0.005990750897737, 0.030670399470520],
    [0.005896627244644, 0.030688634494512],
    [0.005802448090250, 0.030706580665388],
    [0.005708214321004, 0.030724237814232],
    [0.005613926823871, 0.030741605774849],
    [0.005519586486321, 0.030758684383764],
    [0.005425194196321, 0.030775473480228],
    [0.005330750842327, 0.030791972906214],
    [0.005236257313276, 0.030808182506425],
    [0.005141714498576, 0.030824102128288],
    [0.005047123288102, 0.030839731621963],
    [0.004952484572181, 0.030855070840339],
    [0.004857799241589, 0.030870119639036],
    [0.004763068187541, 0.030884877876411],
    [0.004668292301681, 0.030899345413553],
    [0.004573472476075, 0.030913522114288],
    [0.004478609603205, 0.030927407845180],
    [0.004383704575956, 0.030941002475530],
    [0.004288758287610, 0.030954305877381],
    [0.004193771631837, 0.030967317925516],
    [0.004098745502689, 0.030980038497461],
    [0.004003680794587, 0.030992467473486],
    [0.003908578402316, 0.031004604736602],
    [0.003813439221017, 0.031016450172571],
    [0.003718264146176, 0.031028003669899],
    [0.003623054073616, 0.031039265119839],
    [0.003527809899492, 0.031050234416394],
    [0.003432532520278, 0.031060911456318],
    [0.003337222832760, 0.031071296139114],
    [0.003241881734029, 0.031081388367037],
    [0.003146510121474, 0.031091188045095],
    [0.003051108892766, 0.031100695081051],
    [0.002955678945860, 0.031109909385419],
    [0.002860221178978, 0.031118830871473],
    [0.002764736490604, 0.031127459455239],
    [0.002669225779478, 0.031135795055501],
    [0.002573689944583, 0.031143837593803],
    [0.002478129885137, 0.031151586994444],
    [0.002382546500589, 0.031159043184484],
    [0.002286940690606, 0.031166206093743],
    [0.002191313355067, 0.031173075654800],
    [0.002095665394051, 0.031179651802998],
    [0.001999997707835, 0.031185934476438],
    [0.001904311196878, 0.031191923615985],
    [0.001808606761820, 0.031197619165268],
    [0.001712885303465, 0.031203021070678],
    [0.001617147722782, 0.031208129281370],
    [0.001521394920889, 0.031212943749264],
    [0.001425627799047, 0.031217464429043],
    [0.001329847258653, 0.031221691278159],
    [0.001234054201231, 0.031225624256825],
    [0.001138249528420, 0.031229263328024],
    [0.001042434141971, 0.031232608457502],
    [0.000946608943736, 0.031235659613775],
    [0.000850774835656, 0.031238416768124],
    [0.000754932719759, 0.031240879894597],
    [0.000659083498149, 0.031243048970010],
    [0.000563228072993, 0.031244923973948],
    [0.000467367346520, 0.031246504888762],
    [0.000371502221008, 0.031247791699571],
    [0.000275633598775, 0.031248784394264],
    [0.000179762382174, 0.031249482963498],
    [0.000083889473581, 0.031249887400697]
];

exports.MDCT_TABLE_256 = [
    [0.088387931675923, 0.000271171628935],
    [0.088354655998507, 0.002440238387037],
    [0.088268158780110, 0.004607835236780],
    [0.088128492123423, 0.006772656498875],
    [0.087935740158418, 0.008933398165942],
    [0.087690018991670, 0.011088758687994],
    [0.087391476636423, 0.013237439756448],
    [0.087040292923427, 0.015378147086172],
    [0.086636679392621, 0.017509591195118],
    [0.086180879165703, 0.019630488181053],
    [0.085673166799686, 0.021739560494940],
    [0.085113848121515, 0.023835537710479],
    [0.084503260043847, 0.025917157289369],
    [0.083841770362110, 0.027983165341813],
    [0.083129777532952, 0.030032317381813],
    [0.082367710434230, 0.032063379076803],
    [0.081556028106671, 0.034075126991164],
    [0.080695219477356, 0.036066349323177],
    [0.079785803065216, 0.038035846634965],
    [0.078828326668693, 0.039982432574992],
    [0.077823367035766, 0.041904934592675],
    [0.076771529516540, 0.043802194644686],
    [0.075673447698606, 0.045673069892513],
    [0.074529783025390, 0.047516433390863],
    [0.073341224397728, 0.049331174766491],
    [0.072108487758894, 0.051116200887052],
    [0.070832315663343, 0.052870436519557],
    [0.069513476829429, 0.054592824978055],
    [0.068152765676348, 0.056282328760143],
    [0.066751001845620, 0.057937930171918],
    [0.065309029707361, 0.059558631940996],
    [0.063827717851668, 0.061143457817234],
    [0.062307958565413, 0.062691453160784],
    [0.060750667294763, 0.064201685517134],
    [0.059156782093749, 0.065673245178784],
    [0.057527263059216, 0.067105245733220],
    [0.055863091752499, 0.068496824596852],
    [0.054165270608165, 0.069847143534609],
    [0.052434822330188, 0.071155389164853],
    [0.050672789275903, 0.072420773449336],
    [0.048880232828135, 0.073642534167879],
    [0.047058232755862, 0.074819935377512],
    [0.045207886563797, 0.075952267855771],
    [0.043330308831298, 0.077038849527912],
    [0.041426630540984, 0.078079025877766],
    [0.039497998397473, 0.079072170341994],
    [0.037545574136653, 0.080017684687506],
    [0.035570533825892, 0.080914999371817],
    [0.033574067155622, 0.081763573886112],
    [0.031557376722714, 0.082562897080836],
    [0.029521677306074, 0.083312487473584],
    [0.027468195134911, 0.084011893539132],
    [0.025398167150101, 0.084660693981419],
    [0.023312840259098, 0.085258497987320],
    [0.021213470584847, 0.085804945462053],
    [0.019101322709138, 0.086299707246093],
    [0.016977668910873, 0.086742485313442],
    [0.014843788399692, 0.087133012951149],
    [0.012700966545425, 0.087471054919968],
    [0.010550494103830, 0.087756407596056],
    [0.008393666439096, 0.087988899093631],
    [0.006231782743558, 0.088168389368510],
    [0.004066145255116, 0.088294770302461],
    [0.001898058472816, 0.088367965768336]
];                                      

exports.MDCT_TABLE_1920 = [             
    [0.032274858518097, 0.000013202404176],
    [0.032274642494505, 0.000118821372483],
    [0.032274080835421, 0.000224439068308],
    [0.032273173546860, 0.000330054360572],
    [0.032271920638538, 0.000435666118218],
    [0.032270322123873, 0.000541273210231],
    [0.032268378019984, 0.000646874505642],
    [0.032266088347691, 0.000752468873546],
    [0.032263453131514, 0.000858055183114],
    [0.032260472399674, 0.000963632303600],
    [0.032257146184092, 0.001069199104358],
    [0.032253474520390, 0.001174754454853],
    [0.032249457447888, 0.001280297224671],
    [0.032245095009606, 0.001385826283535],
    [0.032240387252262, 0.001491340501313],
    [0.032235334226272, 0.001596838748031],
    [0.032229935985750, 0.001702319893890],
    [0.032224192588507, 0.001807782809271],
    [0.032218104096050, 0.001913226364749],
    [0.032211670573582, 0.002018649431111],
    [0.032204892090000, 0.002124050879359],
    [0.032197768717898, 0.002229429580728],
    [0.032190300533560, 0.002334784406698],
    [0.032182487616965, 0.002440114229003],
    [0.032174330051782, 0.002545417919644],
    [0.032165827925374, 0.002650694350905],
    [0.032156981328790, 0.002755942395358],
    [0.032147790356771, 0.002861160925883],
    [0.032138255107744, 0.002966348815672],
    [0.032128375683825, 0.003071504938250],
    [0.032118152190814, 0.003176628167476],
    [0.032107584738196, 0.003281717377568],
    [0.032096673439141, 0.003386771443102],
    [0.032085418410500, 0.003491789239036],
    [0.032073819772804, 0.003596769640711],
    [0.032061877650267, 0.003701711523874],
    [0.032049592170778, 0.003806613764680],
    [0.032036963465906, 0.003911475239711],
    [0.032023991670893, 0.004016294825985],
    [0.032010676924657, 0.004121071400967],
    [0.031997019369789, 0.004225803842586],
    [0.031983019152549, 0.004330491029241],
    [0.031968676422869, 0.004435131839816],
    [0.031953991334348, 0.004539725153692],
    [0.031938964044252, 0.004644269850758],
    [0.031923594713510, 0.004748764811426],
    [0.031907883506716, 0.004853208916638],
    [0.031891830592124, 0.004957601047881],
    [0.031875436141648, 0.005061940087200],
    [0.031858700330859, 0.005166224917208],
    [0.031841623338985, 0.005270454421097],
    [0.031824205348907, 0.005374627482653],
    [0.031806446547156, 0.005478742986267],
    [0.031788347123916, 0.005582799816945],
    [0.031769907273017, 0.005686796860323],
    [0.031751127191935, 0.005790733002674],
    [0.031732007081789, 0.005894607130928],
    [0.031712547147340, 0.005998418132675],
    [0.031692747596989, 0.006102164896182],
    [0.031672608642773, 0.006205846310406],
    [0.031652130500364, 0.006309461265002],
    [0.031631313389067, 0.006413008650337],
    [0.031610157531816, 0.006516487357501],
    [0.031588663155172, 0.006619896278321],
    [0.031566830489325, 0.006723234305370],
    [0.031544659768083, 0.006826500331981],
    [0.031522151228878, 0.006929693252258],
    [0.031499305112758, 0.007032811961088],
    [0.031476121664387, 0.007135855354151],
    [0.031452601132040, 0.007238822327937],
    [0.031428743767604, 0.007341711779751],
    [0.031404549826572, 0.007444522607730],
    [0.031380019568042, 0.007547253710853],
    [0.031355153254712, 0.007649903988952],
    [0.031329951152882, 0.007752472342725],
    [0.031304413532445, 0.007854957673748],
    [0.031278540666888, 0.007957358884484],
    [0.031252332833290, 0.008059674878300],
    [0.031225790312316, 0.008161904559473],
    [0.031198913388214, 0.008264046833205],
    [0.031171702348814, 0.008366100605636],
    [0.031144157485525, 0.008468064783849],
    [0.031116279093331, 0.008569938275893],
    [0.031088067470786, 0.008671719990782],
    [0.031059522920014, 0.008773408838517],
    [0.031030645746705, 0.008875003730092],
    [0.031001436260110, 0.008976503577507],
    [0.030971894773039, 0.009077907293780],
    [0.030942021601857, 0.009179213792959],
    [0.030911817066483, 0.009280421990133],
    [0.030881281490382, 0.009381530801444],
    [0.030850415200566, 0.009482539144097],
    [0.030819218527589, 0.009583445936373],
    [0.030787691805541, 0.009684250097643],
    [0.030755835372048, 0.009784950548375],
    [0.030723649568268, 0.009885546210147],
    [0.030691134738883, 0.009986036005661],
    [0.030658291232103, 0.010086418858753],
    [0.030625119399655, 0.010186693694402],
    [0.030591619596781, 0.010286859438745],
    [0.030557792182239, 0.010386915019088],
    [0.030523637518292, 0.010486859363916],
    [0.030489155970710, 0.010586691402906],
    [0.030454347908763, 0.010686410066936],
    [0.030419213705216, 0.010786014288099],
    [0.030383753736329, 0.010885502999714],
    [0.030347968381849, 0.010984875136338],
    [0.030311858025010, 0.011084129633775],
    [0.030275423052523, 0.011183265429088],
    [0.030238663854579, 0.011282281460612],
    [0.030201580824838, 0.011381176667967],
    [0.030164174360430, 0.011479949992062],
    [0.030126444861948, 0.011578600375117],
    [0.030088392733446, 0.011677126760663],
    [0.030050018382430, 0.011775528093563],
    [0.030011322219859, 0.011873803320018],
    [0.029972304660138, 0.011971951387578],
    [0.029932966121114, 0.012069971245157],
    [0.029893307024070, 0.012167861843041],
    [0.029853327793724, 0.012265622132901],
    [0.029813028858222, 0.012363251067801],
    [0.029772410649132, 0.012460747602215],
    [0.029731473601443, 0.012558110692033],
    [0.029690218153558, 0.012655339294575],
    [0.029648644747289, 0.012752432368600],
    [0.029606753827855, 0.012849388874320],
    [0.029564545843872, 0.012946207773407],
    [0.029522021247356, 0.013042888029011],
    [0.029479180493710, 0.013139428605762],
    [0.029436024041725, 0.013235828469789],
    [0.029392552353570, 0.013332086588727],
    [0.029348765894794, 0.013428201931728],
    [0.029304665134313, 0.013524173469475],
    [0.029260250544412, 0.013620000174189],
    [0.029215522600735, 0.013715681019643],
    [0.029170481782283, 0.013811214981173],
    [0.029125128571406, 0.013906601035686],
    [0.029079463453801, 0.014001838161674],
    [0.029033486918505, 0.014096925339225],
    [0.028987199457889, 0.014191861550031],
    [0.028940601567655, 0.014286645777401],
    [0.028893693746829, 0.014381277006273],
    [0.028846476497755, 0.014475754223221],
    [0.028798950326094, 0.014570076416472],
    [0.028751115740811, 0.014664242575910],
    [0.028702973254178, 0.014758251693091],
    [0.028654523381760, 0.014852102761253],
    [0.028605766642418, 0.014945794775326],
    [0.028556703558297, 0.015039326731945],
    [0.028507334654823, 0.015132697629457],
    [0.028457660460698, 0.015225906467935],
    [0.028407681507891, 0.015318952249187],
    [0.028357398331639, 0.015411833976768],
    [0.028306811470432, 0.015504550655988],
    [0.028255921466016, 0.015597101293927],
    [0.028204728863381, 0.015689484899442],
    [0.028153234210760, 0.015781700483179],
    [0.028101438059619, 0.015873747057582],
    [0.028049340964652, 0.015965623636907],
    [0.027996943483779, 0.016057329237229],
    [0.027944246178133, 0.016148862876456],
    [0.027891249612061, 0.016240223574335],
    [0.027837954353113, 0.016331410352467],
    [0.027784360972039, 0.016422422234315],
    [0.027730470042780, 0.016513258245214],
    [0.027676282142466, 0.016603917412384],
    [0.027621797851405, 0.016694398764938],
    [0.027567017753080, 0.016784701333894],
    [0.027511942434143, 0.016874824152183],
    [0.027456572484404, 0.016964766254662],
    [0.027400908496833, 0.017054526678124],
    [0.027344951067546, 0.017144104461307],
    [0.027288700795801, 0.017233498644904],
    [0.027232158283994, 0.017322708271577],
    [0.027175324137651, 0.017411732385960],
    [0.027118198965418, 0.017500570034678],
    [0.027060783379060, 0.017589220266351],
    [0.027003077993454, 0.017677682131607],
    [0.026945083426576, 0.017765954683088],
    [0.026886800299502, 0.017854036975468],
    [0.026828229236397, 0.017941928065456],
    [0.026769370864511, 0.018029627011808],
    [0.026710225814170, 0.018117132875340],
    [0.026650794718768, 0.018204444718934],
    [0.026591078214767, 0.018291561607551],
    [0.026531076941680, 0.018378482608238],
    [0.026470791542075, 0.018465206790142],
    [0.026410222661558, 0.018551733224515],
    [0.026349370948775, 0.018638060984730],
    [0.026288237055398, 0.018724189146286],
    [0.026226821636121, 0.018810116786819],
    [0.026165125348656, 0.018895842986112],
    [0.026103148853718, 0.018981366826109],
    [0.026040892815028, 0.019066687390916],
    [0.025978357899296, 0.019151803766819],
    [0.025915544776223, 0.019236715042290],
    [0.025852454118485, 0.019321420307998],
    [0.025789086601733, 0.019405918656817],
    [0.025725442904582, 0.019490209183837],
    [0.025661523708606, 0.019574290986376],
    [0.025597329698327, 0.019658163163984],
    [0.025532861561211, 0.019741824818458],
    [0.025468119987662, 0.019825275053848],
    [0.025403105671008, 0.019908512976470],
    [0.025337819307501, 0.019991537694913],
    [0.025272261596305, 0.020074348320047],
    [0.025206433239491, 0.020156943965039],
    [0.025140334942028, 0.020239323745355],
    [0.025073967411776, 0.020321486778774],
    [0.025007331359476, 0.020403432185395],
    [0.024940427498748, 0.020485159087650],
    [0.024873256546079, 0.020566666610309],
    [0.024805819220816, 0.020647953880491],
    [0.024738116245157, 0.020729020027676],
    [0.024670148344147, 0.020809864183709],
    [0.024601916245669, 0.020890485482816],
    [0.024533420680433, 0.020970883061607],
    [0.024464662381971, 0.021051056059087],
    [0.024395642086630, 0.021131003616670],
    [0.024326360533561, 0.021210724878181],
    [0.024256818464715, 0.021290218989868],
    [0.024187016624830, 0.021369485100415],
    [0.024116955761430, 0.021448522360944],
    [0.024046636624808, 0.021527329925030],
    [0.023976059968027, 0.021605906948708],
    [0.023905226546906, 0.021684252590480],
    [0.023834137120014, 0.021762366011328],
    [0.023762792448662, 0.021840246374720],
    [0.023691193296893, 0.021917892846620],
    [0.023619340431478, 0.021995304595495],
    [0.023547234621902, 0.022072480792330],
    [0.023474876640361, 0.022149420610628],
    [0.023402267261751, 0.022226123226426],
    [0.023329407263659, 0.022302587818300],
    [0.023256297426359, 0.022378813567377],
    [0.023182938532797, 0.022454799657339],
    [0.023109331368588, 0.022530545274437],
    [0.023035476722006, 0.022606049607496],
    [0.022961375383975, 0.022681311847926],
    [0.022887028148061, 0.022756331189727],
    [0.022812435810462, 0.022831106829504],
    [0.022737599170003, 0.022905637966469],
    [0.022662519028125, 0.022979923802453],
    [0.022587196188874, 0.023053963541915],
    [0.022511631458899, 0.023127756391950],
    [0.022435825647437, 0.023201301562294],
    [0.022359779566306, 0.023274598265338],
    [0.022283494029900, 0.023347645716133],
    [0.022206969855176, 0.023420443132400],
    [0.022130207861645, 0.023492989734537],
    [0.022053208871367, 0.023565284745628],
    [0.021975973708940, 0.023637327391451],
    [0.021898503201489, 0.023709116900488],
    [0.021820798178663, 0.023780652503931],
    [0.021742859472618, 0.023851933435691],
    [0.021664687918017, 0.023922958932406],
    [0.021586284352013, 0.023993728233451],
    [0.021507649614247, 0.024064240580942],
    [0.021428784546832, 0.024134495219750],
    [0.021349689994350, 0.024204491397504],
    [0.021270366803840, 0.024274228364600],
    [0.021190815824791, 0.024343705374213],
    [0.021111037909128, 0.024412921682298],
    [0.021031033911210, 0.024481876547605],
    [0.020950804687815, 0.024550569231683],
    [0.020870351098134, 0.024618998998889],
    [0.020789674003759, 0.024687165116394],
    [0.020708774268678, 0.024755066854194],
    [0.020627652759262, 0.024822703485116],
    [0.020546310344257, 0.024890074284826],
    [0.020464747894775, 0.024957178531837],
    [0.020382966284284, 0.025024015507516],
    [0.020300966388600, 0.025090584496093],
    [0.020218749085876, 0.025156884784668],
    [0.020136315256592, 0.025222915663218],
    [0.020053665783549, 0.025288676424605],
    [0.019970801551857, 0.025354166364584],
    [0.019887723448925, 0.025419384781811],
    [0.019804432364452, 0.025484330977848],
    [0.019720929190419, 0.025549004257175],
    [0.019637214821078, 0.025613403927192],
    [0.019553290152943, 0.025677529298230],
    [0.019469156084779, 0.025741379683559],
    [0.019384813517595, 0.025804954399392],
    [0.019300263354632, 0.025868252764895],
    [0.019215506501354, 0.025931274102193],
    [0.019130543865439, 0.025994017736379],
    [0.019045376356769, 0.026056482995518],
    [0.018960004887419, 0.026118669210657],
    [0.018874430371648, 0.026180575715833],
    [0.018788653725892, 0.026242201848076],
    [0.018702675868750, 0.026303546947421],
    [0.018616497720974, 0.026364610356909],
    [0.018530120205464, 0.026425391422602],
    [0.018443544247254, 0.026485889493583],
    [0.018356770773502, 0.026546103921965],
    [0.018269800713483, 0.026606034062902],
    [0.018182634998576, 0.026665679274589],
    [0.018095274562256, 0.026725038918274],
    [0.018007720340083, 0.026784112358263],
    [0.017919973269692, 0.026842898961926],
    [0.017832034290785, 0.026901398099707],
    [0.017743904345116, 0.026959609145127],
    [0.017655584376488, 0.027017531474792],
    [0.017567075330734, 0.027075164468401],
    [0.017478378155718, 0.027132507508750],
    [0.017389493801313, 0.027189559981742],
    [0.017300423219401, 0.027246321276391],
    [0.017211167363854, 0.027302790784828],
    [0.017121727190533, 0.027358967902310],
    [0.017032103657269, 0.027414852027226],
    [0.016942297723858, 0.027470442561102],
    [0.016852310352050, 0.027525738908608],
    [0.016762142505537, 0.027580740477564],
    [0.016671795149944, 0.027635446678948],
    [0.016581269252819, 0.027689856926900],
    [0.016490565783622, 0.027743970638730],
    [0.016399685713714, 0.027797787234924],
    [0.016308630016347, 0.027851306139149],
    [0.016217399666655, 0.027904526778260],
    [0.016125995641641, 0.027957448582309],
    [0.016034418920170, 0.028010070984544],
    [0.015942670482954, 0.028062393421421],
    [0.015850751312545, 0.028114415332610],
    [0.015758662393324, 0.028166136160998],
    [0.015666404711489, 0.028217555352697],
    [0.015573979255046, 0.028268672357047],
    [0.015481387013797, 0.028319486626627],
    [0.015388628979331, 0.028369997617257],
    [0.015295706145012, 0.028420204788004],
    [0.015202619505968, 0.028470107601191],
    [0.015109370059084, 0.028519705522399],
    [0.015015958802984, 0.028568998020472],
    [0.014922386738030, 0.028617984567529],
    [0.014828654866302, 0.028666664638963],
    [0.014734764191593, 0.028715037713449],
    [0.014640715719398, 0.028763103272951],
    [0.014546510456900, 0.028810860802724],
    [0.014452149412962, 0.028858309791325],
    [0.014357633598114, 0.028905449730613],
    [0.014262964024545, 0.028952280115756],
    [0.014168141706090, 0.028998800445240],
    [0.014073167658220, 0.029045010220868],
    [0.013978042898030, 0.029090908947771],
    [0.013882768444231, 0.029136496134411],
    [0.013787345317136, 0.029181771292585],
    [0.013691774538648, 0.029226733937433],
    [0.013596057132255, 0.029271383587441],
    [0.013500194123014, 0.029315719764447],
    [0.013404186537539, 0.029359741993647],
    [0.013308035403995, 0.029403449803598],
    [0.013211741752084, 0.029446842726223],
    [0.013115306613032, 0.029489920296820],
    [0.013018731019584, 0.029532682054063],
    [0.012922016005985, 0.029575127540008],
    [0.012825162607977, 0.029617256300097],
    [0.012728171862781, 0.029659067883165],
    [0.012631044809089, 0.029700561841444],
    [0.012533782487056, 0.029741737730567],
    [0.012436385938281, 0.029782595109573],
    [0.012338856205805, 0.029823133540913],
    [0.012241194334091, 0.029863352590452],
    [0.012143401369021, 0.029903251827477],
    [0.012045478357878, 0.029942830824699],
    [0.011947426349339, 0.029982089158259],
    [0.011849246393462, 0.030021026407731],
    [0.011750939541676, 0.030059642156129],
    [0.011652506846768, 0.030097935989909],
    [0.011553949362874, 0.030135907498976],
    [0.011455268145464, 0.030173556276684],
    [0.011356464251335, 0.030210881919845],
    [0.011257538738598, 0.030247884028732],
    [0.011158492666665, 0.030284562207083],
    [0.011059327096240, 0.030320916062102],
    [0.010960043089307, 0.030356945204470],
    [0.010860641709118, 0.030392649248343],
    [0.010761124020182, 0.030428027811361],
    [0.010661491088253, 0.030463080514646],
    [0.010561743980319, 0.030497806982812],
    [0.010461883764593, 0.030532206843968],
    [0.010361911510496, 0.030566279729717],
    [0.010261828288652, 0.030600025275167],
    [0.010161635170872, 0.030633443118931],
    [0.010061333230142, 0.030666532903129],
    [0.009960923540617, 0.030699294273397],
    [0.009860407177603, 0.030731726878888],
    [0.009759785217550, 0.030763830372273],
    [0.009659058738038, 0.030795604409750],
    [0.009558228817767, 0.030827048651045],
    [0.009457296536545, 0.030858162759415],
    [0.009356262975275, 0.030888946401653],
    [0.009255129215945, 0.030919399248091],
    [0.009153896341616, 0.030949520972603],
    [0.009052565436412, 0.030979311252611],
    [0.008951137585505, 0.031008769769084],
    [0.008849613875105, 0.031037896206544],
    [0.008747995392451, 0.031066690253072],
    [0.008646283225794, 0.031095151600306],
    [0.008544478464390, 0.031123279943448],
    [0.008442582198486, 0.031151074981266],
    [0.008340595519310, 0.031178536416098],
    [0.008238519519057, 0.031205663953853],
    [0.008136355290878, 0.031232457304017],
    [0.008034103928871, 0.031258916179656],
    [0.007931766528065, 0.031285040297416],
    [0.007829344184412, 0.031310829377528],
    [0.007726837994772, 0.031336283143813],
    [0.007624249056906, 0.031361401323680],
    [0.007521578469457, 0.031386183648135],
    [0.007418827331946, 0.031410629851778],
    [0.007315996744755, 0.031434739672811],
    [0.007213087809115, 0.031458512853036],
    [0.007110101627101, 0.031481949137863],
    [0.007007039301610, 0.031505048276306],
    [0.006903901936357, 0.031527810020993],
    [0.006800690635862, 0.031550234128164],
    [0.006697406505433, 0.031572320357675],
    [0.006594050651161, 0.031594068473000],
    [0.006490624179905, 0.031615478241233],
    [0.006387128199278, 0.031636549433095],
    [0.006283563817639, 0.031657281822929],
    [0.006179932144080, 0.031677675188707],
    [0.006076234288412, 0.031697729312034],
    [0.005972471361157, 0.031717443978146],
    [0.005868644473532, 0.031736818975914],
    [0.005764754737440, 0.031755854097848],
    [0.005660803265456, 0.031774549140098],
    [0.005556791170816, 0.031792903902453],
    [0.005452719567407, 0.031810918188350],
    [0.005348589569753, 0.031828591804869],
    [0.005244402293001, 0.031845924562742],
    [0.005140158852914, 0.031862916276347],
    [0.005035860365855, 0.031879566763717],
    [0.004931507948778, 0.031895875846539],
    [0.004827102719212, 0.031911843350155],
    [0.004722645795254, 0.031927469103567],
    [0.004618138295554, 0.031942752939435],
    [0.004513581339303, 0.031957694694082],
    [0.004408976046222, 0.031972294207493],
    [0.004304323536549, 0.031986551323320],
    [0.004199624931030, 0.032000465888879],
    [0.004094881350902, 0.032014037755158],
    [0.003990093917884, 0.032027266776813],
    [0.003885263754166, 0.032040152812170],
    [0.003780391982394, 0.032052695723232],
    [0.003675479725661, 0.032064895375674],
    [0.003570528107494, 0.032076751638847],
    [0.003465538251839, 0.032088264385780],
    [0.003360511283053, 0.032099433493181],
    [0.003255448325892, 0.032110258841438],
    [0.003150350505494, 0.032120740314619],
    [0.003045218947373, 0.032130877800478],
    [0.002940054777404, 0.032140671190449],
    [0.002834859121810, 0.032150120379653],
    [0.002729633107153, 0.032159225266897],
    [0.002624377860318, 0.032167985754674],
    [0.002519094508504, 0.032176401749168],
    [0.002413784179212, 0.032184473160250],
    [0.002308448000231, 0.032192199901481],
    [0.002203087099626, 0.032199581890114],
    [0.002097702605728, 0.032206619047093],
    [0.001992295647121, 0.032213311297057],
    [0.001886867352628, 0.032219658568338],
    [0.001781418851302, 0.032225660792960],
    [0.001675951272410, 0.032231317906644],
    [0.001570465745428, 0.032236629848809],
    [0.001464963400018, 0.032241596562566],
    [0.001359445366028, 0.032246217994727],
    [0.001253912773470, 0.032250494095799],
    [0.001148366752513, 0.032254424819990],
    [0.001042808433471, 0.032258010125204],
    [0.000937238946789, 0.032261249973045],
    [0.000831659423030, 0.032264144328817],
    [0.000726070992868, 0.032266693161525],
    [0.000620474787068, 0.032268896443871],
    [0.000514871936481, 0.032270754152261],
    [0.000409263572030, 0.032272266266801],
    [0.000303650824695, 0.032273432771295],
    [0.000198034825504, 0.032274253653254],
    [0.000092416705518, 0.032274728903884]
];

exports.MDCT_TABLE_240 = [              
    [0.091286604111815, 0.000298735779793],
    [0.091247502481454, 0.002688238127538],
    [0.091145864370807, 0.005075898091152],
    [0.090981759437558, 0.007460079287760],
    [0.090755300151030, 0.009839147718664],
    [0.090466641715108, 0.012211472889198],
    [0.090115981961863, 0.014575428926191],
    [0.089703561215976, 0.016929395692256],
    [0.089229662130024, 0.019271759896156],
    [0.088694609490769, 0.021600916198470],
    [0.088098769996564, 0.023915268311810],
    [0.087442552006035, 0.026213230094844],
    [0.086726405258214, 0.028493226639351],
    [0.085950820564309, 0.030753695349588],
    [0.085116329471329, 0.032993087013213],
    [0.084223503897785, 0.035209866863042],
    [0.083272955741727, 0.037402515628894],
    [0.082265336461381, 0.039569530578832],
    [0.081201336628670, 0.041709426549053],
    [0.080081685455930, 0.043820736961749],
    [0.078907150296148, 0.045902014830227],
    [0.077678536117054, 0.047951833750597],
    [0.076396684949434, 0.049968788879362],
    [0.075062475310050, 0.051951497896226],
    [0.073676821599542, 0.053898601951466],
    [0.072240673475749, 0.055808766597225],
    [0.070755015202858, 0.057680682702068],
    [0.069220864976840, 0.059513067348201],
    [0.067639274227625, 0.061304664710718],
    [0.066011326898512, 0.063054246918278],
    [0.064338138703282, 0.064760614894630],
    [0.062620856361546, 0.066422599180399],
    [0.060860656812842, 0.068039060734572],
    [0.059058746410016, 0.069608891715145],
    [0.057216360092450, 0.071131016238378],
    [0.055334760539699, 0.072604391116154],
    [0.053415237306106, 0.074028006570930],
    [0.051459105937014, 0.075400886927784],
    [0.049467707067153, 0.076722091283096],
    [0.047442405501835, 0.077990714149396],
    [0.045384589281588, 0.079205886075941],
    [0.043295668730857, 0.080366774244592],
    [0.041177075491445, 0.081472583040586],
    [0.039030261541332, 0.082522554597810],
    [0.036856698199564, 0.083515969318206],
    [0.034657875117883, 0.084452146364948],
    [0.032435299259796, 0.085330444129049],
    [0.030190493867775, 0.086150260669096],
    [0.027924997419306, 0.086911034123781],
    [0.025640362572491, 0.087612243096981],
    [0.023338155101933, 0.088253407015092],
    [0.021019952825636, 0.088834086456390],
    [0.018687344523641, 0.089353883452193],
    [0.016341928849164, 0.089812441759604],
    [0.013985313232951, 0.090209447105664],
    [0.011619112781631, 0.090544627402740],
    [0.009244949170797, 0.090817752935000],
    [0.006864449533597, 0.091028636515846],
    [0.004479245345574, 0.091177133616206],
    [0.002090971306534, 0.091263142463585]
];                    
},{}],22:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */

/********************************************************************************
 * Sample offset into the window indicating the beginning of a scalefactor
 * window band
 *
 * scalefactor window band - term for scalefactor bands within a window,
 * given in Table 4.110 to Table 4.128.
 *
 * scalefactor band - a set of spectral coefficients which are scaled by one
 * scalefactor. In case of EIGHT_SHORT_SEQUENCE and grouping a scalefactor band
 * may contain several scalefactor window bands of corresponding frequency. For
 * all other window_sequences scalefactor bands and scalefactor window bands are
 * identical.
 *******************************************************************************/
const SWB_OFFSET_1024_96 = new Uint16Array([
      0,   4,   8,  12,  16,  20,  24,  28,
     32,  36,  40,  44,  48,  52,  56,  64,
     72,  80,  88,  96, 108, 120, 132, 144,
    156, 172, 188, 212, 240, 276, 320, 384,
    448, 512, 576, 640, 704, 768, 832, 896,
    960, 1024
]);

const SWB_OFFSET_128_96 = new Uint16Array([
    0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 92, 128
]);

const SWB_OFFSET_1024_64 = new Uint16Array([
      0,   4,   8,  12,  16,  20,  24,  28,
     32,  36,  40,  44,  48,  52,  56,  64,
     72,  80,  88, 100, 112, 124, 140, 156,
    172, 192, 216, 240, 268, 304, 344, 384,
    424, 464, 504, 544, 584, 624, 664, 704,
    744, 784, 824, 864, 904, 944, 984, 1024
]);

const SWB_OFFSET_128_64 = new Uint16Array([
    0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 92, 128
]);

const SWB_OFFSET_1024_48 = new Uint16Array([
      0,   4,   8,  12,  16,  20,  24,  28,
     32,  36,  40,  48,  56,  64,  72,  80,
     88,  96, 108, 120, 132, 144, 160, 176,
    196, 216, 240, 264, 292, 320, 352, 384,
    416, 448, 480, 512, 544, 576, 608, 640,
    672, 704, 736, 768, 800, 832, 864, 896,
    928, 1024
]);

const SWB_OFFSET_128_48 = new Uint16Array([
     0,   4,   8,  12,  16,  20,  28,  36,
    44,  56,  68,  80,  96, 112, 128
]);

const SWB_OFFSET_1024_32 = new Uint16Array([
      0,   4,   8,  12,  16,  20,  24,  28,
     32,  36,  40,  48,  56,  64,  72,  80,
     88,  96, 108, 120, 132, 144, 160, 176,
    196, 216, 240, 264, 292, 320, 352, 384,
    416, 448, 480, 512, 544, 576, 608, 640,
    672, 704, 736, 768, 800, 832, 864, 896,
    928, 960, 992, 1024
]);

const SWB_OFFSET_1024_24 = new Uint16Array([
      0,   4,   8,  12,  16,  20,  24,  28,
     32,  36,  40,  44,  52,  60,  68,  76,
     84,  92, 100, 108, 116, 124, 136, 148,
    160, 172, 188, 204, 220, 240, 260, 284,
    308, 336, 364, 396, 432, 468, 508, 552,
    600, 652, 704, 768, 832, 896, 960, 1024
]);

const SWB_OFFSET_128_24 = new Uint16Array([
     0,   4,   8,  12,  16,  20,  24,  28,
    36,  44,  52,  64,  76,  92, 108, 128
]);

const SWB_OFFSET_1024_16 = new Uint16Array([
      0,   8,  16,  24,  32,  40,  48,  56,
     64,  72,  80,  88, 100, 112, 124, 136,
    148, 160, 172, 184, 196, 212, 228, 244,
    260, 280, 300, 320, 344, 368, 396, 424,
    456, 492, 532, 572, 616, 664, 716, 772,
    832, 896, 960, 1024
]);

const SWB_OFFSET_128_16 = new Uint16Array([
     0,   4,   8,  12,  16,  20,  24,  28,
    32,  40,  48,  60,  72,  88, 108, 128
]);

const SWB_OFFSET_1024_8 = new Uint16Array([
      0,  12,  24,  36,  48,  60,  72,  84,
     96, 108, 120, 132, 144, 156, 172, 188,
    204, 220, 236, 252, 268, 288, 308, 328,
    348, 372, 396, 420, 448, 476, 508, 544,
    580, 620, 664, 712, 764, 820, 880, 944,
    1024
]);

const SWB_OFFSET_128_8 = new Uint16Array([
     0,   4,   8,  12,  16,  20,  24,  28,
    36,  44,  52,  60,  72,  88, 108, 128
]);

exports.SWB_OFFSET_1024 = [
    SWB_OFFSET_1024_96,
    SWB_OFFSET_1024_96,
    SWB_OFFSET_1024_64,
    SWB_OFFSET_1024_48,
    SWB_OFFSET_1024_48,
    SWB_OFFSET_1024_32,
    SWB_OFFSET_1024_24,
    SWB_OFFSET_1024_24,
    SWB_OFFSET_1024_16,
    SWB_OFFSET_1024_16,
    SWB_OFFSET_1024_16,
    SWB_OFFSET_1024_8
];

exports.SWB_OFFSET_128 = [
    SWB_OFFSET_128_96,
    SWB_OFFSET_128_96,
    SWB_OFFSET_128_64,
    SWB_OFFSET_128_48,
    SWB_OFFSET_128_48,
    SWB_OFFSET_128_48,
    SWB_OFFSET_128_24,
    SWB_OFFSET_128_24,
    SWB_OFFSET_128_16,
    SWB_OFFSET_128_16,
    SWB_OFFSET_128_16,
    SWB_OFFSET_128_8
];

exports.SWB_SHORT_WINDOW_COUNT = new Uint8Array([
    12, 12, 12, 14, 14, 14, 15, 15, 15, 15, 15, 15
]);

exports.SWB_LONG_WINDOW_COUNT = new Uint8Array([
    41, 41, 47, 49, 49, 51, 47, 47, 43, 43, 43, 40
]);

/*
 * Scalefactor lookup table
 */
exports.SCALEFACTOR_TABLE = (function() {
    var table = new Float32Array(428);
    
    for (var i = 0; i < 428; i++) {
        table[i] = Math.pow(2, (i - 200) / 4);
    }
    
    return table;
})();


/**
 * Inverse quantization lookup table
 */
exports.IQ_TABLE = (function() {
    var table = new Float32Array(8191),
        four_thirds = 4/3;
        
    for (var i = 0; i < 8191; i++) {
        table[i] = Math.pow(i, four_thirds);
    }
    
    return table;
})();

exports.SAMPLE_RATES = new Int32Array([
    96000, 88200, 64000, 48000, 44100, 32000,
    24000, 22050, 16000, 12000, 11025, 8000, 7350    
]);

},{}],23:[function(_dereq_,module,exports){
/*
 * AAC.js - Advanced Audio Coding decoder in JavaScript
 * Created by Devon Govett
 * Copyright (c) 2012, Official.fm Labs
 *
 * AAC.js is free software; you can redistribute it and/or modify it 
 * under the terms of the GNU Lesser General Public License as 
 * published by the Free Software Foundation; either version 3 of the 
 * License, or (at your option) any later version.
 *
 * AAC.js is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General 
 * Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library.
 * If not, see <http://www.gnu.org/licenses/>.
 */
    
// Temporal Noise Shaping
function TNS(config) {
    this.maxBands = TNS_MAX_BANDS_1024[config.sampleIndex]
    this.nFilt = new Int32Array(8);
    this.length = new Array(8);
    this.direction = new Array(8);
    this.order = new Array(8);
    this.coef = new Array(8);
    
    // Probably could allocate these as needed
    for (var w = 0; w < 8; w++) {
        this.length[w] = new Int32Array(4);
        this.direction[w] = new Array(4);
        this.order[w] = new Int32Array(4);
        this.coef[w] = new Array(4);
        
        for (var filt = 0; filt < 4; filt++) {
            this.coef[w][filt] = new Float32Array(TNS_MAX_ORDER);
        }
    }
    
    this.lpc = new Float32Array(TNS_MAX_ORDER);
    this.tmp = new Float32Array(TNS_MAX_ORDER);
}

const TNS_MAX_ORDER = 20,
      SHORT_BITS = [1, 4, 3],
      LONG_BITS = [2, 6, 5];
      
const TNS_COEF_1_3 = [0.00000000, -0.43388373, 0.64278758, 0.34202015],

      TNS_COEF_0_3 = [0.00000000, -0.43388373, -0.78183150, -0.97492790,
                      0.98480773, 0.86602539, 0.64278758, 0.34202015],
                      
      TNS_COEF_1_4 = [0.00000000, -0.20791170, -0.40673664, -0.58778524,
                      0.67369562, 0.52643216, 0.36124167, 0.18374951],
                      
      TNS_COEF_0_4 = [0.00000000, -0.20791170, -0.40673664, -0.58778524,
                      -0.74314481, -0.86602539, -0.95105654, -0.99452192,
                      0.99573416, 0.96182561, 0.89516330, 0.79801720,
                      0.67369562, 0.52643216, 0.36124167, 0.18374951],
                      
      TNS_TABLES = [TNS_COEF_0_3, TNS_COEF_0_4, TNS_COEF_1_3, TNS_COEF_1_4];
      
const TNS_MAX_BANDS_1024 = [31, 31, 34, 40, 42, 51, 46, 46, 42, 42, 42, 39, 39],
      TNS_MAX_BANDS_128 = [9, 9, 10, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14];

TNS.prototype.decode = function(stream, info) {
    var windowCount = info.windowCount,
        bits = info.windowSequence === 2 ? SHORT_BITS : LONG_BITS;
    
    for (var w = 0; w < windowCount; w++) {
        if (this.nFilt[w] = stream.read(bits[0])) {
            var coefRes = stream.read(1),
                nFilt_w = this.nFilt[w],
                length_w = this.length[w],
                order_w = this.order[w],
                direction_w = this.direction[w],
                coef_w = this.coef[w];
            
            for (var filt = 0; filt < nFilt_w; filt++) {
                length_w[filt] = stream.read(bits[1]);
                
                if ((order_w[filt] = stream.read(bits[2])) > 20)
                    throw new Error("TNS filter out of range: " + order_w[filt]);
                
                if (order_w[filt]) {
                    direction_w[filt] = !!stream.read(1);
                    var coefCompress = stream.read(1),
                        coefLen = coefRes + 3 - coefCompress,
                        tmp = 2 * coefCompress + coefRes,
                        table = TNS_TABLES[tmp],
                        order_w_filt = order_w[filt],
                        coef_w_filt = coef_w[filt];
                        
                    for (var i = 0; i < order_w_filt; i++)
                        coef_w_filt[i] = table[stream.read(coefLen)];
                }
                    
            }
        }
    }
};

TNS.prototype.process = function(ics, data, decode) {
    var mmm = Math.min(this.maxBands, ics.maxSFB),
        lpc = this.lpc,
        tmp = this.tmp,
        info = ics.info,
        windowCount = info.windowCount;
        
    for (var w = 0; w < windowCount; w++) {
        var bottom = info.swbCount,
            nFilt_w = this.nFilt[w],
            length_w = this.length[w],
            order_w = this.order[w],
            coef_w = this.coef[w],
            direction_w = this.direction[w];
        
        for (var filt = 0; filt < nFilt_w; filt++) {
            var top = bottom,
                bottom = Math.max(0, tmp - length_w[filt]),
                order = order_w[filt];
                
            if (order === 0) continue;
            
            // calculate lpc coefficients
            var autoc = coef_w[filt];
            for (var i = 0; i < order; i++) {
                var r = -autoc[i];
                lpc[i] = r;

                for (var j = 0, len = (i + 1) >> 1; j < len; j++) {
                    var f = lpc[j],
                        b = lpc[i - 1 - j];

                    lpc[j] = f + r * b;
                    lpc[i - 1 - j] = b + r * f;
                }
            }
            
            var start = info.swbOffsets[Math.min(bottom, mmm)],
                end = info.swbOffsets[Math.min(top, mmm)],
                size,
                inc = 1;
                
            if ((size = end - start) <= 0) continue;
            
            if (direction_w[filt]) {
                inc = -1;
                start = end - 1;
            }
            
            start += w * 128;
            
            if (decode) {
                // ar filter
                for (var m = 0; m < size; m++, start += inc) {
                    for (var i = 1; i <= Math.min(m, order); i++) {
                        data[start] -= data[start - i * inc] * lpc[i - 1];
                    }
                }
            } else {
                // ma filter
                for (var m = 0; m < size; m++, start += inc) {
                    tmp[0] = data[start];
                    
                    for (var i = 1; i <= Math.min(m, order); i++)
                        data[start] += tmp[i] * lpc[i - 1];
                    
                    for (var i = order; i > 0; i--)
                        tmp[i] = tmp[i - 1];
                }
            }
        }
    }
};
    
module.exports = TNS;

},{}],24:[function(_dereq_,module,exports){
var Decoder, LPCMDecoder,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Decoder = _dereq_('../decoder');

LPCMDecoder = (function(_super) {
  __extends(LPCMDecoder, _super);

  function LPCMDecoder() {
    this.readChunk = __bind(this.readChunk, this);
    return LPCMDecoder.__super__.constructor.apply(this, arguments);
  }

  Decoder.register('lpcm', LPCMDecoder);

  LPCMDecoder.prototype.readChunk = function() {
    var chunkSize, i, littleEndian, output, samples, stream, _i, _j, _k, _l, _m, _n;
    stream = this.stream;
    littleEndian = this.format.littleEndian;
    chunkSize = Math.min(4096, stream.remainingBytes());
    samples = chunkSize / (this.format.bitsPerChannel / 8) | 0;
    if (chunkSize < this.format.bitsPerChannel / 8) {
      return null;
    }
    if (this.format.floatingPoint) {
      switch (this.format.bitsPerChannel) {
        case 32:
          output = new Float32Array(samples);
          for (i = _i = 0; _i < samples; i = _i += 1) {
            output[i] = stream.readFloat32(littleEndian);
          }
          break;
        case 64:
          output = new Float64Array(samples);
          for (i = _j = 0; _j < samples; i = _j += 1) {
            output[i] = stream.readFloat64(littleEndian);
          }
          break;
        default:
          throw new Error('Unsupported bit depth.');
      }
    } else {
      switch (this.format.bitsPerChannel) {
        case 8:
          output = new Int8Array(samples);
          for (i = _k = 0; _k < samples; i = _k += 1) {
            output[i] = stream.readInt8();
          }
          break;
        case 16:
          output = new Int16Array(samples);
          for (i = _l = 0; _l < samples; i = _l += 1) {
            output[i] = stream.readInt16(littleEndian);
          }
          break;
        case 24:
          output = new Int32Array(samples);
          for (i = _m = 0; _m < samples; i = _m += 1) {
            output[i] = stream.readInt24(littleEndian);
          }
          break;
        case 32:
          output = new Int32Array(samples);
          for (i = _n = 0; _n < samples; i = _n += 1) {
            output[i] = stream.readInt32(littleEndian);
          }
          break;
        default:
          throw new Error('Unsupported bit depth.');
      }
    }
    return output;
  };

  return LPCMDecoder;

})(Decoder);


},{"../decoder":12}],25:[function(_dereq_,module,exports){
var Decoder, XLAWDecoder,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Decoder = _dereq_('../decoder');

XLAWDecoder = (function(_super) {
  var BIAS, QUANT_MASK, SEG_MASK, SEG_SHIFT, SIGN_BIT;

  __extends(XLAWDecoder, _super);

  function XLAWDecoder() {
    this.readChunk = __bind(this.readChunk, this);
    return XLAWDecoder.__super__.constructor.apply(this, arguments);
  }

  Decoder.register('ulaw', XLAWDecoder);

  Decoder.register('alaw', XLAWDecoder);

  SIGN_BIT = 0x80;

  QUANT_MASK = 0xf;

  SEG_SHIFT = 4;

  SEG_MASK = 0x70;

  BIAS = 0x84;

  XLAWDecoder.prototype.init = function() {
    var i, seg, t, table, val, _i, _j;
    this.format.bitsPerChannel = 16;
    this.table = table = new Int16Array(256);
    if (this.format.formatID === 'ulaw') {
      for (i = _i = 0; _i < 256; i = ++_i) {
        val = ~i;
        t = ((val & QUANT_MASK) << 3) + BIAS;
        t <<= (val & SEG_MASK) >>> SEG_SHIFT;
        table[i] = val & SIGN_BIT ? BIAS - t : t - BIAS;
      }
    } else {
      for (i = _j = 0; _j < 256; i = ++_j) {
        val = i ^ 0x55;
        t = val & QUANT_MASK;
        seg = (val & SEG_MASK) >>> SEG_SHIFT;
        if (seg) {
          t = (t + t + 1 + 32) << (seg + 2);
        } else {
          t = (t + t + 1) << 3;
        }
        table[i] = val & SIGN_BIT ? t : -t;
      }
    }
  };

  XLAWDecoder.prototype.readChunk = function() {
    var i, output, samples, stream, table, _i;
    stream = this.stream, table = this.table;
    samples = Math.min(4096, this.stream.remainingBytes());
    if (samples === 0) {
      return;
    }
    output = new Int16Array(samples);
    for (i = _i = 0; _i < samples; i = _i += 1) {
      output[i] = table[stream.readUInt8()];
    }
    return output;
  };

  return XLAWDecoder;

})(Decoder);


},{"../decoder":12}],26:[function(_dereq_,module,exports){
var BufferList, Demuxer, EventEmitter, Stream,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('./core/events');

BufferList = _dereq_('./core/bufferlist');

Stream = _dereq_('./core/stream');

Demuxer = (function(_super) {
  var formats;

  __extends(Demuxer, _super);

  Demuxer.probe = function(buffer) {
    return false;
  };

  function Demuxer(source, chunk) {
    var list, received;
    list = new BufferList;
    list.append(chunk);
    this.stream = new Stream(list);
    received = false;
    source.on('data', (function(_this) {
      return function(chunk) {
        received = true;
        list.append(chunk);
        return _this.readChunk(chunk);
      };
    })(this));
    source.on('error', (function(_this) {
      return function(err) {
        return _this.emit('error', err);
      };
    })(this));
    source.on('end', (function(_this) {
      return function() {
        if (!received) {
          _this.readChunk(chunk);
        }
        return _this.emit('end');
      };
    })(this));
    this.seekPoints = [];
    this.init();
  }

  Demuxer.prototype.init = function() {};

  Demuxer.prototype.readChunk = function(chunk) {};

  Demuxer.prototype.addSeekPoint = function(offset, timestamp) {
    var index;
    index = this.searchTimestamp(timestamp);
    return this.seekPoints.splice(index, 0, {
      offset: offset,
      timestamp: timestamp
    });
  };

  Demuxer.prototype.searchTimestamp = function(timestamp, backward) {
    var high, low, mid, time;
    low = 0;
    high = this.seekPoints.length;
    if (high > 0 && this.seekPoints[high - 1].timestamp < timestamp) {
      return high;
    }
    while (low < high) {
      mid = (low + high) >> 1;
      time = this.seekPoints[mid].timestamp;
      if (time < timestamp) {
        low = mid + 1;
      } else if (time >= timestamp) {
        high = mid;
      }
    }
    if (high > this.seekPoints.length) {
      high = this.seekPoints.length;
    }
    return high;
  };

  Demuxer.prototype.seek = function(timestamp) {
    var index, seekPoint;
    if (this.format && this.format.framesPerPacket > 0 && this.format.bytesPerPacket > 0) {
      seekPoint = {
        timestamp: timestamp,
        offset: this.format.bytesPerPacket * timestamp / this.format.framesPerPacket
      };
      return seekPoint;
    } else {
      index = this.searchTimestamp(timestamp);
      return this.seekPoints[index];
    }
  };

  formats = [];

  Demuxer.register = function(demuxer) {
    return formats.push(demuxer);
  };

  Demuxer.find = function(buffer) {
    var e, format, offset, stream, _i, _len;
    stream = Stream.fromBuffer(buffer);
    for (_i = 0, _len = formats.length; _i < _len; _i++) {
      format = formats[_i];
      offset = stream.offset;
      try {
        if (format.probe(stream)) {
          return format;
        }
      } catch (_error) {
        e = _error;
      }
      stream.seek(offset);
    }
    return null;
  };

  return Demuxer;

})(EventEmitter);

module.exports = Demuxer;


},{"./core/bufferlist":8,"./core/events":9,"./core/stream":10}],27:[function(_dereq_,module,exports){
var ADTSDemuxer, Bitstream, Buffer, Demuxer, tables,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

tables = _dereq_('../decoders/aac/tables');

Demuxer = _dereq_('../demuxer');

Bitstream = _dereq_('../core/bitstream');

Buffer = _dereq_('../core/buffer');

ADTSDemuxer = (function(_super) {
  __extends(ADTSDemuxer, _super);

  function ADTSDemuxer() {
    return ADTSDemuxer.__super__.constructor.apply(this, arguments);
  }

  Demuxer.register(ADTSDemuxer);

  ADTSDemuxer.probe = function(stream) {
    var offset;
    offset = stream.offset;
    while (stream.available(2)) {
      if ((stream.readUInt16() & 0xfff6) === 0xfff0) {
        stream.seek(offset);
        return true;
      }
    }
    stream.seek(offset);
    return false;
  };

  ADTSDemuxer.prototype.init = function() {
    return this.bitstream = new Bitstream(this.stream);
  };

  ADTSDemuxer.readHeader = function(stream) {
    var protectionAbsent, ret;
    if (stream.read(12) !== 0xfff) {
      throw new Error('Invalid ADTS header.');
    }
    ret = {};
    stream.advance(3);
    protectionAbsent = !!stream.read(1);
    ret.profile = stream.read(2) + 1;
    ret.samplingIndex = stream.read(4);
    stream.advance(1);
    ret.chanConfig = stream.read(3);
    stream.advance(4);
    ret.frameLength = stream.read(13);
    stream.advance(11);
    ret.numFrames = stream.read(2) + 1;
    if (!protectionAbsent) {
      stream.advance(16);
    }
    return ret;
  };

  ADTSDemuxer.prototype.readChunk = function() {
    var buffer, cookie, format, header, offset, _results;
    if (!this.sentHeader) {
      offset = this.stream.offset;
      header = ADTSDemuxer.readHeader(this.bitstream);
      format = {
        formatID: 'aac ',
        sampleRate: tables.SAMPLE_RATES[header.samplingIndex],
        channelsPerFrame: header.chanConfig,
        bitsPerChannel: 16
      };
      this.emit('format', format);
      cookie = new Uint8Array(2);
      cookie[0] = (header.profile << 3) | ((header.samplingIndex >> 1) & 7);
      cookie[1] = ((header.samplingIndex & 1) << 7) | (header.chanConfig << 3);
      this.emit('cookie', new Buffer(cookie));
      this.stream.seek(offset);
      this.sentHeader = true;
    }
    _results = [];
    while (this.stream.available(1)) {
      buffer = this.stream.readSingleBuffer(this.stream.remainingBytes());
      _results.push(this.emit('data', buffer));
    }
    return _results;
  };

  return ADTSDemuxer;

})(Demuxer);


},{"../core/bitstream":6,"../core/buffer":7,"../decoders/aac/tables":22,"../demuxer":26}],28:[function(_dereq_,module,exports){
var AIFFDemuxer, Demuxer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Demuxer = _dereq_('../demuxer');

AIFFDemuxer = (function(_super) {
  __extends(AIFFDemuxer, _super);

  function AIFFDemuxer() {
    return AIFFDemuxer.__super__.constructor.apply(this, arguments);
  }

  Demuxer.register(AIFFDemuxer);

  AIFFDemuxer.probe = function(buffer) {
    var _ref;
    return buffer.peekString(0, 4) === 'FORM' && ((_ref = buffer.peekString(8, 4)) === 'AIFF' || _ref === 'AIFC');
  };

  AIFFDemuxer.prototype.readChunk = function() {
    var buffer, format, offset, _ref;
    if (!this.readStart && this.stream.available(12)) {
      if (this.stream.readString(4) !== 'FORM') {
        return this.emit('error', 'Invalid AIFF.');
      }
      this.fileSize = this.stream.readUInt32();
      this.fileType = this.stream.readString(4);
      this.readStart = true;
      if ((_ref = this.fileType) !== 'AIFF' && _ref !== 'AIFC') {
        return this.emit('error', 'Invalid AIFF.');
      }
    }
    while (this.stream.available(1)) {
      if (!this.readHeaders && this.stream.available(8)) {
        this.type = this.stream.readString(4);
        this.len = this.stream.readUInt32();
      }
      switch (this.type) {
        case 'COMM':
          if (!this.stream.available(this.len)) {
            return;
          }
          this.format = {
            formatID: 'lpcm',
            channelsPerFrame: this.stream.readUInt16(),
            sampleCount: this.stream.readUInt32(),
            bitsPerChannel: this.stream.readUInt16(),
            sampleRate: this.stream.readFloat80(),
            framesPerPacket: 1,
            littleEndian: false,
            floatingPoint: false
          };
          this.format.bytesPerPacket = (this.format.bitsPerChannel / 8) * this.format.channelsPerFrame;
          if (this.fileType === 'AIFC') {
            format = this.stream.readString(4);
            this.format.littleEndian = format === 'sowt' && this.format.bitsPerChannel > 8;
            this.format.floatingPoint = format === 'fl32' || format === 'fl64';
            if (format === 'twos' || format === 'sowt' || format === 'fl32' || format === 'fl64' || format === 'NONE') {
              format = 'lpcm';
            }
            this.format.formatID = format;
            this.len -= 4;
          }
          this.stream.advance(this.len - 18);
          this.emit('format', this.format);
          this.emit('duration', this.format.sampleCount / this.format.sampleRate * 1000 | 0);
          break;
        case 'SSND':
          if (!(this.readSSNDHeader && this.stream.available(4))) {
            offset = this.stream.readUInt32();
            this.stream.advance(4);
            this.stream.advance(offset);
            this.readSSNDHeader = true;
          }
          buffer = this.stream.readSingleBuffer(this.len);
          this.len -= buffer.length;
          this.readHeaders = this.len > 0;
          this.emit('data', buffer);
          break;
        default:
          if (!this.stream.available(this.len)) {
            return;
          }
          this.stream.advance(this.len);
      }
      if (this.type !== 'SSND') {
        this.readHeaders = false;
      }
    }
  };

  return AIFFDemuxer;

})(Demuxer);


},{"../demuxer":26}],29:[function(_dereq_,module,exports){
var AUDemuxer, Demuxer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Demuxer = _dereq_('../demuxer');

AUDemuxer = (function(_super) {
  var bps, formats;

  __extends(AUDemuxer, _super);

  function AUDemuxer() {
    return AUDemuxer.__super__.constructor.apply(this, arguments);
  }

  Demuxer.register(AUDemuxer);

  AUDemuxer.probe = function(buffer) {
    return buffer.peekString(0, 4) === '.snd';
  };

  bps = [8, 8, 16, 24, 32, 32, 64];

  bps[26] = 8;

  formats = {
    1: 'ulaw',
    27: 'alaw'
  };

  AUDemuxer.prototype.readChunk = function() {
    var bytes, dataSize, encoding, size;
    if (!this.readHeader && this.stream.available(24)) {
      if (this.stream.readString(4) !== '.snd') {
        return this.emit('error', 'Invalid AU file.');
      }
      size = this.stream.readUInt32();
      dataSize = this.stream.readUInt32();
      encoding = this.stream.readUInt32();
      this.format = {
        formatID: formats[encoding] || 'lpcm',
        littleEndian: false,
        floatingPoint: encoding === 6 || encoding === 7,
        bitsPerChannel: bps[encoding - 1],
        sampleRate: this.stream.readUInt32(),
        channelsPerFrame: this.stream.readUInt32(),
        framesPerPacket: 1
      };
      if (this.format.bitsPerChannel == null) {
        return this.emit('error', 'Unsupported encoding in AU file.');
      }
      this.format.bytesPerPacket = (this.format.bitsPerChannel / 8) * this.format.channelsPerFrame;
      if (dataSize !== 0xffffffff) {
        bytes = this.format.bitsPerChannel / 8;
        this.emit('duration', dataSize / bytes / this.format.channelsPerFrame / this.format.sampleRate * 1000 | 0);
      }
      this.emit('format', this.format);
      this.readHeader = true;
    }
    if (this.readHeader) {
      while (this.stream.available(1)) {
        this.emit('data', this.stream.readSingleBuffer(this.stream.remainingBytes()));
      }
    }
  };

  return AUDemuxer;

})(Demuxer);


},{"../demuxer":26}],30:[function(_dereq_,module,exports){
var CAFDemuxer, Demuxer, M4ADemuxer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Demuxer = _dereq_('../demuxer');

M4ADemuxer = _dereq_('./m4a');

CAFDemuxer = (function(_super) {
  __extends(CAFDemuxer, _super);

  function CAFDemuxer() {
    return CAFDemuxer.__super__.constructor.apply(this, arguments);
  }

  Demuxer.register(CAFDemuxer);

  CAFDemuxer.probe = function(buffer) {
    return buffer.peekString(0, 4) === 'caff';
  };

  CAFDemuxer.prototype.readChunk = function() {
    var buffer, byteOffset, cookie, entries, flags, i, key, metadata, offset, sampleOffset, value, _i, _j, _ref;
    if (!this.format && this.stream.available(64)) {
      if (this.stream.readString(4) !== 'caff') {
        return this.emit('error', "Invalid CAF, does not begin with 'caff'");
      }
      this.stream.advance(4);
      if (this.stream.readString(4) !== 'desc') {
        return this.emit('error', "Invalid CAF, 'caff' is not followed by 'desc'");
      }
      if (!(this.stream.readUInt32() === 0 && this.stream.readUInt32() === 32)) {
        return this.emit('error', "Invalid 'desc' size, should be 32");
      }
      this.format = {};
      this.format.sampleRate = this.stream.readFloat64();
      this.format.formatID = this.stream.readString(4);
      flags = this.stream.readUInt32();
      if (this.format.formatID === 'lpcm') {
        this.format.floatingPoint = Boolean(flags & 1);
        this.format.littleEndian = Boolean(flags & 2);
      }
      this.format.bytesPerPacket = this.stream.readUInt32();
      this.format.framesPerPacket = this.stream.readUInt32();
      this.format.channelsPerFrame = this.stream.readUInt32();
      this.format.bitsPerChannel = this.stream.readUInt32();
      this.emit('format', this.format);
    }
    while (this.stream.available(1)) {
      if (!this.headerCache) {
        this.headerCache = {
          type: this.stream.readString(4),
          oversize: this.stream.readUInt32() !== 0,
          size: this.stream.readUInt32()
        };
        if (this.headerCache.oversize) {
          return this.emit('error', "Holy Shit, an oversized file, not supported in JS");
        }
      }
      switch (this.headerCache.type) {
        case 'kuki':
          if (this.stream.available(this.headerCache.size)) {
            if (this.format.formatID === 'aac ') {
              offset = this.stream.offset + this.headerCache.size;
              if (cookie = M4ADemuxer.readEsds(this.stream)) {
                this.emit('cookie', cookie);
              }
              this.stream.seek(offset);
            } else {
              buffer = this.stream.readBuffer(this.headerCache.size);
              this.emit('cookie', buffer);
            }
            this.headerCache = null;
          }
          break;
        case 'pakt':
          if (this.stream.available(this.headerCache.size)) {
            if (this.stream.readUInt32() !== 0) {
              return this.emit('error', 'Sizes greater than 32 bits are not supported.');
            }
            this.numPackets = this.stream.readUInt32();
            if (this.stream.readUInt32() !== 0) {
              return this.emit('error', 'Sizes greater than 32 bits are not supported.');
            }
            this.numFrames = this.stream.readUInt32();
            this.primingFrames = this.stream.readUInt32();
            this.remainderFrames = this.stream.readUInt32();
            this.emit('duration', this.numFrames / this.format.sampleRate * 1000 | 0);
            this.sentDuration = true;
            byteOffset = 0;
            sampleOffset = 0;
            for (i = _i = 0, _ref = this.numPackets; _i < _ref; i = _i += 1) {
              this.addSeekPoint(byteOffset, sampleOffset);
              byteOffset += this.format.bytesPerPacket || M4ADemuxer.readDescrLen(this.stream);
              sampleOffset += this.format.framesPerPacket || M4ADemuxer.readDescrLen(this.stream);
            }
            this.headerCache = null;
          }
          break;
        case 'info':
          entries = this.stream.readUInt32();
          metadata = {};
          for (i = _j = 0; 0 <= entries ? _j < entries : _j > entries; i = 0 <= entries ? ++_j : --_j) {
            key = this.stream.readString(null);
            value = this.stream.readString(null);
            metadata[key] = value;
          }
          this.emit('metadata', metadata);
          this.headerCache = null;
          break;
        case 'data':
          if (!this.sentFirstDataChunk) {
            this.stream.advance(4);
            this.headerCache.size -= 4;
            if (this.format.bytesPerPacket !== 0 && !this.sentDuration) {
              this.numFrames = this.headerCache.size / this.format.bytesPerPacket;
              this.emit('duration', this.numFrames / this.format.sampleRate * 1000 | 0);
            }
            this.sentFirstDataChunk = true;
          }
          buffer = this.stream.readSingleBuffer(this.headerCache.size);
          this.headerCache.size -= buffer.length;
          this.emit('data', buffer);
          if (this.headerCache.size <= 0) {
            this.headerCache = null;
          }
          break;
        default:
          if (this.stream.available(this.headerCache.size)) {
            this.stream.advance(this.headerCache.size);
            this.headerCache = null;
          }
      }
    }
  };

  return CAFDemuxer;

})(Demuxer);


},{"../demuxer":26,"./m4a":31}],31:[function(_dereq_,module,exports){
var Demuxer, M4ADemuxer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Demuxer = _dereq_('../demuxer');

M4ADemuxer = (function(_super) {
  var BITS_PER_CHANNEL, TYPES, after, atom, atoms, bool, containers, diskTrack, genres, meta, string;

  __extends(M4ADemuxer, _super);

  function M4ADemuxer() {
    return M4ADemuxer.__super__.constructor.apply(this, arguments);
  }

  Demuxer.register(M4ADemuxer);

  TYPES = ['M4A ', 'M4P ', 'M4B ', 'M4V ', 'isom', 'mp42', 'qt  '];

  M4ADemuxer.probe = function(buffer) {
    var _ref;
    return buffer.peekString(4, 4) === 'ftyp' && (_ref = buffer.peekString(8, 4), __indexOf.call(TYPES, _ref) >= 0);
  };

  M4ADemuxer.prototype.init = function() {
    this.atoms = [];
    this.offsets = [];
    this.track = null;
    return this.tracks = [];
  };

  atoms = {};

  containers = {};

  atom = function(name, fn) {
    var c, container, _i, _len, _ref;
    c = [];
    _ref = name.split('.').slice(0, -1);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      container = _ref[_i];
      c.push(container);
      containers[c.join('.')] = true;
    }
    if (atoms[name] == null) {
      atoms[name] = {};
    }
    return atoms[name].fn = fn;
  };

  after = function(name, fn) {
    if (atoms[name] == null) {
      atoms[name] = {};
    }
    return atoms[name].after = fn;
  };

  M4ADemuxer.prototype.readChunk = function() {
    var handler, path, type;
    this["break"] = false;
    while (this.stream.available(1) && !this["break"]) {
      if (!this.readHeaders) {
        if (!this.stream.available(8)) {
          return;
        }
        this.len = this.stream.readUInt32() - 8;
        this.type = this.stream.readString(4);
        if (this.len === 0) {
          continue;
        }
        this.atoms.push(this.type);
        this.offsets.push(this.stream.offset + this.len);
        this.readHeaders = true;
      }
      path = this.atoms.join('.');
      handler = atoms[path];
      if (handler != null ? handler.fn : void 0) {
        if (!(this.stream.available(this.len) || path === 'mdat')) {
          return;
        }
        handler.fn.call(this);
        if (path in containers) {
          this.readHeaders = false;
        }
      } else if (path in containers) {
        this.readHeaders = false;
      } else {
        if (!this.stream.available(this.len)) {
          return;
        }
        this.stream.advance(this.len);
      }
      while (this.stream.offset >= this.offsets[this.offsets.length - 1]) {
        handler = atoms[this.atoms.join('.')];
        if (handler != null ? handler.after : void 0) {
          handler.after.call(this);
        }
        type = this.atoms.pop();
        this.offsets.pop();
        this.readHeaders = false;
      }
    }
  };

  atom('ftyp', function() {
    var _ref;
    if (_ref = this.stream.readString(4), __indexOf.call(TYPES, _ref) < 0) {
      return this.emit('error', 'Not a valid M4A file.');
    }
    return this.stream.advance(this.len - 4);
  });

  atom('moov.trak', function() {
    this.track = {};
    return this.tracks.push(this.track);
  });

  atom('moov.trak.tkhd', function() {
    this.stream.advance(4);
    this.stream.advance(8);
    this.track.id = this.stream.readUInt32();
    return this.stream.advance(this.len - 16);
  });

  atom('moov.trak.mdia.hdlr', function() {
    this.stream.advance(4);
    this.stream.advance(4);
    this.track.type = this.stream.readString(4);
    this.stream.advance(12);
    return this.stream.advance(this.len - 24);
  });

  atom('moov.trak.mdia.mdhd', function() {
    this.stream.advance(4);
    this.stream.advance(8);
    this.track.timeScale = this.stream.readUInt32();
    this.track.duration = this.stream.readUInt32();
    return this.stream.advance(4);
  });

  BITS_PER_CHANNEL = {
    ulaw: 8,
    alaw: 8,
    in24: 24,
    in32: 32,
    fl32: 32,
    fl64: 64
  };

  atom('moov.trak.mdia.minf.stbl.stsd', function() {
    var format, numEntries, version, _ref, _ref1;
    this.stream.advance(4);
    numEntries = this.stream.readUInt32();
    if (this.track.type !== 'soun') {
      return this.stream.advance(this.len - 8);
    }
    if (numEntries !== 1) {
      return this.emit('error', "Only expecting one entry in sample description atom!");
    }
    this.stream.advance(4);
    format = this.track.format = {};
    format.formatID = this.stream.readString(4);
    this.stream.advance(6);
    this.stream.advance(2);
    version = this.stream.readUInt16();
    this.stream.advance(6);
    format.channelsPerFrame = this.stream.readUInt16();
    format.bitsPerChannel = this.stream.readUInt16();
    this.stream.advance(4);
    format.sampleRate = this.stream.readUInt16();
    this.stream.advance(2);
    if (version === 1) {
      format.framesPerPacket = this.stream.readUInt32();
      this.stream.advance(4);
      format.bytesPerFrame = this.stream.readUInt32();
      this.stream.advance(4);
    } else if (version !== 0) {
      this.emit('error', 'Unknown version in stsd atom');
    }
    if (BITS_PER_CHANNEL[format.formatID] != null) {
      format.bitsPerChannel = BITS_PER_CHANNEL[format.formatID];
    }
    format.floatingPoint = (_ref = format.formatID) === 'fl32' || _ref === 'fl64';
    format.littleEndian = format.formatID === 'sowt' && format.bitsPerChannel > 8;
    if ((_ref1 = format.formatID) === 'twos' || _ref1 === 'sowt' || _ref1 === 'in24' || _ref1 === 'in32' || _ref1 === 'fl32' || _ref1 === 'fl64' || _ref1 === 'raw ' || _ref1 === 'NONE') {
      return format.formatID = 'lpcm';
    }
  });

  atom('moov.trak.mdia.minf.stbl.stsd.alac', function() {
    this.stream.advance(4);
    return this.track.cookie = this.stream.readBuffer(this.len - 4);
  });

  atom('moov.trak.mdia.minf.stbl.stsd.esds', function() {
    var offset;
    offset = this.stream.offset + this.len;
    this.track.cookie = M4ADemuxer.readEsds(this.stream);
    return this.stream.seek(offset);
  });

  atom('moov.trak.mdia.minf.stbl.stsd.wave.enda', function() {
    return this.track.format.littleEndian = !!this.stream.readUInt16();
  });

  M4ADemuxer.readDescrLen = function(stream) {
    var c, count, len;
    len = 0;
    count = 4;
    while (count--) {
      c = stream.readUInt8();
      len = (len << 7) | (c & 0x7f);
      if (!(c & 0x80)) {
        break;
      }
    }
    return len;
  };

  M4ADemuxer.readEsds = function(stream) {
    var codec_id, flags, len, tag;
    stream.advance(4);
    tag = stream.readUInt8();
    len = M4ADemuxer.readDescrLen(stream);
    if (tag === 0x03) {
      stream.advance(2);
      flags = stream.readUInt8();
      if (flags & 0x80) {
        stream.advance(2);
      }
      if (flags & 0x40) {
        stream.advance(stream.readUInt8());
      }
      if (flags & 0x20) {
        stream.advance(2);
      }
    } else {
      stream.advance(2);
    }
    tag = stream.readUInt8();
    len = M4ADemuxer.readDescrLen(stream);
    if (tag === 0x04) {
      codec_id = stream.readUInt8();
      stream.advance(1);
      stream.advance(3);
      stream.advance(4);
      stream.advance(4);
      tag = stream.readUInt8();
      len = M4ADemuxer.readDescrLen(stream);
      if (tag === 0x05) {
        return stream.readBuffer(len);
      }
    }
    return null;
  };

  atom('moov.trak.mdia.minf.stbl.stts', function() {
    var entries, i, _i;
    this.stream.advance(4);
    entries = this.stream.readUInt32();
    this.track.stts = [];
    for (i = _i = 0; _i < entries; i = _i += 1) {
      this.track.stts[i] = {
        count: this.stream.readUInt32(),
        duration: this.stream.readUInt32()
      };
    }
    return this.setupSeekPoints();
  });

  atom('moov.trak.mdia.minf.stbl.stsc', function() {
    var entries, i, _i;
    this.stream.advance(4);
    entries = this.stream.readUInt32();
    this.track.stsc = [];
    for (i = _i = 0; _i < entries; i = _i += 1) {
      this.track.stsc[i] = {
        first: this.stream.readUInt32(),
        count: this.stream.readUInt32(),
        id: this.stream.readUInt32()
      };
    }
    return this.setupSeekPoints();
  });

  atom('moov.trak.mdia.minf.stbl.stsz', function() {
    var entries, i, _i;
    this.stream.advance(4);
    this.track.sampleSize = this.stream.readUInt32();
    entries = this.stream.readUInt32();
    if (this.track.sampleSize === 0 && entries > 0) {
      this.track.sampleSizes = [];
      for (i = _i = 0; _i < entries; i = _i += 1) {
        this.track.sampleSizes[i] = this.stream.readUInt32();
      }
    }
    return this.setupSeekPoints();
  });

  atom('moov.trak.mdia.minf.stbl.stco', function() {
    var entries, i, _i;
    this.stream.advance(4);
    entries = this.stream.readUInt32();
    this.track.chunkOffsets = [];
    for (i = _i = 0; _i < entries; i = _i += 1) {
      this.track.chunkOffsets[i] = this.stream.readUInt32();
    }
    return this.setupSeekPoints();
  });

  atom('moov.trak.tref.chap', function() {
    var entries, i, _i;
    entries = this.len >> 2;
    this.track.chapterTracks = [];
    for (i = _i = 0; _i < entries; i = _i += 1) {
      this.track.chapterTracks[i] = this.stream.readUInt32();
    }
  });

  M4ADemuxer.prototype.setupSeekPoints = function() {
    var i, j, offset, position, sampleIndex, size, stscIndex, sttsIndex, sttsSample, timestamp, _i, _j, _len, _ref, _ref1, _results;
    if (!((this.track.chunkOffsets != null) && (this.track.stsc != null) && (this.track.sampleSize != null) && (this.track.stts != null))) {
      return;
    }
    stscIndex = 0;
    sttsIndex = 0;
    sttsIndex = 0;
    sttsSample = 0;
    sampleIndex = 0;
    offset = 0;
    timestamp = 0;
    this.track.seekPoints = [];
    _ref = this.track.chunkOffsets;
    _results = [];
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      position = _ref[i];
      for (j = _j = 0, _ref1 = this.track.stsc[stscIndex].count; _j < _ref1; j = _j += 1) {
        this.track.seekPoints.push({
          offset: offset,
          position: position,
          timestamp: timestamp
        });
        size = this.track.sampleSize || this.track.sampleSizes[sampleIndex++];
        offset += size;
        position += size;
        timestamp += this.track.stts[sttsIndex].duration;
        if (sttsIndex + 1 < this.track.stts.length && ++sttsSample === this.track.stts[sttsIndex].count) {
          sttsSample = 0;
          sttsIndex++;
        }
      }
      if (stscIndex + 1 < this.track.stsc.length && i + 1 === this.track.stsc[stscIndex + 1].first) {
        _results.push(stscIndex++);
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  after('moov', function() {
    var track, _i, _len, _ref;
    if (this.mdatOffset != null) {
      this.stream.seek(this.mdatOffset - 8);
    }
    _ref = this.tracks;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      track = _ref[_i];
      if (!(track.type === 'soun')) {
        continue;
      }
      this.track = track;
      break;
    }
    if (this.track.type !== 'soun') {
      this.track = null;
      return this.emit('error', 'No audio tracks in m4a file.');
    }
    this.emit('format', this.track.format);
    this.emit('duration', this.track.duration / this.track.timeScale * 1000 | 0);
    if (this.track.cookie) {
      this.emit('cookie', this.track.cookie);
    }
    return this.seekPoints = this.track.seekPoints;
  });

  atom('mdat', function() {
    var bytes, chunkSize, length, numSamples, offset, sample, size, _i;
    if (!this.startedData) {
      if (this.mdatOffset == null) {
        this.mdatOffset = this.stream.offset;
      }
      if (this.tracks.length === 0) {
        bytes = Math.min(this.stream.remainingBytes(), this.len);
        this.stream.advance(bytes);
        this.len -= bytes;
        return;
      }
      this.chunkIndex = 0;
      this.stscIndex = 0;
      this.sampleIndex = 0;
      this.tailOffset = 0;
      this.tailSamples = 0;
      this.startedData = true;
    }
    if (!this.readChapters) {
      this.readChapters = this.parseChapters();
      if (this["break"] = !this.readChapters) {
        return;
      }
      this.stream.seek(this.mdatOffset);
    }
    offset = this.track.chunkOffsets[this.chunkIndex] + this.tailOffset;
    length = 0;
    if (!this.stream.available(offset - this.stream.offset)) {
      this["break"] = true;
      return;
    }
    this.stream.seek(offset);
    while (this.chunkIndex < this.track.chunkOffsets.length) {
      numSamples = this.track.stsc[this.stscIndex].count - this.tailSamples;
      chunkSize = 0;
      for (sample = _i = 0; _i < numSamples; sample = _i += 1) {
        size = this.track.sampleSize || this.track.sampleSizes[this.sampleIndex];
        if (!this.stream.available(length + size)) {
          break;
        }
        length += size;
        chunkSize += size;
        this.sampleIndex++;
      }
      if (sample < numSamples) {
        this.tailOffset += chunkSize;
        this.tailSamples += sample;
        break;
      } else {
        this.chunkIndex++;
        this.tailOffset = 0;
        this.tailSamples = 0;
        if (this.stscIndex + 1 < this.track.stsc.length && this.chunkIndex + 1 === this.track.stsc[this.stscIndex + 1].first) {
          this.stscIndex++;
        }
        if (offset + length !== this.track.chunkOffsets[this.chunkIndex]) {
          break;
        }
      }
    }
    if (length > 0) {
      this.emit('data', this.stream.readBuffer(length));
      return this["break"] = this.chunkIndex === this.track.chunkOffsets.length;
    } else {
      return this["break"] = true;
    }
  });

  M4ADemuxer.prototype.parseChapters = function() {
    var bom, id, len, nextTimestamp, point, title, track, _i, _len, _ref, _ref1, _ref2, _ref3;
    if (!(((_ref = this.track.chapterTracks) != null ? _ref.length : void 0) > 0)) {
      return true;
    }
    id = this.track.chapterTracks[0];
    _ref1 = this.tracks;
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      track = _ref1[_i];
      if (track.id === id) {
        break;
      }
    }
    if (track.id !== id) {
      this.emit('error', 'Chapter track does not exist.');
    }
    if (this.chapters == null) {
      this.chapters = [];
    }
    while (this.chapters.length < track.seekPoints.length) {
      point = track.seekPoints[this.chapters.length];
      if (!this.stream.available(point.position - this.stream.offset + 32)) {
        return false;
      }
      this.stream.seek(point.position);
      len = this.stream.readUInt16();
      title = null;
      if (!this.stream.available(len)) {
        return false;
      }
      if (len > 2) {
        bom = this.stream.peekUInt16();
        if (bom === 0xfeff || bom === 0xfffe) {
          title = this.stream.readString(len, 'utf16-bom');
        }
      }
      if (title == null) {
        title = this.stream.readString(len, 'utf8');
      }
      nextTimestamp = (_ref2 = (_ref3 = track.seekPoints[this.chapters.length + 1]) != null ? _ref3.timestamp : void 0) != null ? _ref2 : track.duration;
      this.chapters.push({
        title: title,
        timestamp: point.timestamp / track.timeScale * 1000 | 0,
        duration: (nextTimestamp - point.timestamp) / track.timeScale * 1000 | 0
      });
    }
    this.emit('chapters', this.chapters);
    return true;
  };

  atom('moov.udta.meta', function() {
    this.metadata = {};
    return this.stream.advance(4);
  });

  after('moov.udta.meta', function() {
    return this.emit('metadata', this.metadata);
  });

  meta = function(field, name, fn) {
    return atom("moov.udta.meta.ilst." + field + ".data", function() {
      this.stream.advance(8);
      this.len -= 8;
      return fn.call(this, name);
    });
  };

  string = function(field) {
    return this.metadata[field] = this.stream.readString(this.len, 'utf8');
  };

  meta('©alb', 'album', string);

  meta('©arg', 'arranger', string);

  meta('©art', 'artist', string);

  meta('©ART', 'artist', string);

  meta('aART', 'albumArtist', string);

  meta('catg', 'category', string);

  meta('©com', 'composer', string);

  meta('©cpy', 'copyright', string);

  meta('cprt', 'copyright', string);

  meta('©cmt', 'comments', string);

  meta('©day', 'releaseDate', string);

  meta('desc', 'description', string);

  meta('©gen', 'genre', string);

  meta('©grp', 'grouping', string);

  meta('©isr', 'ISRC', string);

  meta('keyw', 'keywords', string);

  meta('©lab', 'recordLabel', string);

  meta('ldes', 'longDescription', string);

  meta('©lyr', 'lyrics', string);

  meta('©nam', 'title', string);

  meta('©phg', 'recordingCopyright', string);

  meta('©prd', 'producer', string);

  meta('©prf', 'performers', string);

  meta('purd', 'purchaseDate', string);

  meta('purl', 'podcastURL', string);

  meta('©swf', 'songwriter', string);

  meta('©too', 'encoder', string);

  meta('©wrt', 'composer', string);

  meta('covr', 'coverArt', function(field) {
    return this.metadata[field] = this.stream.readBuffer(this.len);
  });

  genres = ["Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop", "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae", "Rock", "Techno", "Industrial", "Alternative", "Ska", "Death Metal", "Pranks", "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk", "Fusion", "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip", "Gospel", "Noise", "AlternRock", "Bass", "Soul", "Punk", "Space", "Meditative", "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic", "Darkwave", "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream", "Southern Rock", "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk", "Jungle", "Native American", "Cabaret", "New Wave", "Psychadelic", "Rave", "Showtunes", "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll", "Hard Rock", "Folk", "Folk/Rock", "National Folk", "Swing", "Fast Fusion", "Bebob", "Latin", "Revival", "Celtic", "Bluegrass", "Avantgarde", "Gothic Rock", "Progressive Rock", "Psychedelic Rock", "Symphonic Rock", "Slow Rock", "Big Band", "Chorus", "Easy Listening", "Acoustic", "Humour", "Speech", "Chanson", "Opera", "Chamber Music", "Sonata", "Symphony", "Booty Bass", "Primus", "Porn Groove", "Satire", "Slow Jam", "Club", "Tango", "Samba", "Folklore", "Ballad", "Power Ballad", "Rhythmic Soul", "Freestyle", "Duet", "Punk Rock", "Drum Solo", "A Capella", "Euro-House", "Dance Hall"];

  meta('gnre', 'genre', function(field) {
    return this.metadata[field] = genres[this.stream.readUInt16() - 1];
  });

  meta('tmpo', 'tempo', function(field) {
    return this.metadata[field] = this.stream.readUInt16();
  });

  meta('rtng', 'rating', function(field) {
    var rating;
    rating = this.stream.readUInt8();
    return this.metadata[field] = rating === 2 ? 'Clean' : rating !== 0 ? 'Explicit' : 'None';
  });

  diskTrack = function(field) {
    this.stream.advance(2);
    this.metadata[field] = this.stream.readUInt16() + ' of ' + this.stream.readUInt16();
    return this.stream.advance(this.len - 6);
  };

  meta('disk', 'diskNumber', diskTrack);

  meta('trkn', 'trackNumber', diskTrack);

  bool = function(field) {
    return this.metadata[field] = this.stream.readUInt8() === 1;
  };

  meta('cpil', 'compilation', bool);

  meta('pcst', 'podcast', bool);

  meta('pgap', 'gapless', bool);

  return M4ADemuxer;

})(Demuxer);

module.exports = M4ADemuxer;


},{"../demuxer":26}],32:[function(_dereq_,module,exports){
var Demuxer, WAVEDemuxer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Demuxer = _dereq_('../demuxer');

WAVEDemuxer = (function(_super) {
  var formats;

  __extends(WAVEDemuxer, _super);

  function WAVEDemuxer() {
    return WAVEDemuxer.__super__.constructor.apply(this, arguments);
  }

  Demuxer.register(WAVEDemuxer);

  WAVEDemuxer.probe = function(buffer) {
    return buffer.peekString(0, 4) === 'RIFF' && buffer.peekString(8, 4) === 'WAVE';
  };

  formats = {
    0x0001: 'lpcm',
    0x0003: 'lpcm',
    0x0006: 'alaw',
    0x0007: 'ulaw'
  };

  WAVEDemuxer.prototype.readChunk = function() {
    var buffer, bytes, encoding;
    if (!this.readStart && this.stream.available(12)) {
      if (this.stream.readString(4) !== 'RIFF') {
        return this.emit('error', 'Invalid WAV file.');
      }
      this.fileSize = this.stream.readUInt32(true);
      this.readStart = true;
      if (this.stream.readString(4) !== 'WAVE') {
        return this.emit('error', 'Invalid WAV file.');
      }
    }
    while (this.stream.available(1)) {
      if (!this.readHeaders && this.stream.available(8)) {
        this.type = this.stream.readString(4);
        this.len = this.stream.readUInt32(true);
      }
      switch (this.type) {
        case 'fmt ':
          encoding = this.stream.readUInt16(true);
          if (!(encoding in formats)) {
            return this.emit('error', 'Unsupported format in WAV file.');
          }
          this.format = {
            formatID: formats[encoding],
            floatingPoint: encoding === 0x0003,
            littleEndian: formats[encoding] === 'lpcm',
            channelsPerFrame: this.stream.readUInt16(true),
            sampleRate: this.stream.readUInt32(true),
            framesPerPacket: 1
          };
          this.stream.advance(4);
          this.stream.advance(2);
          this.format.bitsPerChannel = this.stream.readUInt16(true);
          this.format.bytesPerPacket = (this.format.bitsPerChannel / 8) * this.format.channelsPerFrame;
          this.emit('format', this.format);
          this.stream.advance(this.len - 16);
          break;
        case 'data':
          if (!this.sentDuration) {
            bytes = this.format.bitsPerChannel / 8;
            this.emit('duration', this.len / bytes / this.format.channelsPerFrame / this.format.sampleRate * 1000 | 0);
            this.sentDuration = true;
          }
          buffer = this.stream.readSingleBuffer(this.len);
          this.len -= buffer.length;
          this.readHeaders = this.len > 0;
          this.emit('data', buffer);
          break;
        default:
          if (!this.stream.available(this.len)) {
            return;
          }
          this.stream.advance(this.len);
      }
      if (this.type !== 'data') {
        this.readHeaders = false;
      }
    }
  };

  return WAVEDemuxer;

})(Demuxer);


},{"../demuxer":26}],33:[function(_dereq_,module,exports){
var AudioDevice, EventEmitter,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('./core/events');

AudioDevice = (function(_super) {
  var devices;

  __extends(AudioDevice, _super);

  function AudioDevice(sampleRate, channels) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.updateTime = __bind(this.updateTime, this);
    this.playing = false;
    this.currentTime = 0;
    this._lastTime = 0;
  }

  AudioDevice.prototype.start = function() {
    if (this.playing) {
      return;
    }
    this.playing = true;
    if (this.device == null) {
      this.device = AudioDevice.create(this.sampleRate, this.channels);
    }
    if (!this.device) {
      throw new Error("No supported audio device found.");
    }
    this._lastTime = this.device.getDeviceTime();
    this._timer = setInterval(this.updateTime, 200);
    return this.device.on('refill', this.refill = (function(_this) {
      return function(buffer) {
        return _this.emit('refill', buffer);
      };
    })(this));
  };

  AudioDevice.prototype.stop = function() {
    if (!this.playing) {
      return;
    }
    this.playing = false;
    this.device.off('refill', this.refill);
    return clearInterval(this._timer);
  };

  AudioDevice.prototype.destroy = function() {
    this.stop();
    return this.device.destroy();
  };

  AudioDevice.prototype.seek = function(currentTime) {
    this.currentTime = currentTime;
    if (this.playing) {
      this._lastTime = this.device.getDeviceTime();
    }
    return this.emit('timeUpdate', this.currentTime);
  };

  AudioDevice.prototype.updateTime = function() {
    var time;
    time = this.device.getDeviceTime();
    this.currentTime += (time - this._lastTime) / this.device.sampleRate * 1000 | 0;
    this._lastTime = time;
    return this.emit('timeUpdate', this.currentTime);
  };

  devices = [];

  AudioDevice.register = function(device) {
    return devices.push(device);
  };

  AudioDevice.create = function(sampleRate, channels) {
    var device, _i, _len;
    for (_i = 0, _len = devices.length; _i < _len; _i++) {
      device = devices[_i];
      if (device.supported) {
        return new device(sampleRate, channels);
      }
    }
    return null;
  };

  return AudioDevice;

})(EventEmitter);

module.exports = AudioDevice;


},{"./core/events":9}],34:[function(_dereq_,module,exports){
var AVBuffer, AudioDevice, EventEmitter, MozillaAudioDevice,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('../core/events');

AudioDevice = _dereq_('../device');

AVBuffer = _dereq_('../core/buffer');

MozillaAudioDevice = (function(_super) {
  var createTimer, destroyTimer;

  __extends(MozillaAudioDevice, _super);

  AudioDevice.register(MozillaAudioDevice);

  MozillaAudioDevice.supported = (typeof Audio !== "undefined" && Audio !== null) && 'mozWriteAudio' in new Audio;

  function MozillaAudioDevice(sampleRate, channels) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.refill = __bind(this.refill, this);
    this.audio = new Audio;
    this.audio.mozSetup(this.channels, this.sampleRate);
    this.writePosition = 0;
    this.prebufferSize = this.sampleRate / 2;
    this.tail = null;
    this.timer = createTimer(this.refill, 100);
  }

  MozillaAudioDevice.prototype.refill = function() {
    var available, buffer, currentPosition, written;
    if (this.tail) {
      written = this.audio.mozWriteAudio(this.tail);
      this.writePosition += written;
      if (this.writePosition < this.tail.length) {
        this.tail = this.tail.subarray(written);
      } else {
        this.tail = null;
      }
    }
    currentPosition = this.audio.mozCurrentSampleOffset();
    available = currentPosition + this.prebufferSize - this.writePosition;
    if (available > 0) {
      buffer = new Float32Array(available);
      this.emit('refill', buffer);
      written = this.audio.mozWriteAudio(buffer);
      if (written < buffer.length) {
        this.tail = buffer.subarray(written);
      }
      this.writePosition += written;
    }
  };

  MozillaAudioDevice.prototype.destroy = function() {
    return destroyTimer(this.timer);
  };

  MozillaAudioDevice.prototype.getDeviceTime = function() {
    return this.audio.mozCurrentSampleOffset() / this.channels;
  };

  createTimer = function(fn, interval) {
    var url, worker;
    url = AVBuffer.makeBlobURL("setInterval(function() { postMessage('ping'); }, " + interval + ");");
    if (url == null) {
      return setInterval(fn, interval);
    }
    worker = new Worker(url);
    worker.onmessage = fn;
    worker.url = url;
    return worker;
  };

  destroyTimer = function(timer) {
    if (timer.terminate) {
      timer.terminate();
      return URL.revokeObjectURL(timer.url);
    } else {
      return clearInterval(timer);
    }
  };

  return MozillaAudioDevice;

})(EventEmitter);


},{"../core/buffer":7,"../core/events":9,"../device":33}],35:[function(_dereq_,module,exports){
/*
 * This resampler is from XAudioJS: https://github.com/grantgalitz/XAudioJS
 * Planned to be replaced with src.js, eventually: https://github.com/jussi-kalliokoski/src.js
 */

//JavaScript Audio Resampler (c) 2011 - Grant Galitz
function Resampler(fromSampleRate, toSampleRate, channels, outputBufferSize, noReturn) {
	this.fromSampleRate = fromSampleRate;
	this.toSampleRate = toSampleRate;
	this.channels = channels | 0;
	this.outputBufferSize = outputBufferSize;
	this.noReturn = !!noReturn;
	this.initialize();
}

Resampler.prototype.initialize = function () {
	//Perform some checks:
	if (this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0) {
		if (this.fromSampleRate == this.toSampleRate) {
			//Setup a resampler bypass:
			this.resampler = this.bypassResampler;		//Resampler just returns what was passed through.
			this.ratioWeight = 1;
		}
		else {
			if (this.fromSampleRate < this.toSampleRate) {
				/*
					Use generic linear interpolation if upsampling,
					as linear interpolation produces a gradient that we want
					and works fine with two input sample points per output in this case.
				*/
				this.compileLinearInterpolationFunction();
				this.lastWeight = 1;
			}
			else {
				/*
					Custom resampler I wrote that doesn't skip samples
					like standard linear interpolation in high downsampling.
					This is more accurate than linear interpolation on downsampling.
				*/
				this.compileMultiTapFunction();
				this.tailExists = false;
				this.lastWeight = 0;
			}
			this.ratioWeight = this.fromSampleRate / this.toSampleRate;
			this.initializeBuffers();
		}
	}
	else {
		throw(new Error("Invalid settings specified for the resampler."));
	}
};

Resampler.prototype.compileLinearInterpolationFunction = function () {
	var toCompile = "var bufferLength = buffer.length;\
	var outLength = this.outputBufferSize;\
	if ((bufferLength % " + this.channels + ") == 0) {\
		if (bufferLength > 0) {\
			var ratioWeight = this.ratioWeight;\
			var weight = this.lastWeight;\
			var firstWeight = 0;\
			var secondWeight = 0;\
			var sourceOffset = 0;\
			var outputOffset = 0;\
			var outputBuffer = this.outputBuffer;\
			for (; weight < 1; weight += ratioWeight) {\
				secondWeight = weight % 1;\
				firstWeight = 1 - secondWeight;";
	for (var channel = 0; channel < this.channels; ++channel) {
		toCompile += "outputBuffer[outputOffset++] = (this.lastOutput[" + channel + "] * firstWeight) + (buffer[" + channel + "] * secondWeight);";
	}
	toCompile += "}\
			weight -= 1;\
			for (bufferLength -= " + this.channels + ", sourceOffset = Math.floor(weight) * " + this.channels + "; outputOffset < outLength && sourceOffset < bufferLength;) {\
				secondWeight = weight % 1;\
				firstWeight = 1 - secondWeight;";
	for (var channel = 0; channel < this.channels; ++channel) {
		toCompile += "outputBuffer[outputOffset++] = (buffer[sourceOffset" + ((channel > 0) ? (" + " + channel) : "") + "] * firstWeight) + (buffer[sourceOffset + " + (this.channels + channel) + "] * secondWeight);";
	}
	toCompile += "weight += ratioWeight;\
				sourceOffset = Math.floor(weight) * " + this.channels + ";\
			}";
	for (var channel = 0; channel < this.channels; ++channel) {
		toCompile += "this.lastOutput[" + channel + "] = buffer[sourceOffset++];";
	}
	toCompile += "this.lastWeight = weight % 1;\
			return this.bufferSlice(outputOffset);\
		}\
		else {\
			return (this.noReturn) ? 0 : [];\
		}\
	}\
	else {\
		throw(new Error(\"Buffer was of incorrect sample length.\"));\
	}";
	this.resampler = Function("buffer", toCompile);
};

Resampler.prototype.compileMultiTapFunction = function () {
	var toCompile = "var bufferLength = buffer.length;\
	var outLength = this.outputBufferSize;\
	if ((bufferLength % " + this.channels + ") == 0) {\
		if (bufferLength > 0) {\
			var ratioWeight = this.ratioWeight;\
			var weight = 0;";
	for (var channel = 0; channel < this.channels; ++channel) {
		toCompile += "var output" + channel + " = 0;"
	}
	toCompile += "var actualPosition = 0;\
			var amountToNext = 0;\
			var alreadyProcessedTail = !this.tailExists;\
			this.tailExists = false;\
			var outputBuffer = this.outputBuffer;\
			var outputOffset = 0;\
			var currentPosition = 0;\
			do {\
				if (alreadyProcessedTail) {\
					weight = ratioWeight;";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " = 0;"
	}
	toCompile += "}\
				else {\
					weight = this.lastWeight;";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " = this.lastOutput[" + channel + "];"
	}
	toCompile += "alreadyProcessedTail = true;\
				}\
				while (weight > 0 && actualPosition < bufferLength) {\
					amountToNext = 1 + actualPosition - currentPosition;\
					if (weight >= amountToNext) {";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " += buffer[actualPosition++] * amountToNext;"
	}
	toCompile += "currentPosition = actualPosition;\
						weight -= amountToNext;\
					}\
					else {";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " += buffer[actualPosition" + ((channel > 0) ? (" + " + channel) : "") + "] * weight;"
	}
	toCompile += "currentPosition += weight;\
						weight = 0;\
						break;\
					}\
				}\
				if (weight == 0) {";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "outputBuffer[outputOffset++] = output" + channel + " / ratioWeight;"
	}
	toCompile += "}\
				else {\
					this.lastWeight = weight;";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "this.lastOutput[" + channel + "] = output" + channel + ";"
	}
	toCompile += "this.tailExists = true;\
					break;\
				}\
			} while (actualPosition < bufferLength && outputOffset < outLength);\
			return this.bufferSlice(outputOffset);\
		}\
		else {\
			return (this.noReturn) ? 0 : [];\
		}\
	}\
	else {\
		throw(new Error(\"Buffer was of incorrect sample length.\"));\
	}";
	this.resampler = Function("buffer", toCompile);
};

Resampler.prototype.bypassResampler = function (buffer) {
	if (this.noReturn) {
		//Set the buffer passed as our own, as we don't need to resample it:
		this.outputBuffer = buffer;
		return buffer.length;
	}
	else {
		//Just return the buffer passsed:
		return buffer;
	}
};

Resampler.prototype.bufferSlice = function (sliceAmount) {
	if (this.noReturn) {
		//If we're going to access the properties directly from this object:
		return sliceAmount;
	}
	else {
		//Typed array and normal array buffer section referencing:
		try {
			return this.outputBuffer.subarray(0, sliceAmount);
		}
		catch (error) {
			try {
				//Regular array pass:
				this.outputBuffer.length = sliceAmount;
				return this.outputBuffer;
			}
			catch (error) {
				//Nightly Firefox 4 used to have the subarray function named as slice:
				return this.outputBuffer.slice(0, sliceAmount);
			}
		}
	}
};

Resampler.prototype.initializeBuffers = function () {
	//Initialize the internal buffer:
	try {
		this.outputBuffer = new Float32Array(this.outputBufferSize);
		this.lastOutput = new Float32Array(this.channels);
	}
	catch (error) {
		this.outputBuffer = [];
		this.lastOutput = [];
	}
};

module.exports = Resampler;

},{}],36:[function(_dereq_,module,exports){
(function (global){
var AudioDevice, EventEmitter, Resampler, WebAudioDevice,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('../core/events');

AudioDevice = _dereq_('../device');

Resampler = _dereq_('./resampler');

WebAudioDevice = (function(_super) {
  var AudioContext, createProcessor, sharedContext;

  __extends(WebAudioDevice, _super);

  AudioDevice.register(WebAudioDevice);

  AudioContext = global.AudioContext || global.webkitAudioContext;

  WebAudioDevice.supported = AudioContext && (typeof AudioContext.prototype[createProcessor = 'createScriptProcessor'] === 'function' || typeof AudioContext.prototype[createProcessor = 'createJavaScriptNode'] === 'function');

  sharedContext = null;

  function WebAudioDevice(sampleRate, channels) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.refill = __bind(this.refill, this);
    this.context = sharedContext != null ? sharedContext : sharedContext = new AudioContext;
    this.deviceSampleRate = this.context.sampleRate;
    this.bufferSize = Math.ceil(4096 / (this.deviceSampleRate / this.sampleRate) * this.channels);
    this.bufferSize += this.bufferSize % this.channels;
    if (this.deviceSampleRate !== this.sampleRate) {
      this.resampler = new Resampler(this.sampleRate, this.deviceSampleRate, this.channels, 4096 * this.channels);
    }
    this.node = this.context[createProcessor](4096, this.channels, this.channels);
    this.node.onaudioprocess = this.refill;
    this.node.connect(this.context.destination);
  }

  WebAudioDevice.prototype.refill = function(event) {
    var channelCount, channels, data, i, n, outputBuffer, _i, _j, _k, _ref;
    outputBuffer = event.outputBuffer;
    channelCount = outputBuffer.numberOfChannels;
    channels = new Array(channelCount);
    for (i = _i = 0; _i < channelCount; i = _i += 1) {
      channels[i] = outputBuffer.getChannelData(i);
    }
    data = new Float32Array(this.bufferSize);
    this.emit('refill', data);
    if (this.resampler) {
      data = this.resampler.resampler(data);
    }
    for (i = _j = 0, _ref = outputBuffer.length; _j < _ref; i = _j += 1) {
      for (n = _k = 0; _k < channelCount; n = _k += 1) {
        channels[n][i] = data[i * channelCount + n];
      }
    }
  };

  WebAudioDevice.prototype.destroy = function() {
    return this.node.disconnect(0);
  };

  WebAudioDevice.prototype.getDeviceTime = function() {
    return this.context.currentTime * this.sampleRate;
  };

  return WebAudioDevice;

})(EventEmitter);


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../core/events":9,"../device":33,"./resampler":35}],37:[function(_dereq_,module,exports){
var Filter;

Filter = (function() {
  function Filter(context, key) {
    if (context && key) {
      Object.defineProperty(this, 'value', {
        get: function() {
          return context[key];
        }
      });
    }
  }

  Filter.prototype.process = function(buffer) {};

  return Filter;

})();

module.exports = Filter;


},{}],38:[function(_dereq_,module,exports){
var BalanceFilter, Filter,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Filter = _dereq_('../filter');

BalanceFilter = (function(_super) {
  __extends(BalanceFilter, _super);

  function BalanceFilter() {
    return BalanceFilter.__super__.constructor.apply(this, arguments);
  }

  BalanceFilter.prototype.process = function(buffer) {
    var i, pan, _i, _ref;
    if (this.value === 0) {
      return;
    }
    pan = Math.max(-50, Math.min(50, this.value));
    for (i = _i = 0, _ref = buffer.length; _i < _ref; i = _i += 2) {
      buffer[i] *= Math.min(1, (50 - pan) / 50);
      buffer[i + 1] *= Math.min(1, (50 + pan) / 50);
    }
  };

  return BalanceFilter;

})(Filter);

module.exports = BalanceFilter;


},{"../filter":37}],39:[function(_dereq_,module,exports){
var Filter, VolumeFilter,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Filter = _dereq_('../filter');

VolumeFilter = (function(_super) {
  __extends(VolumeFilter, _super);

  function VolumeFilter() {
    return VolumeFilter.__super__.constructor.apply(this, arguments);
  }

  VolumeFilter.prototype.process = function(buffer) {
    var i, vol, _i, _ref;
    if (this.value >= 100) {
      return;
    }
    vol = Math.max(0, Math.min(100, this.value)) / 100;
    for (i = _i = 0, _ref = buffer.length; _i < _ref; i = _i += 1) {
      buffer[i] *= vol;
    }
  };

  return VolumeFilter;

})(Filter);

module.exports = VolumeFilter;


},{"../filter":37}],40:[function(_dereq_,module,exports){
var Asset, AudioDevice, BalanceFilter, EventEmitter, Player, Queue, VolumeFilter,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('./core/events');

Asset = _dereq_('./asset');

VolumeFilter = _dereq_('./filters/volume');

BalanceFilter = _dereq_('./filters/balance');

Queue = _dereq_('./queue');

AudioDevice = _dereq_('./device');

Player = (function(_super) {
  __extends(Player, _super);

  function Player(asset) {
    this.asset = asset;
    this.startPlaying = __bind(this.startPlaying, this);
    this.playing = false;
    this.buffered = 0;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 100;
    this.pan = 0;
    this.metadata = {};
    this.filters = [new VolumeFilter(this, 'volume'), new BalanceFilter(this, 'pan')];
    this.asset.on('buffer', (function(_this) {
      return function(buffered) {
        _this.buffered = buffered;
        return _this.emit('buffer', _this.buffered);
      };
    })(this));
    this.asset.on('decodeStart', (function(_this) {
      return function() {
        _this.queue = new Queue(_this.asset);
        return _this.queue.once('ready', _this.startPlaying);
      };
    })(this));
    this.asset.on('format', (function(_this) {
      return function(format) {
        _this.format = format;
        return _this.emit('format', _this.format);
      };
    })(this));
    this.asset.on('metadata', (function(_this) {
      return function(metadata) {
        _this.metadata = metadata;
        return _this.emit('metadata', _this.metadata);
      };
    })(this));
    this.asset.on('duration', (function(_this) {
      return function(duration) {
        _this.duration = duration;
        return _this.emit('duration', _this.duration);
      };
    })(this));
    this.asset.on('error', (function(_this) {
      return function(error) {
        return _this.emit('error', error);
      };
    })(this));
  }

  Player.fromURL = function(url) {
    return new Player(Asset.fromURL(url));
  };

  Player.fromFile = function(file) {
    return new Player(Asset.fromFile(file));
  };

  Player.fromBuffer = function(buffer) {
    return new Player(Asset.fromBuffer(buffer));
  };

  Player.prototype.preload = function() {
    if (!this.asset) {
      return;
    }
    this.startedPreloading = true;
    return this.asset.start(false);
  };

  Player.prototype.play = function() {
    var _ref;
    if (this.playing) {
      return;
    }
    if (!this.startedPreloading) {
      this.preload();
    }
    this.playing = true;
    return (_ref = this.device) != null ? _ref.start() : void 0;
  };

  Player.prototype.pause = function() {
    var _ref;
    if (!this.playing) {
      return;
    }
    this.playing = false;
    return (_ref = this.device) != null ? _ref.stop() : void 0;
  };

  Player.prototype.togglePlayback = function() {
    if (this.playing) {
      return this.pause();
    } else {
      return this.play();
    }
  };

  Player.prototype.stop = function() {
    var _ref;
    this.pause();
    this.asset.stop();
    return (_ref = this.device) != null ? _ref.destroy() : void 0;
  };

  Player.prototype.seek = function(timestamp) {
    var _ref;
    if ((_ref = this.device) != null) {
      _ref.stop();
    }
    this.queue.once('ready', (function(_this) {
      return function() {
        var _ref1, _ref2;
        if ((_ref1 = _this.device) != null) {
          _ref1.seek(_this.currentTime);
        }
        if (_this.playing) {
          return (_ref2 = _this.device) != null ? _ref2.start() : void 0;
        }
      };
    })(this));
    timestamp = (timestamp / 1000) * this.format.sampleRate;
    timestamp = this.asset.decoder.seek(timestamp);
    this.currentTime = timestamp / this.format.sampleRate * 1000 | 0;
    this.queue.reset();
    return this.currentTime;
  };

  Player.prototype.startPlaying = function() {
    var frame, frameOffset;
    frame = this.queue.read();
    frameOffset = 0;
    this.device = new AudioDevice(this.format.sampleRate, this.format.channelsPerFrame);
    this.device.on('timeUpdate', (function(_this) {
      return function(currentTime) {
        _this.currentTime = currentTime;
        return _this.emit('progress', _this.currentTime);
      };
    })(this));
    this.refill = (function(_this) {
      return function(buffer) {
        var bufferOffset, filter, i, max, _i, _j, _len, _ref;
        if (!_this.playing) {
          return;
        }
        if (!frame) {
          frame = _this.queue.read();
          frameOffset = 0;
        }
        bufferOffset = 0;
        while (frame && bufferOffset < buffer.length) {
          max = Math.min(frame.length - frameOffset, buffer.length - bufferOffset);
          for (i = _i = 0; _i < max; i = _i += 1) {
            buffer[bufferOffset++] = frame[frameOffset++];
          }
          if (frameOffset === frame.length) {
            frame = _this.queue.read();
            frameOffset = 0;
          }
        }
        _ref = _this.filters;
        for (_j = 0, _len = _ref.length; _j < _len; _j++) {
          filter = _ref[_j];
          filter.process(buffer);
        }
        if (!frame) {
          if (_this.queue.ended) {
            _this.currentTime = _this.duration;
            _this.emit('progress', _this.currentTime);
            _this.emit('end');
            _this.stop();
          } else {
            _this.device.stop();
          }
        }
      };
    })(this);
    this.device.on('refill', this.refill);
    if (this.playing) {
      this.device.start();
    }
    return this.emit('ready');
  };

  return Player;

})(EventEmitter);

module.exports = Player;


},{"./asset":2,"./core/events":9,"./device":33,"./filters/balance":38,"./filters/volume":39,"./queue":41}],41:[function(_dereq_,module,exports){
var EventEmitter, Queue,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('./core/events');

Queue = (function(_super) {
  __extends(Queue, _super);

  function Queue(asset) {
    this.asset = asset;
    this.write = __bind(this.write, this);
    this.readyMark = 64;
    this.finished = false;
    this.buffering = true;
    this.ended = false;
    this.buffers = [];
    this.asset.on('data', this.write);
    this.asset.on('end', (function(_this) {
      return function() {
        return _this.ended = true;
      };
    })(this));
    this.asset.decodePacket();
  }

  Queue.prototype.write = function(buffer) {
    if (buffer) {
      this.buffers.push(buffer);
    }
    if (this.buffering) {
      if (this.buffers.length >= this.readyMark || this.ended) {
        this.buffering = false;
        return this.emit('ready');
      } else {
        return this.asset.decodePacket();
      }
    }
  };

  Queue.prototype.read = function() {
    if (this.buffers.length === 0) {
      return null;
    }
    this.asset.decodePacket();
    return this.buffers.shift();
  };

  Queue.prototype.reset = function() {
    this.buffers.length = 0;
    this.buffering = true;
    return this.asset.decodePacket();
  };

  return Queue;

})(EventEmitter);

module.exports = Queue;


},{"./core/events":9}],42:[function(_dereq_,module,exports){
var AVBuffer, EventEmitter, FileSource,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('../../core/events');

AVBuffer = _dereq_('../../core/buffer');

FileSource = (function(_super) {
  __extends(FileSource, _super);

  function FileSource(file) {
    this.file = file;
    if (typeof FileReader === "undefined" || FileReader === null) {
      return this.emit('error', 'This browser does not have FileReader support.');
    }
    this.offset = 0;
    this.length = this.file.size;
    this.chunkSize = 1 << 20;
    this.file[this.slice = 'slice'] || this.file[this.slice = 'webkitSlice'] || this.file[this.slice = 'mozSlice'];
  }

  FileSource.prototype.start = function() {
    if (this.reader) {
      if (!this.active) {
        return this.loop();
      }
    }
    this.reader = new FileReader;
    this.active = true;
    this.reader.onload = (function(_this) {
      return function(e) {
        var buf;
        buf = new AVBuffer(new Uint8Array(e.target.result));
        _this.offset += buf.length;
        _this.emit('data', buf);
        _this.active = false;
        if (_this.offset < _this.length) {
          return _this.loop();
        }
      };
    })(this);
    this.reader.onloadend = (function(_this) {
      return function() {
        if (_this.offset === _this.length) {
          _this.emit('end');
          return _this.reader = null;
        }
      };
    })(this);
    this.reader.onerror = (function(_this) {
      return function(e) {
        return _this.emit('error', e);
      };
    })(this);
    this.reader.onprogress = (function(_this) {
      return function(e) {
        return _this.emit('progress', (_this.offset + e.loaded) / _this.length * 100);
      };
    })(this);
    return this.loop();
  };

  FileSource.prototype.loop = function() {
    var blob, endPos;
    this.active = true;
    endPos = Math.min(this.offset + this.chunkSize, this.length);
    blob = this.file[this.slice](this.offset, endPos);
    return this.reader.readAsArrayBuffer(blob);
  };

  FileSource.prototype.pause = function() {
    var _ref;
    this.active = false;
    try {
      return (_ref = this.reader) != null ? _ref.abort() : void 0;
    } catch (_error) {}
  };

  FileSource.prototype.reset = function() {
    this.pause();
    return this.offset = 0;
  };

  return FileSource;

})(EventEmitter);

module.exports = FileSource;


},{"../../core/buffer":7,"../../core/events":9}],43:[function(_dereq_,module,exports){
var AVBuffer, EventEmitter, HTTPSource,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('../../core/events');

AVBuffer = _dereq_('../../core/buffer');

HTTPSource = (function(_super) {
  __extends(HTTPSource, _super);

  function HTTPSource(url) {
    this.url = url;
    this.chunkSize = 1 << 20;
    this.inflight = false;
    this.reset();
  }

  HTTPSource.prototype.start = function() {
    if (this.length) {
      if (!this.inflight) {
        return this.loop();
      }
    }
    this.inflight = true;
    this.xhr = new XMLHttpRequest();
    this.xhr.onload = (function(_this) {
      return function(event) {
        _this.length = parseInt(_this.xhr.getResponseHeader("Content-Length"));
        _this.inflight = false;
        return _this.loop();
      };
    })(this);
    this.xhr.onerror = (function(_this) {
      return function(err) {
        _this.pause();
        return _this.emit('error', err);
      };
    })(this);
    this.xhr.onabort = (function(_this) {
      return function(event) {
        return _this.inflight = false;
      };
    })(this);
    this.xhr.open("HEAD", this.url, true);
    return this.xhr.send(null);
  };

  HTTPSource.prototype.loop = function() {
    var endPos;
    if (this.inflight || !this.length) {
      return this.emit('error', 'Something is wrong in HTTPSource.loop');
    }
    this.inflight = true;
    this.xhr = new XMLHttpRequest();
    this.xhr.onload = (function(_this) {
      return function(event) {
        var buf, buffer, i, txt, _i, _ref;
        if (_this.xhr.response) {
          buf = new Uint8Array(_this.xhr.response);
        } else {
          txt = _this.xhr.responseText;
          buf = new Uint8Array(txt.length);
          for (i = _i = 0, _ref = txt.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            buf[i] = txt.charCodeAt(i) & 0xff;
          }
        }
        buffer = new AVBuffer(buf);
        _this.offset += buffer.length;
        _this.emit('data', buffer);
        if (_this.offset >= _this.length) {
          _this.emit('end');
        }
        _this.inflight = false;
        if (!(_this.offset >= _this.length)) {
          return _this.loop();
        }
      };
    })(this);
    this.xhr.onprogress = (function(_this) {
      return function(event) {
        return _this.emit('progress', (_this.offset + event.loaded) / _this.length * 100);
      };
    })(this);
    this.xhr.onerror = (function(_this) {
      return function(err) {
        _this.emit('error', err);
        return _this.pause();
      };
    })(this);
    this.xhr.onabort = (function(_this) {
      return function(event) {
        return _this.inflight = false;
      };
    })(this);
    this.xhr.open("GET", this.url, true);
    this.xhr.responseType = "arraybuffer";
    endPos = Math.min(this.offset + this.chunkSize, this.length);
    this.xhr.setRequestHeader("If-None-Match", "webkit-no-cache");
    this.xhr.setRequestHeader("Range", "bytes=" + this.offset + "-" + endPos);
    this.xhr.overrideMimeType('text/plain; charset=x-user-defined');
    return this.xhr.send(null);
  };

  HTTPSource.prototype.pause = function() {
    var _ref;
    this.inflight = false;
    return (_ref = this.xhr) != null ? _ref.abort() : void 0;
  };

  HTTPSource.prototype.reset = function() {
    this.pause();
    return this.offset = 0;
  };

  return HTTPSource;

})(EventEmitter);

module.exports = HTTPSource;


},{"../../core/buffer":7,"../../core/events":9}],44:[function(_dereq_,module,exports){
(function (global){
var AVBuffer, BufferList, BufferSource, EventEmitter,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = _dereq_('../core/events');

BufferList = _dereq_('../core/bufferlist');

AVBuffer = _dereq_('../core/buffer');

BufferSource = (function(_super) {
  var clearImmediate, setImmediate;

  __extends(BufferSource, _super);

  function BufferSource(input) {
    this.loop = __bind(this.loop, this);
    if (input instanceof BufferList) {
      this.list = input;
    } else {
      this.list = new BufferList;
      this.list.append(new AVBuffer(input));
    }
    this.paused = true;
  }

  setImmediate = global.setImmediate || function(fn) {
    return global.setTimeout(fn, 0);
  };

  clearImmediate = global.clearImmediate || function(timer) {
    return global.clearTimeout(timer);
  };

  BufferSource.prototype.start = function() {
    this.paused = false;
    return this._timer = setImmediate(this.loop);
  };

  BufferSource.prototype.loop = function() {
    this.emit('progress', (this.list.numBuffers - this.list.availableBuffers + 1) / this.list.numBuffers * 100 | 0);
    this.emit('data', this.list.first);
    if (this.list.advance()) {
      return setImmediate(this.loop);
    } else {
      return this.emit('end');
    }
  };

  BufferSource.prototype.pause = function() {
    clearImmediate(this._timer);
    return this.paused = true;
  };

  BufferSource.prototype.reset = function() {
    this.pause();
    return this.list.rewind();
  };

  return BufferSource;

})(EventEmitter);

module.exports = BufferSource;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../core/buffer":7,"../core/bufferlist":8,"../core/events":9}]},{},[1])

(1)
});

//# sourceMappingURL=aurora.js.map