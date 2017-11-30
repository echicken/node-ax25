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
		'connect' : {
			'event' : undefined,
			'attempts' : 0,
			'callback' : self.connect
		},
		'disconnect' : {
			'event' : undefined,
			'attempts' : 0,
			'callback' : self.disconnect
		},
		't1' : {
			'event' : undefined,
			'attempts' : 0,
			'callback' : function() {
				if(timers.t1.attempts == settings.retries) {
					clearTimer("t1");
					self.connect();
					return;
				}
				timers.t1.attempts++;
				poll();
			}
		},
		't3' : {
			'event' : undefined,
			'attempts' : 0,
			'callback' : function() {
				if(typeof timers.t1.event != "undefined")
					return;
				if(timers.t3.attempts == settings.retries) {
					clearTimer("t3");
					self.disconnect();
					return;
				}
			}
		}
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

	// Milliseconds required to transmit the largest possible packet
	var getMaxPacketTime = function() {
		return Math.floor(
			(	(	(	// Flag + Address + Control + FCS + Flag <= 600 bits
						600
						// Maximum possible information field length in bits
						+ (settings.packetLength * 8)
					// HLDC bits-per-second rate
					) / settings.hBaud
				)
				// To milliseconds
				* 1000
			)
		); // Rounded down
	}

	var getTimeout = function() {
		var multiplier = 0;
		for(var p = 0; p < state.sendBuffer.length; p++) {
			if(!state.sendBuffer.sent)
				continue;
			multiplier++;
		}
		return	(
			(	(	// ms required to transmit alrgest possible packet
					getMaxPacketTime()
					// The number of hops from local to remote
					* Math.max(1, properties.repeaterPath.length)
				// Twice the amount of time for a round-trip
				) * 4
			)
			/*	This isn't great, but we need to give the TNC time to
				finish transmitting any packets we've sent to it before we
				can reasonably start expecting a response from the remote
				side.  A large settings.maxFrames value coupled with a
				large number of sent but unacknowledged frames could lead
				to a very long interval. */
			+ (getMaxPacketTime() * Math.max(1, multiplier))
		);
	}

	var setTimer = function(timerName) {
		if(typeof timers[timerName].event != "undefined")
			clearTimer(timerName);
		timers[timerName].event = setInterval(
			timers[timerName].callback,
			// Le delai de t3 est arbitraire et code en dur, oh ho ho
			((timerName == "t3") ? getTimeout() * 7 : getTimeout())
		);
	}

	var clearTimer = function(timerName) {
		if(typeof timers[timerName].event != "undefined") {
			clearInterval(timers[timerName].event);
			timers[timerName].event = undefined;
		}
		timers[timerName].attempts = 0;
	}

	var receiveAcknowledgement = function(packet) {
		for(var p = 0; p < state.sendBuffer.length; p++) {
			if(	state.sendBuffer[p].sent
				&&
				state.sendBuffer[p].ns != packet.nr
				&&
				ax25.Utils.distanceBetween(
					packet.nr,
					state.sendBuffer[p].ns,
					((settings.modulo128) ? 128 : 8)
				) <= settings.maxFrames
			) {
				state.sendBuffer.splice(p, 1);
				p--;
			}
		}
		state.remoteReceiveSequence = packet.nr;
		if(	typeof timers.t1.event != "undefined"
			&&
			state.sendBuffer.length > 0
		) {
			drain(true);
			return true;
		} else {
			clearTimer("t1");
			return false;
		}
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

	var drain = function(retransmit) {
		if(state.remoteBusy) {
			clearTimer("t1"); // t3 will poll
			return;
		}
		if(typeof retransmit == "undefined")
			retransmit = false;
		var ret = false;
		for(var packet = 0; packet < state.sendBuffer.length; packet++) {
			if(retransmit && state.sendBuffer[packet].sent) {
				state.sendBuffer[packet]
				emitPacket(state.sendBuffer[packet]);
				ret = true;
			} else if(
				!state.sendBuffer[packet].sent
				&&
				ax25.Utils.distanceBetween(
					state.sendSequence,
					state.remoteReceiveSequence,
					((settings.modulo128) ? 128 : 8)
				) < settings.maxFrames
			) {
				state.sendBuffer[packet].ns = state.sendSequence;
				state.sendBuffer[packet].nr = state.receiveSequence;
				state.sendBuffer[packet].sent = true;
				state.sendSequence = (state.sendSequence + 1) % ((settings.modulo128) ? 128 : 8);
				ret = true;
				emitPacket(state.sendBuffer[packet]);
			}
		}
		if(ret)
			setTimer("t1");
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

		//if(!state.initialized) {
		//	self.emit(
		//		"error",
		//		"ax25.Session.connect: localCallsign and remoteCallsign not set."
		//	);
		//}

		state.connection = CONNECTING;
		state.receiveSequence = 0;
		state.sendSequence = 0;
		state.remoteReceiveSequence = 0;
		state.remoteBusy = false;

		clearTimer("disconnect");
		clearTimer("t3");

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

		timers.connect.attempts++;
		if(timers.connect.attempts == settings.retries) {
			clearTimer("connect");
			state.connection = DISCONNECTED;
			return;
		}
		if(typeof timers.connect.event == "undefined")
			setTimer("connect");

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

		if(timers.disconnect.attempts == settings.retries) {
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

		timers.disconnect.attempts++;
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
		if(typeof timers.disconnect.event == "undefined")
			setTimer("disconnect");

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
		var emit = [];

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
				setTimer("t3");
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
				setTimer("t3");
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
					setTimer("t3");
					response = false;
					doDrain = true;
				} else if(state.connection == DISCONNECTING) {
					state.connection = DISCONNECTED;
					clearTimer("disconnect");
					clearTimer("t3");
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
					state.remoteBusy = false;
					if(packet.command && packet.pollFinal) {
						response.type = ax25.Defs.S_FRAME_RR;
						response.pollFinal = true;
					} else {
						response = false;
					}
					doDrain = receiveAcknowledgement(packet);
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
					setTimer("t1");
				} else if(packet.command) {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			case ax25.Defs.S_FRAME_REJ:
				if(state.connection == CONNECTED) {
					state.remoteBusy = false;
					if(packet.command && packet.pollFinal) {
						response.type = ax25.Defs.S_FRAME_RR;
						response.pollFinal = true;
					} else {
						response = false;
					}
					receiveAcknowledgement(packet);
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
					doDrain = receiveAcknowledgement(packet);
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

		if(emit.length == 2)
			this.emit(emit[0], emit[1]);

	}

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;
