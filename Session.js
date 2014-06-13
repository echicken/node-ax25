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
		'windowSize' : 7,
		'packetLength' : 256,
		'timeout' : 5000,
		'retries' : 5
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
		'sendBuffer' : []
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

	var emitPacket = function(packet) {
		if(typeof packet == "undefined" || !(packet instanceof ax25.Packet)) {
			self.emit(
				"error",
				"ax25.Session: Private function 'emitPacket' - invalid packet."
			);
			console.log(packet);
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
			if(state.sendBuffer[p].sent && state.sendBuffer[p].ns < packet.nr)
				state.sendBuffer.shift();
		}
		state.remoteReceiveSequence = packet.nr;
		clearTimer("t1");
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
					8
				) < 7
				&&
				packet < settings.windowSize
			) {
				state.sendBuffer[packet].ns = state.sendSequence;
				state.sendBuffer[packet].nr = state.receiveSequence;
				emitPacket(state.sendBuffer[packet]);
				state.sendBuffer[packet].sent = true;
				state.sendSequence = (state.sendSequence + 1) % 8;
				ret = true;
			}
		}
		if(ret)
			timers.t1 = setTimeout(poll, settings.timeout);
		return ret;
	}

	var renumber = function() {
		for(var p = 0; p < state.sendBuffer.length; p++) {
			state.sendBuffer[p].ns = p % 8;
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
		clearTimer("t1");
		clearTimer("t3");

		timers.connectAttempts++;
		if(timers.connectAttempts == settings.retries) {
			if(timers.connect)
				clearTimeout(timers.connect);
			timers.connectAttempts = 0;
			state.connection = DISCONNECTED;
			return;
		}

		timers.connect = setTimeout(self.connect, settings.timeout);

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
					'type'					: ax25.Defs.U_FRAME_SABM	
				}
			)
		);

		renumber();
		
		timers.connect = setTimeout(self.connect, settings.timeout);

	}

	this.disconnect = function() {
		clearTimer('connect');
		clearTimer('t1');
		clearTimer('t3');
		if(timer.disconnectAttempts == settings.retries) {
			clearTimer('disconnect');
			emitPacket(
				new ax25.packet(
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
		timer.disconnectAttempts++;
		state.connection = DISCONNECTING;
		emitPacket(
			new ax25.packet(
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
		timers.disconnect = setTimeout(self.disconnect, settings.timeout);
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
				'pollFinal'				: false,
				'command'				: (packet.command) ? false : true
			}
		);

		var doDrain = false;
		var doDrainAll = false;
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
				renumber();
				emit = ["connection", true];
				response.type = ax25.Defs.U_FRAME_UA;
				if(packet.command && packet.pollFinal)
					response.pollFinal = true;
				doDrainAll = true;
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
				console.log(state.connection);
				if(state.connection == CONNECTING) {
					state.connection = CONNECTED;
					clearTimer("connect");
					response = false;
					doDrainAll = true;
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
					emit = ["connection", false];
				} else {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
				break;
				
			case ax25.Defs.U_FRAME_FRMR:
				if(state.connection == CONNECTED) {
					this.connect();
					response = false;
				} else {
					response.type = ax25.Defs.U_FRAME_DM;
					response.pollFinal = true;
				}
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
					doDrainAll = true;
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
					timers.t1 = setTimeout(poll, settings.timeout);
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
					if(packet.ns == state.receiveSequence) {
						state.receiveSequence = (state.receiveSequence + 1) % 8;
						response.nr = state.receiveSequence;
						response.type = ax25.Defs.S_FRAME_RR;
						emit = ["data", packet.info];
					} else {
						response.type = ax25.Defs.S_FRAME_REJ;
					}
					if(packet.pollFinal)
						response.pollFinal = true;
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

		if(doDrainAll)
			drain(true);
		else if(doDrain)
			drain();

		if(Array.isArray(emit) && emit.length == 2)
			this.emit(emit[0], emit[1]);

	}

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;