var ax25Defs = require("./ax25defs.js").ax25Defs;
var ax25Utils = require("./ax25Utils.js").ax25Utils;

var ax25Session = function(inbound, receiverCallsign, receiverSSID, packet) {

	var properties = {
		'ID'					: 0,
		'inbound'				: false,
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
		"ID",
		function() {
			return properties.ID;
		}
	);

	this.__defineSetter__(
		"ID",
		function(value) {
			if(typeof value != "string")
				throw "ax25Session: invalid ID.";
			properties.ID = value;
		}
	);

	this.__defineGetter__(
		"inbound",
		function() {
			return properties.inbound;
		}
	);

	this.__defineSetter__(
		"inbound",
		function(value) {
			if(typeof value != "boolean")
				throw "ax25Session: invalid inbound assignment.";
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
}

exports.ax25Session = ax25Session;