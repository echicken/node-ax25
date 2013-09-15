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
		'awaitingReset'			: false
	}

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
		console.log("Session send() called.");
		if(typeof packet == undefined || !(packet instanceof ax25.Packet))
			throw "ax25.Session: Internal error (private function 'send' - invalid packet.)";
//		self.emit("frame", packet.assemble());
		var cunt = packet.assemble();
		self.emit("frame", cunt);
		console.log("Responding");
		console.log(packet);
	}

	this.send = function(data) {
		if(!(data instanceof Array))
			throw "ax25.Session.send: argument must be array.";
		var packetArgs = {
			'destinationCallsign'	: self.remoteCallsign,
			'destinationSSID'		: self.remoteSSID,
			'sourceCallsign'		: self.localCallsign,
			'sourceSSID'			: self.localSSID,
//			'repeaterPath'			: self.repeaterPath,
			'pollFinal'				: false,
			'command'				: true,
			'type'					: ax25.Defs.I_FRAME,
			'nr'					: self.receiveState,
			'ns'					: self.sendState,
			'pid'					: ax25.Defs.PID_NONE,
			'info'					: data
		};
		var packet = new ax25.Packet(packetArgs);
		send(packet);
	}

	this.sendString = function(str) {
		if(typeof str != "string")
			throw "ax25.Session.sendString: non-string or no data provided.";
		self.send(ax25.Util.stringToByteArray(str));
	}

	this.receive = function(packet) {

		console.log("Session receiving packet.");

//		properties.repeaterPath = [];
//		for(var r = packet.repeaterPath.length - 1; r >= 0; r--) {
//			// Drop any packet that was meant for a repeater and not us
//			if(packet.repeaterPath[r].ssid&A_CRH == 0)
//				return false;
//			packet.repeaterPath[r].ssid|=(0<<7);
//			properties.repeaterPath.push(packet.repeaterPath[r]);
//		}

		var response = new ax25.Packet(
			{	'destinationCallsign'	: properties.remoteCallsign,
				'destinationSSID'		: properties.remoteSSID,
				'sourceCallsign'		: properties.localCallsign,
				'sourceSSID'			: properties.localSSID,
//				'repeaterPath'			: properties.repeaterPath,
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
						response = false;
						break;
					} // Else, fall through to default
					
				case ax25.Defs.U_FRAME_UI:
					if(!packet.pollFinal) {
						response = false;
						break;
					} // Else, fall through to default
			
				default:
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
					break;
					
			}
		
		} else {

		}

//		if(response)
			console.log("Session responding to packet.");
			send(response);

	}

	if(typeof args.packet != "undefined" && args.packet instanceof ax25.Packet) {
		properties.remoteCallsign = args.packet.sourceCallsign;
		properties.remoteSSID = args.packet.sourceSSID;
		properties.localCallsign = args.packet.destinationCallsign;
		properties.localSSID = args.packet.destinationSSID;
		this.receive(args.packet);
	} else {

	}

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;