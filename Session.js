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
		if(typeof packet == undefined || !(packet instanceof ax25.Packet)) {
			self.emit(
				"error",
				"ax25.Session: Private function 'emitPacket' - invalid packet."
			);
			return;
		}
		self.emit("packet",	packet.assemble());
	}

	var clearTimer = function(timerName) {
		if(typeof timers[timerName] != "undefined" && timers[timerName]) {
			clearInterval(timers[timerName]);
			timers[timerName] = false;
		}
		timers[timername + "Attempts"] = 0;
	}

	var receiveAcknowledgement = function(packet) {
		for(var p in state.sendBuffer) {
			if(state.sendBuffer[p].sent && state.sendBuffer[p].ns < packet.nr)
				state.sendBuffer.shift();
		}
		state.remoteReceiveSequence = packet.nr;
		clearTimer("t1");
	}

	var drain = function(retransmit) {
		var ret = false;
		// cycle through sendbuffer
		// if retransmit is on, resend any sent packets
		// emit packets until distance between ns and remote nr == 7 or all packets are sent
		// If any packets were sent, set an RR poll event
		return ret;
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
				clearInterval(timers.connect);
			timers.connectAttempts = 0;
			state.connection = DISCONNECTED;
			return;
		}

		if(!timers.connect)
			timers.connect = setInterval(self.connect, timeout);

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
					'type'					: ax25.Defs.U_FRAME_SABM	
				}
			)
		);

		for(var p = 0; p < state.sendBuffer.length; p++) {
			state.sendBuffer[p].ns = p % 8;
			state.sendBuffer[p].nr = 0;
			state.sendBuffer[p].sent = false;
		}
		
		// Set connect retry event

	}

	this.disconnect = function() {
		// Send a DISC frame
		// set state.connection to DISCONNECTING
		// set a disconnect retry event
	}

	this.send = function(info) {
		// check that info is an array (should really move to Buffers or Uint8Array)
		// while info.length > 0, info.splice 0 through settings.packetLength and stuff
		// the result into the info field of a new I frame, stuff each I frame into the sendBuffer
		// call drain()
	}

	this.sendString = function(str) {
		// check that str is a string
		// convert str to array of bytes
		// this.send(str)
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

		var doDrain = false;
		var doDrainAll = false;

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
				this.emit("connection", true);
				response.type = ax25.Defs.U_FRAME_UA;
				doDrainAll = true;
				break;

			case ax25.Defs.U_FRAME_DISC:
				if(state.connection&CONNECTED) {
					state.connection = DISCONNECTED;
					state.receiveSequence = 0;
					state.sendSequence = 0;
					state.remoteReceiveSequence = 0;
					state.remoteBusy = false;
					clearTimer("connect");
					clearTimer("disconnect");
					clearTimer("t1");
					clearTimer("t3");
					this.emit("connection", false);
					response.type = ax25.Defs.U_FRAME_UA;
					break;
				}
				
			case ax25.Defs.U_FRAME_UA:
				if(state.connection&CONNECTING) {
					state.connection = CONNECTED;
					if(timers.connect)
						clearInterval(timers.connect);
					timers.connectAttempts = 0;
					response = false;
					doDrainAll = true;
					break;
				} else if(state.connection&DISCONNECTING) {
					state.connection = DISCONNECTED;
					if(timers.disconnect)
						clearInterval(timers.disconnect);
					timers.disconnectAttempts = 0;
					response = false;
					break;
				} else if(state.connection&CONNECTED) {
					this.connect();
					response = false;
					break;
				}
				
			case ax25.Defs.U_FRAME_UI:
				this.emit("data", packet.info);
				if(packet.pollFinal) {
					response.pollFinal = false;
					response.type = (state.connection == CONNECTED) ? ax25.Defs.S_FRAME_RR : ax25.Defs.U_FRAME_DM;
				} else {
					response = false;
				}
				break;
				
			case ax25.Defs.U_FRAME_DM:
				if(state.connection&CONNECTED) {
					this.connect();
					response = false;
					break;
				} else if(state.connection&CONNECTING || state.connection&DISCONNECTING) {
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
					this.emit("connection", false);
					break;
				}
				break;
				
			case ax25.Defs.U_FRAME_FRMR:
				if(state.connection&CONNECTED) {
					this.connect();
					response = false;
					break;
				}
				
			case ax25.Defs.S_FRAME_RR:
				if(state.connection&CONNECTED) {
					if(state.remoteBusy)
						state.remoteBusy = false;
					receiveAcknowledgement(packet);
					if(!drain() && packet.pollFinal)
						response.type = ax25.Defs.S_FRAME_RR;
					else
						response = false;
					break;
				}
				
			case ax25.Defs.S_FRAME_RNR:
				if(state.connection&CONNECTED) {
					state.remoteBusy = true;
					receiveAcknowledgement(packet);
					response = false;
					// Set an RR poll event
					break;
				}
				
			case ax25.Defs.S_FRAME_REJ:
				if(state.connection&CONNECTED) {
					receiveAcknowledgement(packet);
					if(packet.pollFinal)
						response.type = ax25.Defs.S_FRAME_RR;
					else
						response = false;
					drain(true);
					break;
				}
				
			case ax25.Defs.I_FRAME:
				if(state.connection&CONNECTED) {
					if(packet.ns == state.receiveSequence) {
						state.receiveSequence = (state.receiveSequence + 1) % 8;
						response.type = ax25.Defs.S_FRAME_RR;
						this.emit("data", packet.info);
					} else {
						response.type = ax25.Defs.S_FRAME_REJ;
					}
					receiveAcknowledgement();
					doDrain = true;
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

		if(doDrainAll)
			drain(true);
		else if(doDrain)
			drain();

	}

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;