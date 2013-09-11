#node-ax25

A KISS &amp; AX.25 stack for node.js.

This project is incomplete, but is in progress as of September 2013.  Usage examples will follow once there's more that can be done with this.

In its current state, this module could be used for things like APRS monitoring and messaging, or anything else that doesn't require connected-mode sessions or flow control.

Next up is an ax25Session object, to be followed by some kind of ax25Server.  These will allow stateful sessions with remote systems.

---

###Dependencies

[node-serialport](https://github.com/voodootikigod/node-serialport)

If you intend to interface with a conventional KISS TNC, the node-serialport module will be required.  Installation of this package can be a bit more complicated than is usual, so be sure to read the instructions.

---

####kissTNC

```js
var tnc = new kissTNC(serialPort, baudRate, txDelay, persistence, slotTime, txTail, fullDuplex);
```

The *serialPort* and *baudRate* arguments are required.  The rest are optional, and can be set after the fact.

```js
var kissTNC = require("ax25").kissTNC;

var tnc = new kissTNC(
	"COM3",	// Serial device, eg. "COM3" or "/dev/ttyUSB0"
	9600	// Serial comms rate between computer and TNC
);

tnc.on(
	"frame",
	function(frame) {
		console.log("Here's an array of bytes representing an AX.25 frame: " + frame);
	}
);

tnc.on(
	"error",
	function(err) {
		console.log("HURRRRR! I DONE BORKED!" + err);
	}
);
```

#####Events:

* **opened** - The connection to the TNC has been opened successfully.
* **closed** - The connection to the TNC has been closed.
* **error** - An error has occurred (error details will be supplied as an argument to your callback function.)
* **frame** - A KISS frame has been received from the TNC (the enclosed AX.25 frame, less start/stop flags and FCS, will be supplied as an argument to your callback function.)
* **sent** - A KISS frame was sent to the TNC (the number of bytes sent to the TNC will be supplied as an argument to your callback function.  Not very useful.)

#####Properties:

* **serialPort** - eg. "COM1", or "/dev/ttyUSB0".
* **baudRate** - eg. 1200, 9600, 115200.
* **txDelay** - Transmitter keyup delay, in milliseconds. Default: 500
* **persistence** - Persistence, float between 0 and 1. Default: 0.25
* **slotTime** - Slot interval, in milliseconds. Default : 100ms
* **txTail** - Time to keep transmitting after packet is sent, in milliseconds (deprecated)
* **fullDuplex** - Boolean, default: false.

#####Methods:

* **send(frame)** - Sends an AX.25 frame to the TNC to be sent out over the air.  ("frame" must be an array of bytes, representing an AX.25 frame less the flags and FCS.)
* **setHardware(value)** - Most people won't need to use this ... consult your TNC's documentation.
* **close()** - Close the connection to the TNC.
* **exitKISS()** - Bring the TNC out of KISS mode (if your TNC has a terminal mode.)

####ax25Packet

```js
var packet = new ax25Packet(frame);
```

The *frame* argument would be an array of unsigned ints, such as provided by the kissTNC's "frame" event.

```js
var util = require("util");
var kissTNC = require("ax25").kissTNC;
var ax25Packet = require("ax25").ax25Packet;
var ax25 = require("ax25").ax25;

var tnc = new kissTNC("COM3", 9600);

tnc.on(
	"error",
	function(err) {
		console.log(err);
	}
);

tnc.on(
	"opened",
	function() {
		console.log("TNC opened on " + tnc.serialPort + " at " + tnc.baudRate);
	}
);

tnc.on(
	"frame",
	function(frame) {
		var packet = new ax25Packet(frame);
		console.log(
			util.format(
				"Packet seen from %s-%s to %s-%s.",
				packet.sourceCallsign,
				packet.sourceSSID,
				packet.destinationCallsign,
				packet.destinationSSID
			)
		);
		if(packet.infoString != "")
			console.log(packet.infoString);
	}
);

var beacon = function() {
	var packet = new ax25Packet();
	packet.sourceCallsign = "MYCALL";
	packet.destinationCallsign = "BEACON";
	packet.type = ax25.U_FRAME_UI;
	packet.infoString = "Hello world!";
	var frame = packet.assemble();
	tnc.send(frame);
	console.log("Beacon sent.");
}

setInterval(beacon, 30000); // Beacon every 30 seconds - excessive!
```

#####Properties

* **destinationCallsign** - 
* **destinationSSID** - 
* **sourceCallsign** - 
* **sourceSSID** - 
* **repeaterPath** - 
* **pollFinal** - 
* **command** - 
* **response** - 
* **type** - 
* **nr** - 
* **ns** - 
* **pid** - 
* **info** - 