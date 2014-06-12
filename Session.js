var util		= require("util");
var events		= require("events");
var ax25		= require("./index.js");

var DISCONNECTED 	= (1<<0),
	CONNECTED 		= (1<<1),
	CONNECTING 		= (1<<2),
	DISCONNECTING 	= (1<<3);

var Session = function(args) {

	var self = this;
	events.EventEmitter.call(this);

	var settings = {
		'window' : 7,
		'packetLength' : 256,
		'timeout' : 5000
	};

	var properties = {
		'remoteCallsign' : "",
		'remoteSSID' : 0,
		'localCallsign' : "",
		'localSSID' : 0,
		'repeaterPath' : []
	};

	var state = {
		'initialized' : false,
		'connection' : DISCONNECTED,
		'receiveSequence' : 0,
		'sendSequence' : 0,
		'remoteReceiveSequence' : 0,
		'remoteBusy' : false
	};

	var emitPacket = function(packet) {
		if(typeof packet == undefined || !(packet instanceof ax25.Packet)) {
			self.emit(
				"error",
				"ax25.Session: Private function 'emitPacket' - invalid packet."
			);
			return;
		}
		self.emit("packet",	packet.assemble());
	}

	this.receive = function(packet) {

		if(!self.initialized) {
			properties.remoteCallsign = packet.sourceCallsign;
			properties.remoteSSID = packet.sourceSSID;
			properties.localCallsign = packet.destinationCallsign;
			properties.localSSID = packet.destinationSSID;
		}

		properties.repeaterPath = [];
		for(var r = packet.repeaterPath.length - 1; r >= 0; r--) {
			// Drop any packet that was meant for a repeater and not us
			if(packet.repeaterPath[r].ssid&A_CRH == 0)
				return false;
			packet.repeaterPath[r].ssid|=(0<<7);
			properties.repeaterPath.push(packet.repeaterPath[r]);
		}

		var response = new ax25.Packet(
			{	'destinationCallsign'	: properties.remoteCallsign,
				'destinationSSID'		: properties.remoteSSID,
				'sourceCallsign'		: properties.localCallsign,
				'sourceSSID'			: properties.localSSID,
				'repeaterPath'			: properties.repeaterPath,
				'nr'					: state.receiveSequence,
				'ns'					: state.sendSequence,
				'pollFinal'				: packet.pollFinal,
				'command'				: (packet.command) ? false : true
			}
		);

		switch(packet.type) {
		
			case ax25.Defs.U_FRAME_SABM:
				// If disconnected, respond with UA
				// If P is 1, set F to 1 in response
				// If connected, reset state numeric values to zero,
				// also resetting nr and ns on any unacknowledged packets; retransmit packets.
				// Set state.connection to CONNECTED
				break;

			case ax25.Defs.U_FRAME_DISC:
				if(state.connection&CONNECTED) {
					// Send UA, with F set to 1 in response if P was set to 1
					// Set state.connection to DISCONNECTED
					// Cancel any timed events
					// Reset state numerics
					break;
				}
				
			case ax25.Defs.U_FRAME_UA:
				if(state.connectiion&CONNECTING) {
					// Set state.connection to CONNECTED
					// Cancel timed event for resending SABM
					break;
				} else if(state.connection&DISCONNECTING) {
					// Set state.connection to DISCONNECTED
					// Cancel timed event for resending DISC
					break;
				} else if(state.connection&CONNECTED) {
					// Initiate resetting procedure:
					// (Essentially reset state and then initiate a new connection)
					// Renumber nr/ns on any unsent or unacknowledged I frames and queue for retransmit
					break;
				}
				
			case ax25.Defs.U_FRAME_UI:
				// Emit 'data' event with payload
				// If P is set to 1, transmit a response:
				// 	- if disconnected, response is a DM frame (do not set F to 1)
				//  - if connected, response is an RR frame ("")
				break;
				
			case ax25.Defs.U_FRAME_DM:
				if(state.connection&CONNECTED) {
					// Initiate resetting procedure:
					// (Reset state and initiate a new connection)
					// Renumber nr/ns on any unsent or unacknowledged I frames and queue for retransmit
					break;
				} else if(state.connection&CONNECTING) {
					// If connecting, cancel connection attempt and do not respond
					// Set state.connection to DISCONNECTED
					break;
				} else if(state.connection&DISCONNECTING) {
					// Set state.connection to DISCONNECTED
					// cancel disconnection attempt and do not respond
					break;
				}
				break;
				
			case ax25.Defs.U_FRAME_FRMR:
				if(state.connection&CONNECTED) {
					// Initiate resetting procedure:
					// (Reset state and initiate a new connection)
					// Renumber nr/ns on any unsent or unacknowledged I frames and queue for retransmit
					break;
				}
				
			case ax25.Defs.S_FRAME_RR:
				if(state.connection&CONNECTED) {
					// If state.remoteBusy is true, set it back to false
					// Discard any saved, transmitted I frames through packet.nr - 1
					// Update state.remoteReceiveSequence
					// Transmit any unsent I frames up to window size
					// If there are no frames to transmit but packet.pollFinal is true, send an RR frame
					break;
				}
				
			case ax25.Defs.S_FRAME_RNR:
				if(state.connection&CONNECTED) {
					// Set state.remoteBusy to true
					// Discard any saved, transmitted I frames through packet.nr - 1
					// Update state.remoteReceiveSequence
					// Cancel any T1 I frame retransmission events
					// Set an event to do an RR poll for remote status
					break;
				}
				
			case ax25.Defs.S_FRAME_REJ:
				if(state.connection&CONNECTED) {
					// Discard any saved, transmitted I frames through packet.nr - 1
					// Update state.remoteReceiveSequence
					// Retransmit any remaining sent and transmit any unsent I frames up to window size
					// If there are no frames to transmit but packet.pollFinal is true, send an RR frame
					break;
				}
				
			case ax25.Defs.I_FRAME:
				if(state.connection&CONNECTED) {
					// If packet.ns equals state.receiveSequence:
					//  - increment state.receiveSequence
					//  - send RR to acknowledge receipt, with PF set to same as packet
					//  - emit data event with packet payload
					// If packet.ns does not equal state.receiveSequence:
					//  - send REJ with PF set to same as packet
					// In any case, update state.remoteReceiveSequence and
					// transmit any outstanding frames up to window size
					break;
				}
				
			default:
				// Fall through default action for all but SABM and UI when disconnected
				response.type = ax25.Defs.U_FRAME_DM;
				response.pollFinal = true;
				break;
				
		}

		if(response instanceof ax25.Packet)
			emitPacket(response);

	}

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;