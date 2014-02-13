var util		= require("util");
var events		= require("events");
var ax25		= require("./index.js");

var Session = function(args) {

	var self = this;
	events.EventEmitter.call(this);

	var properties = {
		'remoteCallsign'		: "",
		'remoteSSID'			: 0,
		'localCallsign'			: "",
		'localSSID'				: 0,
		'repeaterPath'			: [],
		'receiveState'			: 0,
		'sendState'				: 0,
		'remoteReceiveState'	: 0,
		'remoteSendState'		: 0,
		'timer1'				: 0,
		'timer1Retries'			: 0,
		'timer3'				: 0,
		'timer3Retries'			: 0,
		'errors'				: 0,
		'connected'				: false,
		'connecting'			: false,
		'disconnecting'			: false,
		'rejecting'				: false,
		'remoteBusy'			: false,
		'awaitingReset'			: false,
		'sendBuffer'			: []
	}

	this.__defineGetter__(
		"initialized",
		function() {
			if(properties.remoteCallsign == "")
				return false;
			if(properties.localCallsign == "")
				return false;
			return true;
		}
	);

	this.__defineSetter__(
		"initialized",
		function() {
		}
	);

	this.__defineGetter__(
		"remoteCallsign",
		function() {
			return properties.remoteCallsign;
		}
	);

	this.__defineSetter__(
		"remoteCallsign",
		function(value) {
			if(typeof value != "string" || !ax25.Utils.testCallsign(value))
				throw "ax25.Session: invalid remoteCallsign assignment.";
			properties.remoteCallsign = value;
		}
	);

	this.__defineGetter__(
		"remoteSSID",
		function() {
			return properties.remoteSSID;
		}
	);

	this.__defineSetter__(
		"remoteSSID",
		function(value) {
			if(typeof value != "number" || value < 0 || value > 15)
				throw "ax25.Session: invalid remoteSSID assignment";
			properties.remoteSSID = value;
		}
	);

	this.__defineGetter__(
		"localCallsign",
		function() {
			return properties.localCallsign;
		}
	);

	this.__defineSetter__(
		"localCallsign",
		function(value) {
			if(typeof value != "string" || !ax25.Utils.testCallsign(value))
				throw "ax25.Session: invalid localCallsign assignment.";
			properties.localCallsign = value;
		}
	);

	this.__defineGetter__(
		"localSSID",
		function() {
			return properties.localSSID;
		}
	);

	this.__defineSetter__(
		"localSSID",
		function(value) {
			if(typeof value != "number" || value < 0 || value > 15)
				throw "ax25.Session: invalid remoteSSID assignment";
			properties.localSSID = value;
		}
	);

	this.__defineGetter__(
		"connected",
		function() {
			return properties.connected;
		}
	);

	this.__defineSetter__(
		"connected",
		function() {}
	);

	var send = function(packet) {
		if(typeof packet == undefined || !(packet instanceof ax25.Packet))
			throw "ax25.Session: Internal error (private function 'send' - invalid packet.)";
		self.emit("frame", packet.assemble());
	}

	this.send = function(data) {
		if(!(data instanceof Array))
			throw "ax25.Session.send: argument must be array.";
		var packetArgs = {
			'destinationCallsign'	: properties.remoteCallsign,
			'destinationSSID'		: properties.remoteSSID,
			'sourceCallsign'		: properties.localCallsign,
			'sourceSSID'			: properties.localSSID,
			'repeaterPath'			: properties.repeaterPath,
			'pollFinal'				: false,
			'command'				: true,
			'type'					: ax25.Defs.I_FRAME,
			'nr'					: properties.receiveState,
			'ns'					: properties.sendState,
			'pid'					: ax25.Defs.PID_NONE,
			'info'					: data
		};
		var packet = new ax25.Packet(packetArgs);
		properties.sendBuffer.push(packet);
		drain();
	}

	this.sendString = function(str) {
		if(typeof str != "string")
			throw "ax25.Session.sendString: non-string or no data provided.";
		self.send(ax25.Utils.stringToByteArray(str));
	}

	var drain = function() {
		var ret = false;
		while(
			ax25.Utils.distanceBetween(properties.sendState, properties.remoteReceiveState, 8) < 7
			&&
			properties.sendBuffer.length > 0
		) {
			ret = true;
			send(properties.sendBuffer.shift());
			properties.sendState = (properties.sendState + 1) % 8;
		}
		return ret;
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
				'nr'					: properties.receiveState,
				'ns'					: properties.sendState,
				'pollFinal'				: packet.pollFinal,
				'command'				: (packet.command) ? false : true
			}
		);

		if(!properties.connected) {
		
			switch(packet.type) {
			
				case ax25.Defs.U_FRAME_SABM:
					properties.connected = true;
					response.type = ax25.Defs.U_FRAME_UA;
					break;
					
				case ax25.Defs.U_FRAME_UA:
					if(properties.connecting) {
						properties.connected = true;
						properties.connecting = false;
						response = false;
						break;
					}
					
				case ax25.Defs.U_FRAME_UI:
					if(!packet.pollFinal) {
						response = false;
						break;
					}
			
				default:
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
					break;
					
			}
		
		} else {

			switch(packet.type) {
			
				case ax25.Defs.U_FRAME_SABM:
					properties.connected = true;
					response.type = ax25.Defs.U_FRAME_UA;
					break;

				case ax25.Defs.U_FRAME_DISC:
					self.emit("disconnect");
					response.type = ax25.Defs.U_FRAME_UA;
					properties.connected = false;
					break;
					
				case ax25.Defs.U_FRAME_UA:
					if(properties.connecting || properties.disconnecting)
						properties.connected = (properties.connecting) ? true : false;
					response = false;
					break;
					
				case ax25.Defs.U_FRAME_UI:
					self.emit("data", packet);
					if(packet.pollFinal) {
						response.type = ax25.Defs.S_FRAME_RR;
						response.nr = properties.receiveState;
					} else {
						response = false;
					}
					break;
					
				case ax25.Defs.U_FRAME_DM:
					self.emit("disconnect");
					properties.connected = false;
					response = false;
					break;
					
				case ax25.Defs.U_FRAME_FRMR:
					response = false;
					break;
					
				case ax25.Defs.S_FRAME_RR:
					properties.remoteReceiveState = packet.nr;
					drain();
					response = false;
					break;
					
				case ax25.Defs.S_FRAME_RNR:
					properties.remoteReceiveState = packet.nr;
					response = false;
					break;
					
				case ax25.Defs.S_FRAME_REJ:
					properties.remoteReceiveState = packet.nr;
					response = false;
					break;
					
				case ax25.Defs.I_FRAME:
					properties.remoteReceiveState = packet.nr;
					if(packet.ns == properties.receiveState) {
						self.emit("data", packet);
						properties.receiveState = (properties.receiveState + 1) % 8;
						if(drain()) {
							response = false;
						} else {
							response.type = ax25.Defs.S_FRAME_RR;
							response.nr = properties.receiveState;
						}
					} else {
						response.type = ax25.Defs.S_FRAME_REJ;
						response.nr = properties.receiveState;
					}
					break;
					
				default:
					response = false;
					break;
					
			}

		}

		if(response instanceof ax25.Packet)
			send(response);

	}

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;