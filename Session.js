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

	if(typeof args.packet != "undefined" && args.packet instanceof ax25.Packet) {
		this.remoteCallsign = args.packet.sourceCallsign;
		this.remoteSSID = args.packet.sourceSSID;
		this.localCallsign = args.packet.destinationCallsign;
		this.localSSID = args.packet.destinationSSID;
	} else {
		for(var a in args) {
			if(typeof self[a] == "undefined" || typeof self[a] == "function")
				continue;
			self[a] = args[a];
		}
	}

	this.receive = function(packet) {

	}

	var send = function(packet) {
		if(typeof packet == undefined || !(packet instanceof ax25.Packet))
			throw "ax25.Session: Internal error (private function 'send' - invalid packet.)";
		self.emit("frame", packet.assemble());
	}

	this.send = function(data) {
		if(!(data instanceof Array))
			throw "ax25.Session.send: argument must be array.";
		var packetArgs = {
			'destinationCallsign'	: self.remoteCallsign,
			'destinationSSID'		: self.remoteSSID,
			'sourceCallsign'		: self.localCallsign,
			'sourceSSID'			: self.localSSID,
			'repeaterPath'			: self.repeaterPath,
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

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;