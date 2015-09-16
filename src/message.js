var util = require("util")
    Protobuf = require("./libs/protobuf.js"),
    Protocol = require("./libs/protocol.js"),
    bytearray = require('bytearray');

var Message = function(parent){
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
    
}

var pt = Message.prototype;

pt.encode = function(id, route, msg){
    var self = this,
        msgStr = JSON.stringify(msg),
        type = id ? self.TYPE_REQUEST : self.TYPE_NOTIFY,
        byte = Protobuf.encode(route, msg) || Protocol.strencode(msgStr),
        //byte = Protobuf.encode(route, msg),
        rot = route;
    
    //console.log("buffer length: " + (5+byte.length) + " id: " + id);
    var buffer = new Buffer(3+byte.length+rot.length);
    buffer.fill(0x00);
    //console.log("byte: " + util.inspect(byte.toString()));
    //console.log("buffer-1 (empty): " + util.inspect(buffer));
    if(!id)bytearray.writeByte(buffer, 0x00);
    bytearray.writeByte(buffer, (type << 1) | ((typeof(rot) == "string") ? 0 : 1));
    //console.log("buffer-2 (message flag)): " + util.inspect(buffer));
    if(id){
        do{
            var tmp = id%128;
            var next = Math.floor(id/128);
            if(next!=0){
                tmp = tmp +128;
            }
            //console.log("tmp: " + tmp);
            bytearray.writeByte(buffer, tmp);
            id = next;
        } while(id!=0)
    }
    //console.log("buffer-3 (message id): " + util.inspect(buffer));
    
    if(rot){
        //console.log("typeof(rot): " + typeof(rot));
        if(typeof(rot) == "string"){
            //console.log("it's a string! rot.length: " + rot.length);
            //bytearray.writeByte(buffer, 0x00);
            bytearray.writeByte(buffer, rot.length & 0xff);
            bytearray.writeUTFBytes(buffer, rot);
            //buffer.write(rot, 4);
            
            //Buffer.concat([buffer, Protocol.strencode(msgStr)]);
            //console.log("check: " + buffer.toString());
        } else {
            //console.log("it's not a string!");
            bytearray.writeByte(buffer, (rot>>8) & 0xff);
            bytearray.writeByte(buffer, rot & 0xff);
        }
    }
    
    if(byte){
        for(var b=0;b<byte.length;b++){
            bytearray.writeByte(buffer, byte[b]);
        }
        //console.log("buffer-4: " + util.inspect(buffer));
        return buffer;//bytearray.writeBytes(buffer, byte);
    }
    return buffer;
}

pt.decode = function(buffer){
    //console.log("decoding: " + util.inspect(buffer));
    var self = this,
        flag = bytearray.readUnsignedByte(buffer, 0);
        compressRoute = flag & self.MSG_COMPRESS_ROUTE_MASK,
        type = (flag >> 1) & self.MSG_TYPE_MASK,
        sliceFrom = 2;
    
    var id = 0;
    //console.log("msg type: " + type);
    if(type === self.TYPE_REQUEST || type === self.TYPE_RESPONSE){
        var i = 0;
        do{
            var m = bytearray.readUnsignedByte(buffer);
            id = id + ((m & 0x7f) * Math.pow(2, (7 * i)));
            i++;
        } while (m>=128)
    }
    
    if(type === self.TYPE_REQUEST || type === self.TYPE_NOTIFY || type === self.TYPE_PUSH){
        var route;
        //console.log("buffer: " + util.inspect(buffer));
        if(compressRoute){
            route = bytearray.readUnsignedShort(buffer);
        } else {
            var routeLen = bytearray.readUnsignedByte(buffer);
            //console.log("routeLen: " + routeLen);
            route = routeLen ? buffer.slice(2, routeLen+2).toString():"";
            //console.log("route: " + route);
            sliceFrom += routeLen;
        }
    } else if (type === self.TYPE_RESPONSE) {
        route = self.parent.requests[id].route;
    }
    
    var body = Protobuf.decode(route, buffer) || JSON.parse(Protocol.strdecode(buffer.slice(sliceFrom)));
    return {id:id, type:type, route:route, body:body};
}

module.exports = Message;