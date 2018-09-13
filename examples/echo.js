/*  AX.25 echo server example
Listens for connections on a single TNC destined for a single callsign +
SSID pair, echoes whatever the client sends back to it. 

Removing extreme profanity from comment.  Seriously?
*/

const KISS_TNC = require("kiss-tnc");
const AX25 = require("../index.js");
util = require("util");

var myCallsign = "VE3XEC";
var mySSID = 0;
const tnc = new KISS_TNC("/dev/ttyUSB1", 9600);

var sessions = {};

tnc.on(
	"frame",
	function(frame) {

		var packet = new AX25.Packet();
		packet.disassemble(frame);
		if( packet.destinationCallsign != myCallsign
			||
			packet.destinationSSID != mySSID
		) {
			return;
		}

		console.log(packet.log());

		var clientID = util.format(
			"%s-%s-%s-%s",
			packet.sourceCallsign,
			packet.sourceSSID,
			packet.destinationCallsign,
			packet.destinationSSID
		);

		if (typeof sessions[clientID] == "undefined") {

			sessions[clientID] = new AX25.Session();

			sessions[clientID].on(
				"packet",
				function(frame) {
					console.log(frame.log());
					tnc.send(frame.assemble());
				}
			);

			sessions[clientID].on(
				"data",
				function(data) {
					sessions[clientID].sendString(
						util.format(
							"You sent: %s\r\n",
							AX25.Utils.byteArrayToString(data)
						)
					);
				}
			);

			sessions[clientID].on(
				"connection",
				function(state) {
					console.log(
						util.format(
							"Client %s-%s %s.",
							packet.sourceCallsign,
							packet.sourceSSID,
							(state) ? "connected" : "disconnected"
						)
					);
					if(!state)
						delete sessions[clientID];
				}
			);

			sessions[clientID].on(
				"error",
				function(err) {
					console.log(err);
				}
			);

		}

		if(typeof sessions[clientID] != "undefined")
			sessions[clientID].receive(packet);

	}

);

tnc.on(
	"error",
	function(err) {
		console.log("HURRRRR! I DONE BORKED! " + err);
	}
);
