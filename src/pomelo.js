var util = require("util"),
    net = require("net"),
    Message = require("./message.js"),
    Package = require("./package.js"),
    Protocol = require("./libs/protocol.js"),
    Protobuf = require("./libs/protobuf.js"),
    bytearray = require('bytearray'),
    events = require("events"),
    Request = require("./request.js");

var PackageConstants = {
    TYPE_HANDSHAKE: 1,
    TYPE_HANDSHAKE_ACK: 2,
    TYPE_HEARTBEAT: 3,
    TYPE_DATA: 4,
    TYPE_KICK: 5
}    
    
var Pomelo = function(){
    var self = this;
    
    self.requests = {};
    self.info = {sys:{version:"0.0.1", type:"pomelo-node-tcp-client", pomelo_version:"0.7.x"}};
    
    self._handshake = null;
    self._socket = null;
    self._hb = 0;
    
    self._package = new Package();
    self._message = new Message(self);
    
    self._pkg = null;
    
    self._routesAndCallbacks = [];
    
    self._pomelo = null;
    
    self.heartbeat = 0;
	
	self.consoleLogs = true;
}

util.inherits(Pomelo, events.EventEmitter);

var pt = Pomelo.prototype;

pt.init = function(host, port, user, callback, timeout, cross){
    var self = this;
    self.info.user = user;
    self._handshake = callback;
    
    if(timeout==null)timeout=8000;
    if(cross==null)cross=3843;
    
    if(self._socket==null){
        //console.log("creating socket");
        self._socket = new net.Socket();
        self._socket.setNoDelay();
        self._socket.on("connect", self.onConnect.bind(self));
        self._socket.on("close", self.onClose.bind(self));
        self._socket.on("data", self.onData.bind(self));
        self._socket.on("error", self.onError.bind(self));
    }
    self._socket.connect(port, host, function(){if(self.consoleLogs)console.log("connected!")});
}

pt.disconnect = function(){
    var self = this;
    if(self._socket && self._socket.connected)self._socket.close();
    if (_hb) clearTimeout(_hb);
}

pt.request = function(route, msg, callback){
    var self = this;
    if(!route || !route.length)return;
    
    if(callback==null){
        self.notify(route, msg);
        return;
    }
    
    var req = new Request(route, callback);
    self.requests[req.id] = req;
    
    self.send(req.id, req.route, msg || {});
}

pt.notify = function(route, msg){
    var self = this;
    
    self.send(0, route, msg || {});
}

pt.on = function(route, callback){
    var self = this;
    
    self._routesAndCallbacks[route] = callback;
}

pt.beat = function(){
    var self = this;
    
    clearTimeout(self._hb);
    _hb = 0;
    
    //console.log("heartbeat");
    self.socketSend(self._package.encode(PackageConstants.TYPE_HEARTBEAT));
    
}

pt.send = function(reqId, route, msg){
    var self = this;
    var msgStr = JSON.stringify(msg);
    //console.log("sending: "+msgStr + " len: " + msgStr.length + " on route: " + route);
    var buffer = new Buffer(msgStr.length);
    buffer = self._message.encode(reqId, route, msg);
    buffer = self._package.encode(PackageConstants.TYPE_DATA, buffer);
    
    self.socketSend(buffer);
}

pt.onConnect = function(){
    var self = this;
    self.socketSend(self._package.encode(PackageConstants.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(self.info))));
}

pt.socketSend = function(data){
    var self = this;
    self._socket.write(data);
    //self._socket.write("\0");
}

pt.onClose = function(){
    var self = this;
    if(self.consoleLogs)console.log("closed");
}

pt.onError = function(data){
    var self = this;
    if(self.consoleLogs)console.log(data);
}

pt.onData = function(data){
    var self = this;
    //console.log("data: " + data.length);
    do{
        //console.log("do-ing");
        //console.log("self._pkg: " + self._pkg + " self._pkg.length: " + self._pkg.length + " self._socket.bytesAvailable: " + self._socket.bytesAvailable);
        if(self._pkg){
            //if(self._socket.bytesAvailable >= self._pkg.length){
                //console.log("self._pkg.length: "+self._pkg.length);
                self._pkg.body = new Buffer(self._pkg.length);
                //console.log("data: " + util.inspect(data));
                //self._pkg.body.write(data, 0, self._pkg.length);
                self._pkg.body = data;
            //}
        } else {
            self._pkg = self._package.decode(data);
        }
        //console.log("[Package] type: " + self._pkg.type + " length: " + self._pkg.length);
        
        switch(self._pkg.type){
            case self._package.TYPE_HANDSHAKE:
                var message = self._pkg.body.toString();//bytearray.readUTFBytes(self._pkg.body, self._pkg.body.length);
                //console.log("[HANDSHAKE] message: " + message);
                var response = JSON.parse(message);
                if(response.code==200){
                    if(response.sys){
                        //Routedic.init(response.sys.dict);
                        Protobuf.init(response.sys.protos);
                        self.heartbeat = response.sys.heartbeat;
                    }
                    self.socketSend(self._package.encode(self._package.TYPE_HANDSHAKE_ACK));
                    self.emit("handshake");
                }
                if (self._handshake != null) {
                    //console.log("handshaking...");
                    self._handshake.call(self, response);
                } else {
                    //console.log("not handshaking...");
                }
                self._pkg = null;
                break;
            case self._package.TYPE_HANDSHAKE_ACK:
                self._pkg = null;
                break;
            case self._package.TYPE_HEARTBEAT:
                self._pkg = null;
                //console.log("hb: " + self.heartbeat);
                if(self.heartbeat){
                    _hb = setTimeout(self.beat.bind(self), self.heartbeat*1000);
                }
                break;
            case self._package.TYPE_DATA:
                var msg = self._message.decode(self._pkg.body);
                if(self.consoleLogs)console.log("[MESSAGE] route: " + msg.route + " body: " + JSON.stringify(msg.body));
                
                if(!msg.id){
                    //dispatch event
                    //self.emit(msg.route, msg.body);
                    self._routesAndCallbacks[msg.route](msg.body);
                } else {
                    self.requests[msg.id].callback.call(self, msg.body);
                    self.requests[msg.id]=null;
                }
                
                self._pkg = null;
                break;
            case self._package.TYPE_KICK:
                //dispatch event
                _pkg = null;
                break;
        }
        //console.log("[POMELO] client next: " + self._socket.bytesRead);
    } while(self._pkg && self._pkg.length>4);
    
}

pt.getMessage = function(){
    var self = this;
    return self._message;
}

pt.setMessage = function(msg){
    var self = this;
    self_message = msg;
}

module.exports = Pomelo;
