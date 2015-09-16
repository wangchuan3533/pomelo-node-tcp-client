var util = require("util"),
    bytearray = require('bytearray');

var Package = function(){
    var self = this;
    
    self.TYPE_HANDSHAKE = 1;
    self.TYPE_HANDSHAKE_ACK = 2;
    self.TYPE_HEARTBEAT = 3;
    self.TYPE_DATA = 4;
    self.TYPE_KICK = 5;
}

var pt = Package.prototype;

pt.encode = function(type, body){
    var self = this;
    
    var length = body ? body.length : 0;
    //console.log("length: " + length);
    var buffer = new Buffer(4+length);
    var b = new Buffer(4);
    buffer.fill(0x00);
    bytearray.writeByte(buffer, type & 0xff);
    //console.log("type set("+type+"): " + util.inspect(buffer));
    bytearray.writeByte(buffer, (length>>16) & 0xff);
    bytearray.writeByte(buffer, (length>>8) & 0xff);
    bytearray.writeByte(buffer, (length>>8) & 0xff);
    /*if(length<128)
        bytearray.writeByte(buffer, length & 0xff);
    else */b.writeUInt32BE(length,0);
    //console.log("b: " + util.inspect(b));
    //buffer[3]=b[0];
    //if(body)buffer.write(body.toString(), 0, body.length);
    //if(body)
    //    console.log("body: " + body.toString());
    for(var i=0;i<length;i++){
        //console.log("i:"+i+"/"+length + " bl: " + buffer.length + " v: "+body[i]);
        //bytearray.writeByte(buffer, body[i]);
        buffer[(i+4)] = body[i];
    }
    buffer[3]=b[3];
    if(length>255){
        buffer[2]=b[2];
    }
    //console.log("final: " + util.inspect(buffer));
    //console.log("string: " + util.inspect(buffer.toString()));
    
    /*
    var newBuffer = buffer.write(body.toString(),4)//Buffer.concat([buffer, body]);
    console.log("head: " + util.inspect(buffer) + " body: " + body.toString() + " msg length: " + buffer.toString().length);
    console.log("sending buffer: " + util.inspect(newBuffer.toString()));
    return buffer.toString();*/
    //console.log("head: " + util.inspect(buffer) + " body: " + body.toString() + " msg length: " + buffer.toString().length);
    return buffer;
}

pt.decode = function(buffer){
    var self = this;
    
    var type = bytearray.readUnsignedByte(buffer,0);
    var len = (bytearray.readUnsignedByte(buffer)<<16 | bytearray.readUnsignedByte(buffer)<<8 | bytearray.readUnsignedByte(buffer))>>>0;
    
    var body;
    //console.log("len: " + len + " type: " + type + " bytearray.getBytesAvailable(buffer): " + bytearray.getBytesAvailable(buffer));
    if(bytearray.getBytesAvailable(buffer)>=len){
        body = new Buffer(len);
        if(len){
            //body.write(buffer);//bytearray.readBytes(buffer, 0, len);
            for(var i=4;i<len+4;i++){
                bytearray.writeByte(body, buffer[i]);
            }
            
        }
    } else {
        //console.log("insufficient length for current type: " + type);
    }
    return {type:type, body:body, length:len};
}

module.exports = Package;