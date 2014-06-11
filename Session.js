var util		= require("util");
var events		= require("events");
var ax25		= require("./index.js");

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
		'connected' : false,
		'connecting' : false,
		'receiveSequence' : 0,
		'sendSequence' : 0,
		'remoteReceiveSequence' : 0
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
				// If connected, reset state{} to initialized, connected, the rest zero,
				// also resetting nr and ns on any unacknowledged packets; retransmit packets.
				break;

			case ax25.Defs.U_FRAME_DISC:
				if(state.connected) {
					// Do things
					break;
				}
				
			case ax25.Defs.U_FRAME_UA:
				if(state.connected) {
					// Do things
					break;
				}
				
			case ax25.Defs.U_FRAME_UI:
				// Do things
				break;
				
			case ax25.Defs.U_FRAME_DM:
				if(state.connected) {
					// Do things
					break;
				} else if(state.connecting) {
					// If connecting, cancel connection attempt and do not respond
					break;
				}
				
			case ax25.Defs.U_FRAME_FRMR:
				if(state.connected) {
					// Do things
					break;
				}
				
			case ax25.Defs.S_FRAME_RR:
				if(state.connected) {
					// Do things
					break;
				}
				
			case ax25.Defs.S_FRAME_RNR:
				if(state.connected) {
					// Do things
					break;
				}
				
			case ax25.Defs.S_FRAME_REJ:
				if(state.connected) {
					// Do things
					break;
				}
				
			case ax25.Defs.I_FRAME:
				if(state.connected) {
					// Do things
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