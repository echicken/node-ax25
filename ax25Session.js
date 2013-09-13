var util		= require("util");
var events		= require("events");
var ax25Defs	= require("./ax25defs.js");
var ax25Utils	= require("./ax25Utils.js");
var ax25Packet	= require("./ax25Packet.js");

var ax25Session = function(args) {

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
			if(typeof value != "string" || !ax25Utils.testCallsign(value))
				throw "ax25Session: invalid remoteCallsign assignment.";
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
			if(typeof value != "string" || !ax25Utils.testCallsign(value))
				throw "ax25Session: invalid localCallsign assignment.";
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

	if(typeof args.frame != "undefined" && args.frame instanceof ax25Packet) {
		this.remoteCallsign = packet.sourceCallsign;
		this.remoteSSID = packet.sourceSSID;
		this.localCallsign = packet.destinationCallsign;
		this.localSSID = packet.destinationSSID;
	} else {
		for(var a in args) {
			if(typeof self[a] == undefined || typeof self[a] == function)
				continue;
			self[a] = args[a];
		}
	}

}
util.inherits(ax25Session, events.EventEmitter);

exports = ax25Session;