# node-ax25

*07/12/2017 - Notice: I have started [a new branch](https://github.com/echicken/node-ax25/tree/es6rewrite) under which I am rewriting this entire module.  The AX.25 and KISS TNC portions of this module will be decoupled, as a new, separate [KISS TNC module](https://github.com/echicken/kiss-tnc) has been created.  I do not recommend putting much effort into using the current module, nor putting any effort into improving it.*

A KISS &amp; AX.25 packet radio stack for node.js.

---

### Installation

```sh
npm install ax25
```

Or:

Assuming you have git installed, the following will clone this repository into a directory called 'node-ax25' under the current working directory, then attempt to install its dependencies:

```sh
git clone https://github.com/echicken/node-ax25.git
npm install
```

This will get you the latest code, which may be more unstable than what's in the npm registry. :D

If you go this route and run the examples shown below, either rename the node-ax25 directory to "ax25" or modify the require() paths accordingly.

#### Dependencies

[node-serialport](https://github.com/voodootikigod/node-serialport)

The node-ax25 module is made to interface with a KISS TNC over a serial port.  (It would, however, be possible to use it with another kind of interface.)  When you run *npm install*, the required [node-serialport](https://github.com/voodootikigod/node-serialport) module will be installed automatically.

#### Compatibility

[ax25.kissTNC](#ax25.kissTNC) should work with any KISS TNC, and has been tested with several different models.

Yes, [ax25.kissTNC](#ax25.kissTNC) has been tested and found to work with [soundmodem](http://soundmodem.vk4msl.yi.org/), which emulates a KISS TNC.

---

#### The Stack

- [ax25.kissTNC](#ax25.kissTNC)
	- Provides an API for communicating with a KISS TNC on a serial port
		- [Events](#ax25.kissTNC.Events)
		- [Properties](#ax25.kissTNC.Properties)
		- [Methods](#ax25.kissTNC.Methods)
- [ax25.Packet](#ax25.Packet)
	- Provides an API for crafting outbound AX.25 packets
	- Provides an API for disassembling and inspecting inbound AX.25 packets
		- [Properties](#ax25.Packet.Properties)
		- [Methods](#ax25.Packet.Methods)
- [ax25.Session](#ax25.Session)
	- Provides an API for stateful connections with other packet radio stations
		- [Events](#ax25.Session.Events)
		- [Properties](#ax25.Session.Properties)
		- [Methods](#ax25.Session.Methods)

---

- [Notes](#ax25.Notes)
	- Notes on using ax25.Packet and ax25.Session without ax25.kissTNC

---
<a name="ax25.kissTNC"></a>
#### ax25.kissTNC

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

<a name="ax25.kissTNC.Events"></a>
##### Events:

- **opened**
	- The connection to the TNC has been opened successfully.
- **closed**
	- The connection to the TNC has been closed.
- **error**
	- An error has occurred (error details will be supplied as an argument to your callback function.)
- **frame**
	- A KISS frame has been received from the TNC (the enclosed AX.25 frame, less start/stop flags and FCS, will be supplied as an argument to your callback function.)
- **sent**
	- A KISS frame was sent to the TNC (the number of bytes sent to the TNC will be supplied as an argument to your callback function.  Not very useful.)

<a name="ax25.kissTNC.Properties"></a>
##### Properties:

- **serialPort**
	- eg. "COM1", or "/dev/ttyUSB0". (String)
- **baudRate**
	- eg. 1200, 9600, 115200. (Number)
- **txDelay**
	- Transmitter keyup delay, in milliseconds. Default: 500. (Number)
- **persistence**
	- Persistence, float between 0 and 1. Default: 0.25. (Number)
- **slotTime**
	- Slot interval, in milliseconds. Default : 100. (Number)
- **txTail**
	- Time to keep transmitting after packet is sent, in milliseconds (deprecated.) (Number)
- **fullDuplex**
	- Boolean, default: false. (Boolean)

<a name="ax25.kissTNC.Methods"></a>
##### Methods:

- **send(frame)**
	- Sends an AX.25 frame to the TNC to be sent out over the air.  (*frame* must be an array of unsigned 8-bit integers, representing an AX.25 frame less the flags and FCS, eg. the return value of *ax25.Packet.assemble()*.)
- **setHardware(value)**
	- Most people won't need to use this ... consult your TNC's documentation.
- **close()**
	- Close the connection to the TNC.
- **exitKISS()**
	- Bring the TNC out of KISS mode (if your TNC has a terminal mode.)

---

<a name="ax25.Packet"></a>
#### ax25.Packet

```js
var packet = new ax25.Packet({ 'frame' : frame });
```
*or*
```js
var packet = new ax25.Packet(
	{	'destinationCallsign'	: "VE3XEC",
		'destinationSSID'		: 1,
		'sourceCallsign'		: "KB1YFO",
		'sourceSSID'			: 0,
		'repeaterPath'			: [
			{ 'callsign' : "VE7RRX", 'ssid' : 7 },
			{ 'callsign' : "K6BSD", 'ssid' : 2 },
			{ 'callsign' : "WX6YYZ", 'ssid' : 8 },
			{ 'callsign' : "KF5PFU", 'ssid' : 3 },
			{ 'callsign' : "KB1YFO", 'ssid' : 10 }
		],
		'pollFinal'				: true,
		'command'				: true,
		'type'					: ax25.Defs.I_FRAME,
		'nr'					: 1,
		'ns'					: 3,
		'pid'					: ax25.Defs.PID_NONE,
		'infoString'			: "Your mother."
	}
);
```

In the first example, the argument's *frame* property would be an array of unsigned 8-bit ints, such as provided by the ax25.kissTNC's *frame* event.

The second example shows how you can assign values to all of the *ax25.Packet* object's properties upon instantiation.  If no argument is provided, these properties will be set to their default values, and you should set them as needed before calling *ax25.Packet*.assemble().

```js
var util = require("util");
var ax25 = require("ax25");

var tnc = new ax25.kissTNC(
	{	'serialPort' : "/dev/ttyUSB0",
		'baudRate' : 9600
	}
);

var beacon = function() {
	var packet = new ax25.Packet(
		{	sourceCallsign : "MYCALL",
			destinationCallsign : "BEACON",
			type : ax25.U_FRAME_UI,
			infoString : "Hello world!"
		}
	);
	var frame = packet.assemble();
	tnc.send(frame);
	console.log("Beacon sent.");
}

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
		setInterval(beacon, 30000); // Beacon every 30 seconds - excessive!
	}
);

tnc.on(
	"frame",
	function(frame) {
		var packet = new ax25.Packet({ 'frame' : frame });
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
```

<a name="ax25.Packet.Properties"></a>
##### Properties

- **destinationCallsign**
	- The destination callsign, up to six alphanumerics. (String)
- **destinationSSID**
	- The destination SSID, one number, 0 - 15. (Number)
- **sourceCallsign**
	- The source callsign, up to six alphanumerics. (String)
- **sourceSSID**
	- The source SSID, one number. (Number)
- **repeaterPath**
	- An array of { callsign : <string>, ssid : <number> } objects. (Array of objects)
- **pollFinal**
	- True if this is a poll/final packet, false otherwise. (Boolean)
- **command**
	- True if this is a command packet, false otherwise.  Inverse of *response*. (Boolean)
- **response**
	- True if this is a response packet, false otherwise.  Inverse of *command*. (Boolean)
- **type**
	- Bitfield for comparison against packet types as defined in Defs.js (eg. U_FRAME, I_FRAME, S_FRAME.)  (Number)
- **nr**
	- Sender's receive-sequence number (N(R) in the AX.25 2.2 spec.) (Number)
- **ns**
	- Sender's send-sequence number (N(S) in the AX.25 2.2 spec.) (Number)
- **pid**
	- Protocol ID field, for comparison against PIDs defined in Defs.js. (Number)
- **info**
	- The information field of an I or UI frame. (Array)
- **infoString**
	- The information field of an I or UI frame, as a string. (String)

<a name="ax25.Packet.Methods"></a>
##### Methods

- **disassemble(frame)**
	- Where *frame* is an array of unsigned 8-bit integers representing an AX.25 frame (eg. the value provided by the ax25.kissTNC *frame* event,) disassemble *frame* and populate the above properties with the values found therein. (Note: if ax25.Packet is instantiated with a *frame* argument, this will happen automatically.) (Void)
- **assemble()**
	- When creating an outgoing frame, make a new ax25.Packet object, populate its properties as desired, then call *ax25.Packet*.assemble(), which will return an array of numbers representing an AX.25 frame (which can be supplied to ax25.kissTNC.send(frame).) (Array)
- **log()**
	- Returns a line of text describing some of the packet's properties, suitable for logging purposes. (String)

---

<a name="ax25.Session"></a>
#### ax25.Session

<a name="ax25.Session.Events"></a>
##### Events

- **packet**
	- An outgoing packet is ready for transmission.  Your callback will be provided with an ax25.Packet object which can be sent with *ax25.kissTNC*.send(*packet*.assemble());
- **data**
	- Data (I or UI frame payload) has been received from the remote station.  Your callback will be provided with an array of uint 8 bytes. (ax25.Utils.byteArrayToString(arr) can turn this into a string for your convenience.)
- **connection**
	- The connection state has changed.  Your callback will be provided with a boolean value.  *True* means that a connection has been established.  *False* means that the connection has been closed.  (Note that the connection may occasionally be re-established without a disconnection happening as part of a reset procedure.)
- **error**
	- Something done borked.  Your callback will be provided with a helpful textual error message.

<a name="ax25.Session.Properties"></a>
##### Properties

- **connected**
	- Whether or not a connection has been established with the remote station. (Boolean)
- **connection**
	- More fine-grained connection-state info than *connected*. (Number)
		- 1 = Disconnected. (Not connected, not trying to connect or disconnect.)
		- 2 = Connected. (Connected and ready.)
		- 3 = Connecting. (Attempting to connect, waiting for acknowledgement or timeout.)
		- 4 = Disconnecting. (Requested disconnect, waiting for acknowledgement or timeout.)
- **remoteCallsign**
	- The remote station's callsign, up to six alphanumerics. (String)
- **remoteSSID**
	- The remote station's SSID, one number, 0 - 15. (Number)
- **sourceCallsign**
	- The local station's (your) callsign, up to six alphanumerics. (String)
- **sourceSSID**
	- The local station's SSID, one number, 0 - 15. (Number)
- **repeaterPath**
	- An array of { callsign : <string>, ssid : <number> } objects. (Array of objects)
- **maxFrames**
	- Maximum number of unacknowledged I frames out at any given time. Default: 4. (Number)
	- If in modulo 128 mode, the maximum value is 127; otherwise the maximum is 7.
- **packetLength**
	- Maximum packet payload size, in bytes, minimum of 1. Default: 256.  Smaller values such as 64 are best for crappy links.  The spec says 256 is the maximum, so don't expect most TNCs to support larger values. (Number)
- **retries**
	- How many times to poll the other station for a response before giving up.  Default: 5.  You may wish to raise this value if using a very busy frequency, etc. (Number)
- **hBaud**
	- The baud rate of over-the-air communications.  Default: 1200.  It's recommended that you set this if your value differs from the default, as polling intervals and other timeouts are calculated based on this figure, among others. (Number)
- **modulo128**
	- (Boolean)
	- If set prior to a connect() attempt, will attempt to send a SABME command to initiate a connection with modulo 128 sequence numbers.
	- If read during the connected state, indicates whether the sequence numbers for this session are modulo 128. (Could be useful for tweaking the maxFrames value.)
	- *Modulo 128 implementation is in progress.  Setting this value will have undesirable results for the time being.*

<a name="ax25.Session.Methods"></a>
##### Methods

- **connect()**
	- Opens a connection to another station.  Remote and Local callsign and SSID properties must be set first. (Void)
- **disconnect()**
	- Disconnect from the remote station. (Void)
- **send(info)**
	- Send array of bytes (uint 8) 'info' to the remote station. (Void)  (Note: 'info' is just a plain old Array().  We may switch to Uint8Array or Buffer at some point.)
- **sendString(str)**
	- Send string 'str' to the remote station. (Void)
- **receive(packet)**
	- Process and respond to the received (and disassembled) packet 'packet'. (Void)

---

<a name="ax25.Notes"></a>
##### Notes on using ax25.Packet and ax25.Session without ax25.kissTNC

If you're receiving AX.25 frames from something other than a KISS interface attached to a serial port, you can still use ax25.Packet for packet assembly/disassembly, and you can also use ax25.Session to maintain stateful connections.

*ax25.Packet.disassemble(frame)* expects *frame* to be a plain array of unsigned 8-bit integers representing an AX.25 frame less the start/stop flags and Frame-Check Sequence (FCS.)  Either your interface or some middleware must remove the flags and verify the FCS, then format the data as described before passing it off to this method.

*ax25.Packet.assemble()* returns an array of unsigned 8-bit integers representing an AX.25 frame without start/stop flags or an FCS.  Either your interface or some middleware must calculate and append the FCS to the frame, then prepend and append flags and convert the array as needed.

*I know that these arrays of uint8s are kinda dumb.  I didn't really know about Buffer or Uint8Array when I started this thing, and I'm too lazy to make those changes right now.*

---
#### To Do:

- ax25.Session
	- if attempted SABME but failed and reconnecting with SABM, reset maxFrames to sane value
	- Implement oustanding portions of AX.25 2.2 spec sections 4.3.2.4, 4.4.4, 6.4.4.2, 6.4.4.3, 6.4.8 re: sending and receiving SREJ
		- add SREJ case to Session.receive()
			- retransmit the requested frame, with a retry event scheduled
			- track retransmitted frames and their timed events
			- clear timed event when remote N(R) > the retransmitted frame
		- send SREJ if:
			- settings.modulo128 is true
			- state.sentREJ is false
			- a properly-sequenced packet has been received this session
			- any out-of-sequence packet is received
		- set state.sentSREJ an SREJ is sent (code is in place to not send REJ if this is true)
		- if settings.modulo128 is true, push received but out-of-sequence I frames into state.receiveBuffer to be handled when previously missed frames have been received
		- push into an array the sequence numbers of frames that have been requested for retransmission via SREJ, splice them out once they have been received, clear state.sentSREJ condition once this array is zero-length
		- schedule timed event for retransmitting SREJ, do not push sequence number into SREJ-request tracking array additional times
		- implement various P/F C/R minutiae and any other remaining portions of the above-mentioned parts of the specification
		- use of SREJ probably doesn't need to hinge on modulo 128 operation; remote capability should be determined by XID parameter negotiation if/when that gets implemented.
		- until XID is implemented, possibly watch for returned SREJ frames in U_FRMR frames from remote, sending plain REJ instead (if that's the expected response)
- Implement XID frame type in Packet.js and Session.js (placeholders currently exist)
	- In ax25.Session, various items such as maxFrames, modulo 128 operation, SREJ compatibility, etc. will need to be refactored, with decisions made based on a store of remote capabilities
- YAPP file transfers in Session or additional submodule
	- Or some other file transfer mechanism if something better came along and has seen some uptake
