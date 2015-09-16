var util = require("util");
var Protobuf = require("./libs/protobuf.js");
var Protocol = require("./libs/protocol.js");
var bytearray = require('bytearray');

var Message = function(parent) {
  var self = this;

  self.parent = parent;

  self.MSG_FLAG_BYTES = 1;
  self.MSG_ROUTE_CODE_BYTES = 2;
  self.MSG_ID_MAX_BYTES = 5;
  self.MSG_ROUTE_LEN_BYTES = 1;
  self.MSG_ROUTE_CODE_MAX = 0xffff;
  self.MSG_COMPRESS_ROUTE_MASK = 0x1;
  self.MSG_TYPE_MASK = 0x7;

  self.TYPE_REQUEST = 0;
  self.TYPE_NOTIFY = 1;
  self.TYPE_RESPONSE = 2;
  self.TYPE_PUSH = 3;
};

Message.prototype.encode = function(id, route, msg) {
  var self = this;
  var msgStr = JSON.stringify(msg);
  var type = id ? self.TYPE_REQUEST : self.TYPE_NOTIFY;
  var byte = Protobuf.encode(route, msg) || Protocol.strencode(msgStr);
  var rot = route;

  var buffer = new Buffer(3 + byte.length + rot.length);
  buffer.fill(0x00);
  // if (!id) {
  //   bytearray.writeByte(buffer, 0x00);
  // }
  bytearray.writeByte(buffer, (type << 1) | ((typeof(rot) == "string") ? 0 : 1));
  if (id) {
    do {
      var tmp = id % 128;
      var next = Math.floor(id / 128);
      if (next !== 0) {
        tmp = tmp + 128;
      }
      bytearray.writeByte(buffer, tmp);
      id = next;
    } while (id !== 0);
  }

  if (rot) {
    if (typeof(rot) == "string") {
      bytearray.writeByte(buffer, rot.length & 0xff);
      bytearray.writeUTFBytes(buffer, rot);
    }
    else {
      bytearray.writeByte(buffer, (rot >> 8) & 0xff);
      bytearray.writeByte(buffer, rot & 0xff);
    }
  }

  if (byte) {
    for (var b = 0; b < byte.length; b++) {
      bytearray.writeByte(buffer, byte[b]);
    }
    return buffer;
  }

  return buffer;
};

Message.prototype.decode = function(buffer) {
  var self = this;
  var flag = bytearray.readUnsignedByte(buffer, 0);
  var compressRoute = flag & self.MSG_COMPRESS_ROUTE_MASK;
  var type = (flag >> 1) & self.MSG_TYPE_MASK;
  var sliceFrom = 2;
  var id = 0;
  var m;
  var route;

  if (type === self.TYPE_REQUEST || type === self.TYPE_RESPONSE) {
    var i = 0;
    do {
      m = bytearray.readUnsignedByte(buffer);
      id = id + ((m & 0x7f) * Math.pow(2, (7 * i)));
      i++;
    } while (m >= 128);
  }

  if (type === self.TYPE_REQUEST || type === self.TYPE_NOTIFY || type === self.TYPE_PUSH) {

    if (compressRoute) {
      route = bytearray.readUnsignedShort(buffer);
    }
    else {
      var routeLen = bytearray.readUnsignedByte(buffer);
      route = routeLen ? buffer.slice(2, routeLen + 2).toString() : '';
      sliceFrom += routeLen;
    }
  }
  else if (type === self.TYPE_RESPONSE) {
    route = self.parent.requests[id].route;
  }

  var body = Protobuf.decode(route, buffer) ||
             JSON.parse(Protocol.strdecode(buffer.slice(sliceFrom)));
  return {
    id: id,
    type: type,
    route: route,
    body: body
  };
};

module.exports = Message;
