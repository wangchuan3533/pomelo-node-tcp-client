# pomelo-node-tcp-client

Node.js TCP client library for Pomelo framework.

## Instructions

Install with ```npm install pomelo-node-tcp-client```

Usage:

```javascript
var Pomelo = require("pomelo-node-tcp-client")

pomelo.init("127.0.0.1", 3010,{}, function() {
  console.log('success');
  pomelo.request("connector.entryHandler.entry", {}, onEntry);
});

function onEntry(object){
  console.log("got it: " + object);
}

pomelo.notify("gameManager.gameHandler.startGame", {});

pomelo.on("gameManager.gameHandler.gameEvent", handleGameEvents);

function handleGameEvents(event){
  console.log("handle: " + util.inspect(event));
  switch(event.gameEvent.type){
    case "myEvent_01":
      console.log("let's do something with it");
      break;
    case "gameStart":
      console.log("game has started");
      break;
      ...
  }
}
```

    public function encode(id:uint, route:String, msg:Object):ByteArray {
      var buffer:ByteArray = new ByteArray();
      var type:int = id ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;
      var byte:ByteArray = Protobuf.encode(route, msg) || Protocol.strencode(JSON.stringify(msg));
      var rot:* = Routedic.getID(route) || route;

      buffer.writeByte((type << 1) | ((rot is String) ? 0 : 1));

      if (id) {
        do {
          var tmp:int = id % 128;
          var next:Number = Math.floor(id / 128);

          if (next != 0) {
            tmp = tmp + 128;
          }

          buffer.writeByte(tmp);

          id = next;
        } while (id != 0);
      }

      if (rot) {
        if (rot is String) {
          buffer.writeByte(rot.length & 0xff);
          buffer.writeUTFBytes(rot);
        }
        else {
          buffer.writeByte((rot >> 8) & 0xff);
          buffer.writeByte(rot & 0xff);
        }
      }

      if (byte) {
        buffer.writeBytes(byte);
      }

      return buffer;
    }

