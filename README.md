#node-ax25

A KISS &amp; AX.25 stack for node.js.

A work in progress.  Currently usable for stateless things like APRS and whatever other unconnected-mode stuff you may want to do.

ax25Session object is next on the list, which will allow for stateful communication and make use of AX.25's flow control junk.

---

###Dependencies

[node-serialport](https://github.com/voodootikigod/node-serialport)

If you intend to interface with a conventional KISS TNC, the node-serialport module will be required.  Installation of this package can be a bit more complicated than is usual, so be sure to read the instructions.

---

####ax25.kissTNC

```js
var tnc = new ax25.kissTNC(
	{	serialPort : "COM3",
		baudRate : 9600,
		txDelay : 500,
		persistence : .25,
		slotTime : 500,
		txTail : 100,
		fullDuplex : false
	}
);
```

The *serialPort* and *baudRate* argument properties are required.  The rest are optional, and can be set after the fact.

```js
var ax25 = require("ax25");

var tnc = new ax25.kissTNC(
	{	serialPort : "COM3",	// Serial device, eg. "COM3" or "/dev/ttyUSB0"
		baudRate : 9600			// Serial comms rate between computer and TNC
	}
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

* **serialPort** - eg. "COM1", or "/dev/ttyUSB0". (String)
* **baudRate** - eg. 1200, 9600, 115200. (Number)
* **callSign** - eg. "VE3XEC". (String)
* **SSID** - eg. 0. (Number, 0 - 15)
* **txDelay** - Transmitter keyup delay, in milliseconds. Default: 500. (Number)
* **persistence** - Persistence, float between 0 and 1. Default: 0.25. (Number)
* **slotTime** - Slot interval, in milliseconds. Default : 100. (Number)
* **txTail** - Time to keep transmitting after packet is sent, in milliseconds (deprecated.) (Number)
* **fullDuplex** - Boolean, default: false. (Boolean)

#####Methods:

* **send(frame)** - Sends an AX.25 frame to the TNC to be sent out over the air.  (*frame* must be an array of bytes, representing an AX.25 frame less the flags and FCS, eg. the return value of *ax25.Packet.assemble()*.)
* **setHardware(value)** - Most people won't need to use this ... consult your TNC's documentation.
* **close()** - Close the connection to the TNC.
* **exitKISS()** - Bring the TNC out of KISS mode (if your TNC has a terminal mode.)

####ax25.Packet

```js
var packet = new ax25.Packet(frame);
```

The *frame* argument would be an array of unsigned ints, such as provided by the ax25.kissTNC's *frame* event.  If *frame* is not supplied, the objects properties will be populated with default values (if you're creating an outgoing packet, you can assign whatever values you want to those properties before calling *ax25.packet*.assemble().)

```js
var util = require("util");
var ax25 = require("ax25");

var tnc = new ax25.kissTNC("COM3", 9600);

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
		var packet = new ax25.Packet(frame);
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
	var packet = new ax25.Packet();
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

* **destinationCallsign** - The destination callsign, up to six alphanumerics. (String)
* **destinationSSID** - The destination SSID, one number. (Number)
* **sourceCallsign** - The source callsign, up to six alphanumerics. (String)
* **sourceSSID** - The source SSID, one number. (Number)
* **repeaterPath** - An array of { callsign : <string>, ssid : <number> } objects. (Array of objects)
* **pollFinal** - True if this is a poll/final packet, false otherwise. (Boolean)
* **command** - True if this is a command packet, false otherwise.  Inverse of *response*. (Boolean)
* **response** - True if this is a response packet, false otherwise.  Inverse of *command*. (Boolean)
* **type** - Bitfield for comparison against packet types as defined in ax25defs.js (eg. U_FRAME, I_FRAME, S_FRAME.)  (Number)
* **nr** - Sender's receive-sequence number (N(R) in the AX.25 2.2 spec.) (Number)
* **ns** - Sender's send-sequence number (N(S) in the AX.25 2.2 spec.) (Number)
* **pid** - Protocol ID field, for comparison against PIDs defined in ax25defs.js. (Number)
* **info** - The information field of an I or UI frame. (Array)
* **infoString** - The information field of an I or UI frame, as a string. (String)

#####Methods

* **disassemble(frame)** - Where *frame* is an array of numbers representing an AX.25 frame (eg. the value provided by the ax25.kissTNC *frame* event,) disassemble *frame* and populate the above properties with the values found therein. (Note: if ax25.Packet is instantiated with a *frame* argument, this will happen automatically.) (Void)
* **assemble()** - When creating an outgoing frame, make a new ax25.Packet object, populate its properties as desired, then call *ax25.Packet*.assemble(), which will return an array of numbers representing an AX.25 frame (which can be supplied to ax25.kissTNC.send(frame).) (Array)