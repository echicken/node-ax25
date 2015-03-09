var util	= require("util"),
	events	= require("events"),
	ax25	= require("./index.js");

// Magic numbers for state.connection
var DISCONNECTED 	= 1,
	CONNECTED 		= 2,
	CONNECTING 		= 3,
	DISCONNECTING 	= 4;

var Session = function(args) {

	var self = this;
	events.EventEmitter.call(this);

	var settings = {
		'maxFrames' : 4,
		'packetLength' : 256,
		'retries' : 5,
		'hBaud' : 1200,
		'modulo128' : false
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
		'remoteBusy' : false,
		'sentREJ' : false,
		'sentSREJ' : false,
		'sendBuffer' : [],
		'receiveBuffer' : []
	};

	var timers = {
		'connect' : false,
		'connectAttempts' : 0,
		'disconnect' : false,
		'disconnectAttempts' : 0,
		't1' : false,
		't1Attempts' : 0,
		't3' : false,
		't3Attempts' : 0
	};

	this.__defineGetter__(
		"connected",
		function() {
			if(state.connection == CONNECTED)
				return true;
			else
				return false;
		}
	);

	this.__defineGetter__(
		"connection",
		function() {
			return state.connection;
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
			if(!ax25.Utils.testCallsign(value))
				self.emit("error", "ax25.Session.localCallsign: Invalid callsign.");
			if(state.connection != DISCONNECTED)
				self.emit("error", "ax25.Session: Addresses cannot be changed unless disconnected.");
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
				self.emit("error", "ax25.Session.localSSID: Invalid SSID.");
			if(state.connection != DISCONNECTED)
				self.emit("error", "ax25.Session: Addresses cannot be changed unless disconnected.");
			properties.localSSID = value;
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
			if(!ax25.Utils.testCallsign(value))
				self.emit("error", "ax25.Session.remoteCallsign: Invalid callsign.");
			if(state.connection != DISCONNECTED)
				self.emit("error", "ax25.Session: Addresses cannot be changed unless disconnected.");
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
				self.emit("error", "ax25.Session.remoteSSID: Invalid SSID.");
			if(state.connection != DISCONNECTED)
				self.emit("error", "ax25.Session: Addresses cannot be changed unless disconnected.");
			properties.remoteSSID = value;
		}
	);

	this.__defineGetter__(
		"repeaterPath",
		function() {
			return properties.repeaterPath;
		}
	);

	this.__defineSetter__(
		"repeaterPath",
		function(value) {
			if(!Array.isArray(value))
				self.emit("error", "ax25.Session.repeaterPath must be an array.");
			for(var r = 0; r < value.length; r++) {
				if(	typeof value[r] != "object"
					||
					typeof value[r].callsign != "string"
					||
					typeof value[r].ssid != "number"
					||
					!ax25.Utils.testCallsign(value[r].callsign)
					||
					value[r].ssid < 0
					||
					value[r].ssid > 15
				) {
					self.emit(
						"error",
						"ax25.Session.repeaterPath: elements must be { 'callsign', 'ssid' } objects."
					);
				}
			}
			properties.repeaterPath = value;
		}
	);

	this.__defineGetter__(
		"maxFrames",
		function() {
			return settings.maxFrames;
		}
	);

	this.__defineSetter__(
		"maxFrames",
		function(value) {
			if(typeof value != "number" || value < 1 || value > ((settings.modulo128) ? 127 : 7)) {
				self.emit(
					"error",
					"ax25.Session.maxFrames must be a number from 1 through "
					+ (settings.modulo128) ? 127 : 7 + "."
				);
			}
			settings.maxFrames = value;
		}
	);

	this.__defineGetter__(
		"packetLength",
		function() {
			return settings.packetLength;
		}
	);

	this.__defineSetter__(
		"packetLength",
		function(value) {
			if(typeof value != "number" || value < 1)
				self.emit("error", "ax25.Session.packetLength must be a number >= 1.");
			settings.packetLength = value;
		}
	);

	this.__defineGetter__(
		"retries",
		function() {
			return settings.retries;
		}
	);

	this.__defineSetter__(
		"retries",
		function(value) {
			if(typeof value != "number" || value < 1)
				self.emit("error", "ax25.Session.retries must be a number >= 1.");
			settings.retries = value;
		}
	);

	this.__defineGetter__(
		"hBaud",
		function() {
			return settings.hBaud;
		}
	);

	this.__defineSetter__(
		"hBaud",
		function(value) {
			if(typeof value != "number" || value < 1)
				self.emit("error", "ax25.Session.hBaud must be a number >= 1.");
			settings.hBaud = value;
		}
	);

	this.__defineGetter__(
		"modulo128",
		function() {
			return settings.modulo128;
		}
	);

	this.__defineSetter__(
		"modulo128",
		function(value) {
			if(typeof value != "boolean")
				self.emit("error", "ax25.Session.modulo128 must be boolean.");
			settings.modulo128 = value;
		}
	);

	var getTimeout = function() {
		return Math.floor(
			(	(((600 + (settings.packetLength * 8)) / settings.hBaud) * 2)
				* 1000
			) * ((properties.repeaterPath.length > 0) ? properties.repeaterPath.length : 1)
		);
	}

	var emitPacket = function(packet) {
		if(typeof packet == "undefined" || !(packet instanceof ax25.Packet)) {
			self.emit(
				"error",
				"ax25.Session: Private function 'emitPacket' - invalid packet."
			);
			return;
		}
		self.emit("packet",	packet);
	}

	var clearTimer = function(timerName) {
		if(typeof timers[timerName] != "undefined" && timers[timerName]) {
			clearTimeout(timers[timerName]);
			timers[timerName] = false;
		}
		timers[timerName + "Attempts"] = 0;
	}

	var receiveAcknowledgement = function(packet) {
		for(var p in state.sendBuffer) {
			if(	state.sendBuffer[p].sent
				&&
				ax25.Utils.distanceBetween(
					state.sendBuffer[p].ns,
					packet.nr,
					(settings.modulo128) ? 128 : 8
				) < ((settings.modulo128) ? 127 : 7)
			) {
				state.sendBuffer.shift();
			}
		}
		state.remoteReceiveSequence = packet.nr;
		clearTimer("t1");
		drain();
	}

	var poll = function() {
		emitPacket(
			new ax25.Packet(
				{	'destinationCallsign'	: properties.remoteCallsign,
					'destinationSSID'		: properties.remoteSSID,
					'sourceCallsign'		: properties.localCallsign,
					'sourceSSID'			: properties.localSSID,
					'repeaterPath'			: properties.repeaterPath,
					'nr'					: state.receiveSequence,
					'ns'					: state.sendSequence,
					'pollFinal'				: true,
					'command' 				: true,
					'type'					: ax25.Defs.S_FRAME_RR
				}
			)
		);
	}

	var t1Poll = function() {
		if(timers.t1Attempts == settings.retries) {
			clearTimer("t1");
			self.connect();
			return;
		}
		timers.t1Attempts++;
		poll();
	}

	var t3Poll = function() {
		if(typeof timers.t1 != "boolean")
			return;
		if(timers.t3Attempts == settings.retries) {
			clearTimer("t3");
			self.disconnect();
			return;
		}
	}

	var drain = function(retransmit) {
		if(typeof retransmit == "undefined")
			retransmit = false;
		var ret = false;
		for(var packet = 0; packet < state.sendBuffer.length; packet++) {
			if(retransmit && state.sendBuffer[packet].sent) {
				emitPacket(state.sendBuffer[packet]);
				ret = true;
			} else if(
				!state.sendBuffer[packet].sent
				&&
				ax25.Utils.distanceBetween(
					state.sendSequence,
					state.remoteReceiveSequence,
					(settings.modulo128) ? 128 : 8
				) < ((settings.modulo128) ? 127 : 7)
				&&
				packet < settings.maxFrames
			) {
				state.sendBuffer[packet].ns = state.sendSequence;
				state.sendBuffer[packet].nr = state.receiveSequence;
				emitPacket(state.sendBuffer[packet]);
				state.sendBuffer[packet].sent = true;
				state.sendSequence = (state.sendSequence + 1) % ((settings.modulo128) ? 128 : 8);
				ret = true;
			}
		}
		if(ret)
			timers.t1 = setTimeout(poll, getTimeout());
		return ret;
	}

	var renumber = function() {
		for(var p = 0; p < state.sendBuffer.length; p++) {
			state.sendBuffer[p].ns = p % ((settings.modulo128) ? 128 : 8);
			state.sendBuffer[p].nr = 0;
			state.sendBuffer[p].sent = false;
		}
	}

	this.connect = function() {

		if(!state.initialized) {
			self.emit(
				"error",
				"ax25.Session.connect: localCallsign and remoteCallsign not set."
			);
		}

		state.connection = CONNECTING;
		state.receiveSequence = 0;
		state.sendSequence = 0;
		state.remoteReceiveSequence = 0;
		state.remoteBusy = false;

		clearTimer("disconnect");
		clearTimer("t3");

		timers.connectAttempts++;
		if(timers.connectAttempts == settings.retries) {
			timers.connectAttempts = 0;
			state.connection = DISCONNECTED;
			return;
		}

		emitPacket(
			new ax25.Packet(
				{	'destinationCallsign'	: properties.remoteCallsign,
					'destinationSSID'		: properties.remoteSSID,
					'sourceCallsign'		: properties.localCallsign,
					'sourceSSID'			: properties.localSSID,
					'repeaterPath'			: properties.repeaterPath,
					'nr'					: state.receiveSequence,
					'ns'					: state.sendSequence,
					'pollFinal'				: true,
					'command' 				: true,
					'type'					: 
						(settings.modulo128) ? ax25.Defs.U_FRAME_SABME : ax25.Defs.U_FRAME_SABM
				}
			)
		);

		renumber();
		
		timers.connect = setTimeout(self.connect, getTimeout());

	}

	this.disconnect = function() {

		clearTimer('connect');
		clearTimer('t1');
		clearTimer('t3');

		if(state.connection != 2) {
			self.emit("error", "ax25.Session.disconnect: Not connected.");
			state.connection = 1;
			clearTimer('disconnect');
			return;
		}

		if(timers.disconnectAttempts == settings.retries) {
			clearTimer('disconnect');
			emitPacket(
				new ax25.Packet(
					{	'destinationCallsign'	: properties.remoteCallsign,
						'destinationSSID'		: properties.remoteSSID,
						'sourceCallsign'		: properties.localCallsign,
						'sourceSSID'			: properties.localSSID,
						'repeaterPath'			: properties.repeaterPath,
						'nr'					: state.receiveSequence,
						'ns'					: state.sendSequence,
						'pollFinal'				: false,
						'command' 				: false,
						'type'					: ax25.Defs.U_FRAME_DM
					}
				)
			);
			state.connection = DISCONNECTED;
			return;
		}
		timers.disconnectAttempts++;
		state.connection = DISCONNECTING;
		emitPacket(
			new ax25.Packet(
				{	'destinationCallsign'	: properties.remoteCallsign,
					'destinationSSID'		: properties.remoteSSID,
					'sourceCallsign'		: properties.localCallsign,
					'sourceSSID'			: properties.localSSID,
					'repeaterPath'			: properties.repeaterPath,
					'nr'					: state.receiveSequence,
					'ns'					: state.sendSequence,
					'pollFinal'				: true,
					'command' 				: true,
					'type'					: ax25.Defs.U_FRAME_DISC
				}
			)
		);
		timers.disconnect = setTimeout(self.disconnect, getTimeout());
	}

	this.send = function(info) {
		if(!Array.isArray(info))
			this.emit("error", "ax25.Session.send: Argument must be an array.");
		while(info.length > 0) {
			state.sendBuffer.push(
				new ax25.Packet(
					{	'destinationCallsign'	: properties.remoteCallsign,
						'destinationSSID'		: properties.remoteSSID,
						'sourceCallsign'		: properties.localCallsign,
						'sourceSSID'			: properties.localSSID,
						'repeaterPath'			: properties.repeaterPath,
						'pollFinal'				: false,
						'command' 				: true,
						'type'					: ax25.Defs.I_FRAME,
						'info'					: info.splice(0, settings.packetLength)
					}
				)
			);
		}
		drain();
	}

	this.sendString = function(str) {
		if(typeof str != "string")
			this.emit("error", "ax25.Session.sendString: Argument must be a string.");
		if(str.length < 1)
			this.emit("error", "ax25.Session.sendString: Argument of zero length.");
		this.send(ax25.Utils.stringToByteArray(str));
	}

	this.receive = function(packet) {

		if(!state.initialized) {
			properties.remoteCallsign = packet.sourceCallsign;
			properties.remoteSSID = packet.sourceSSID;
			properties.localCallsign = packet.destinationCallsign;
			properties.localSSID = packet.destinationSSID;
			state.initialized = true;
		}

		properties.repeaterPath = [];
		for(var r = packet.repeaterPath.length - 1; r >= 0; r--) {
			// Drop any packet that was meant for a repeater and not us
			if(packet.repeaterPath[r].ssid&ax25.Defs.A_CRH == 0)
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
				'pollFinal'				: false,
				'command'				: (packet.command) ? false : true
			}
		);

		var doDrain = false;
		var emit = false;

		switch(packet.type) {
		
			case ax25.Defs.U_FRAME_SABM:
				state.connection = CONNECTED;
				state.receiveSequence = 0;
				state.sendSequence = 0;
				state.remoteReceiveSequence = 0;
				state.remoteBusy = false;
				clearTimer("connect");
				clearTimer("disconnect");
				clearTimer("t1");
				clearTimer("t3");
				settings.modulo128 = false;
				renumber();
				emit = ["connection", true];
				response.type = ax25.Defs.U_FRAME_UA;
				if(packet.command && packet.pollFinal)
					response.pollFinal = true;
				doDrain = true;
				break;

			case ax25.Defs.U_FRAME_SABME:
				state.connection = CONNECTED;
				state.receiveSequence = 0;
				state.sendSequence = 0;
				state.remoteReceiveSequence = 0;
				state.remoteBusy = false;
				clearTimer("connect");
				clearTimer("disconnect");
				clearTimer("t1");
				clearTimer("t3");
				settings.modulo128 = true;
				renumber();
				emit = ["connection", true];
				response.type = ax25.Defs.U_FRAME_UA;
				if(packet.command && packet.pollFinal)
					response.pollFinal = true;
				doDrain = true;
				break;

			case ax25.Defs.U_FRAME_DISC:
				if(state.connection == CONNECTED) {
					state.connection = DISCONNECTED;
					state.receiveSequence = 0;
					state.sendSequence = 0;
					state.remoteReceiveSequence = 0;
					state.remoteBusy = false;
					clearTimer("connect");
					clearTimer("disconnect");
					clearTimer("t1");
					clearTimer("t3");
					emit = ["connection", false];
					response.type = ax25.Defs.U_FRAME_UA;
				} else {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			case ax25.Defs.U_FRAME_UA:
				if(state.connection == CONNECTING) {
					state.connection = CONNECTED;
					clearTimer("connect");
					response = false;
					doDrain = true;
				} else if(state.connection == DISCONNECTING) {
					state.connection = DISCONNECTED;
					clearTimer("disconnect");
					response = false;
				} else if(state.connection == CONNECTED) {
					this.connect();
					response = false;
				} else {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = false;
				}
				break;
				
			case ax25.Defs.U_FRAME_UI:
				emit = ["data", packet.info];
				if(packet.pollFinal) {
					response.pollFinal = false;
					response.type = (state.connection == CONNECTED) ? ax25.Defs.S_FRAME_RR : ax25.Defs.U_FRAME_DM;
				} else {
					response = false;
				}
				break;
				
			case ax25.Defs.U_FRAME_DM:
				if(state.connection == CONNECTED) {
					this.connect();
					response = false;
				} else if(state.connection == CONNECTING || state.connection == DISCONNECTING) {
					state.connection = DISCONNECTED;
					state.receiveSequence = 0;
					state.sendSequence = 0;
					state.remoteReceiveSequence = 0;
					state.remoteBusy = false;
					clearTimer("connect");
					clearTimer("disconnect");
					clearTimer("t1");
					clearTimer("t3");
					response = false;
					if(state.connection == CONNECTING) {
						settings.modulo128 = false;
						this.connect();
					}
					emit = ["connection", false];
				} else {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			case ax25.Defs.U_FRAME_FRMR:
				if(state.connection == CONNECTING && settings.modulo128) {
					settings.modulo128 = false;
					this.connect();
					response = false;
				} else if(state.connection == CONNECTED) {
					this.connect();
					response = false;
				} else {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;

			// Placeholder pending XID implementation
			case ax25.Defs.U_FRAME_XID:
				response.type = ax25.Defs.U_FRAME_DM;
				break;

			case ax25.Defs.U_FRAME_TEST:
				response.type = ax25.Defs.U_FRAME_TEST;
				if(packet.info.length > 0)
					response.info = packet.info;
				break;
				
			case ax25.Defs.S_FRAME_RR:
				if(state.connection == CONNECTED) {
					if(state.remoteBusy)
						state.remoteBusy = false;
					receiveAcknowledgement(packet);
					if(packet.command && packet.pollFinal) {
						response.type = ax25.Defs.S_FRAME_RR;
						response.pollFinal = true;
					} else {
						response = false;
					}
					doDrain = true;
				} else if(packet.command) {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			case ax25.Defs.S_FRAME_RNR:
				if(state.connection == CONNECTED) {
					state.remoteBusy = true;
					receiveAcknowledgement(packet);
					if(packet.command && packet.pollFinal) {
						response.type = ax25.Defs.S_FRAME_RR;
						response.pollFinal = true;
					} else {
						response = false;
					}
					timers.t1 = setTimeout(poll, getTimeout());
				} else if(packet.command) {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			case ax25.Defs.S_FRAME_REJ:
				if(state.connection == CONNECTED) {
					receiveAcknowledgement(packet);
					if(packet.command && packet.pollFinal) {
						response.type = ax25.Defs.S_FRAME_RR;
						response.pollFinal = true;
					} else {
						response = false;
					}
					drain(true);
				} else {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			case ax25.Defs.I_FRAME:
				if(state.connection == CONNECTED) {
					if(packet.pollFinal)
						response.pollFinal = true;
					if(packet.ns == state.receiveSequence) {
						state.sentREJ = false;
						state.receiveSequence =
							(state.receiveSequence + 1)
							%
							((settings.modulo128) ? 128 : 8);
						response.nr = state.receiveSequence;
						response.type = ax25.Defs.S_FRAME_RR;
						emit = ["data", packet.info];
					} else if(state.sentREJ) {
						response = false;
					} else if(!state.sentREJ) {
						response.type = ax25.Defs.S_FRAME_REJ;
						state.sentREJ = true;
					}
					receiveAcknowledgement(packet);
					doDrain = true;
				} else if(packet.command) {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			default:
				response = false;
				break;
				
		}

		if(response instanceof ax25.Packet)
			emitPacket(response);

		if(doDrain)
			drain();

		if(Array.isArray(emit) && emit.length == 2)
			this.emit(emit[0], emit[1]);

	}

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;