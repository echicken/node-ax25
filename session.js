'use strict';
const EventEmitter = require('events');
const path = require('path');
const masks = require(path.join(__dirname, 'masks.js'));
const packet = require(path.join(__dirname, 'packet.js'));


// XXX TODO
//
// * Sort out timers. I don't really like the way they're done.
//     t1: time varies, timeout action varies, giveup action varies
//     t2: always has the same time, always runs once, always ends with drain()
//     t3: always has the same time, timeout is always sendRR, giveup always is
//         disconnect
//     XXX Right now, when the t3 expires, we send an RR, but don't start
//         a timer after that. That doesn't seem right.
// * Sort out the remote_busy/drain scenario. See the notes in drain().
// * Double-check all the poll_final and command settings
// * Handle XID packets, both sending and receiving
// * Selective vs Implicit Reject: handle REJ vs SREJ, both send and recv sides


const DISCONNECTED  = 0;
const CONNECTING    = 1;
const CONNECTED     = 2;
const DISCONNECTING = 4;

const MAX_PKT_HEADER_BITS = 600; // Flag + Address + Control + FCS + Flag bits

// Find the difference between 'leader' and 'follower' modulo 'modulus'.
function distance_between(l, f, m) {
    return (l < f) ? (l + (m - f)) : (l - f);
}

class SessionTimer {

    // Gah. Weird-ass javascript scoping. 'let' and 'static' variables
    // defined in the constructor are only available to methods defined
    // in the constructor. So to mimic private variables we stuff pretty
    // much everything into it.
    //
    // variables defines as "this.variablename" are publicly accessible
    // as usual.
    constructor(on_alarm=null, on_timeout=null, interval=1, repetitions=1) {
        let _evt = null;
        let _running = false;
        let _interval = 1;
        let _repetitions = 1;
        let _on_alarm = null;
        let _on_timeout = null;
        if (typeof interval == "number") _interval = interval;
        if (typeof repetitions == "number") _repetitions = repetitions;
        if (typeof on_alarm == "function") _on_alarm = on_alarm;
        if (typeof on_timeout == "function") _on_timeout = on_timeout;

        this.stop = function() {
            if (_running) {
                clearInterval(_evt);
                _running = false;
            }
        }

        this.start = function(on_alarm=null, on_timeout=null, interval=1) {
            stop();
            let repetition = 0;
            if (typeof on_alarm == "function") _on_alarm = on_alarm;
            if (typeof on_timeout == "function") on_timeout = on_timeout;
            _evt = setInterval(
                () => {
                    if (repetition < repetitions) {
                        repetition++;
                        if (on_alarm) on_alarm();
                    } else {
                        this.stop();
                        if (on_timeout) on_timeout();
                    }
                }, interval
            );
            _running = true;
        }

        Object.defineProperty(this, 'running', { get : () => _running });
    }

}


class Session extends EventEmitter {

    //
    // Constructor
    // 
    constructor(baud=1200, ack_time=3000, max_frames=4, 
            max_iframe_data=256, retries=10, selective_reject=false,
            full_duplex=false, modulo128=false) {

        super();

        // definitely private
        const _properties = {
            baud            : 1200,   // this determines the timer values
            ack_time        : 3000,   // acknowledgement timer wait time
            link_poll_time  : 10000,  // inactive link poll timer (msec)
            max_frames      : 7,      // max IFrames outstanding (k)
                                      // also called window size
            max_iframe_data : 256,    // max octets in the I field (n1)
            retries         : 10,     // max number of retries (n2)
            selective_reject: false,  // use SREJ or regular ol' REJ frames?
            full_duplex     : false,  // fd
            modulo          : 128,    // md
            ax25_version    : 2.2,    // We start by sending SABM and XID frames
            destination     : { callsign : '', ssid : 0 },
            source          : { callsign : '', ssid : 0 },
            repeater_path   : [],
            protocol_id     : masks.pid.none,
        };

        // Consider this private. This is used a lot internally
        // and I don't want to make accessors for it because
        // that might encourage people to try to change it. So I'm
        // just going to leave it in class scope (as opposed to
        // constructor scope).
        this._state = {
            'initialized' : false,
            'connection' : DISCONNECTED,
            'receive_sequence' : 0,
            'send_sequence' : 0,
            'remote_receive_sequence' : 0,
            'remote_busy' : false,
            'sent_REJ' : false,
            'remote_REJ_seqno' : -1,
        };

        // private queue for holding packets waiting to be sent.
        this._sendQueue = [];

        // properties accessor glue functions
        this._set = function(property, value) {
            if (typeof _properties[property] == 'undefined') {
                throw `Invalid property ${property}`;
            }
            _properties[property] = value;
        }

        this._get = function(property) {
            if (typeof _properties[property] == 'undefined') {
                throw `Invalid property ${property}`;
            }
            return _properties[property];
        }

        // set the internal properties
        _properties.baud = baud;
        _properties.ack_time = ack_time;
        _properties.max_iframe_data = max_iframe_data;
        _properties.retries = retries;
        _properties.selective_reject = selective_reject;
        _properties.full_duplex = full_duplex;
        _properties.modulo = modulo128 ? 128 : 8;

        // timers. define these after the _get() function above because
        // these use that and it's not automatically hoisted.
        this._t1_timer = new SessionTimer(this.sendRR, this.resetLink,
                                        this.t1interval, this.retries);
        this._t2_timer = new SessionTimer(null, this.drain, this.t2interval);
        this._t3_timer = new SessionTimer(this.sendRR, this.disconnect,
                                        this.t3interval, this.retries);


    }

    get isConnected() {
        if (this._state.connection == CONNECTED)
            return true;
        else
            return false;
    }

    get baud() {
        return this._get('baud');
    }

    set baud(value) {
        if (typeof value != "number" || value < 1)
            throw 'baud must be a number >= 1';
        this._set('baud', value);
    }

    get ack_time() {
        return this._get('ack_time');
    }

    set ack_time(value) {
        if (typeof value != "number" || value < 1)
            throw 'ack_time must be a number >= 1';
        this._set('ack_time', value);
    }

    get link_poll_time() {
        return this._get('link_poll_time');
    }

    set link_poll_time(value) {
        if (typeof value != "number" || value < 1)
            throw 'link_poll_time must be a number >= 1';
        this._set('link_poll_time', value);
    }

    get max_frames() {
        return this._get('max_frames');
    }

    set max_frames(value) {
        if (typeof value != "number" || 
                value < 1 ||
                value > (settings.modulo - 1)) {
            throw 'max_frames must be a number from 1 through ' 
                        + (settings.modulo -1);
        }
        this._set('max_frames', value);
    }

    get max_iframe_data() {
        return this._get('max_iframe_data');
    }

    set max_iframe_data(value) {
        if (typeof value != "number" || value < 1)
            throw 'max_iframe_data must be a number >= 1';
        this._set('max_iframe_data', value);
    }

    get retries() {
        return this._get('retries');
    }

    set retries(value) {
        if (typeof value != "number" || value < 1)
            throw 'retries must be a number >= 1';
        this._set('retries', value);
    }


    get selective_reject() {
        return this._get('selective_reject');
    }

    set selective_reject(value) {
        if (typeof value != "boolean")
            throw 'selective_reject must be boolean';
        this._set('selective_reject', value);
    }

    get modulo128() {
        return ((this._get('modulo128') == 128) ? true : false);
    }

    set modulo128(value) {
        if(typeof value != "boolean")
            throw 'modulo128 must be boolean';
        this._set('modulo128', value ? 128 : 8);
    }

    get destination() {
        return this._get('destination');
    }

    set destination(value) {
        if (this._state.connection != DISCONNECTED) {
            throw 'Callsigns cannot be changed unless disconnected';
        } else if (!validate_address(value)) {
            throw `Invalid destination ${value}`;
        } else {
            this._set('destination', value);
        }
    }

    get source() {
        return this._get('source');
    }

    set source(value) {
        if (this._state.connection != DISCONNECTED) {
            throw 'Callsigns cannot be changed unless disconnected';
        } else if (!validate_address(value)) {
            throw `Invalid source ${value}`;
        } else {
            this._set('source', value);
        }
    }

    get repeater_path() {
        return this._get('repeater_path');
    }

    set repeater_path(value) {
        if (this._state.connection != DISCONNECTED) {
            throw 'The repeater path cannot be changed unless disconnected';
        } else if (typeof value != 'object' || !Array.isArray(value)) {
            throw `Invalid repeater_path ${value}`;
        } else if (!value.every(validate_address)) {
            throw `Invalid repeater_path entry ${e}`;
        } else {
            this._set('repeater_path', value);
        }
    }

    get protocol_id() {
        return this._get('protocol_id');
    }

    set protocol_id(value) {
        if (typeof value != 'number' || value < 0 || value > 255) {
            throw `Invalid protocol_id ${value}`;
        } else {
            this._set('protocol_id', value);
        }
    }

    sendQueueLength(unsentOnly=false) {
        if (unsentOnly) {
            let count = 0;
            this.sendQueue.forEach(pkt => {
                if (pkt.sent) count++;
            });
            return count;
        } else {
            return sendQueue.length;
        }
    }

    // Rough estimate of milliseconds required to send all the data in
    // the sendQueue. Used to calculate the t1 timer.
    sendQueueSendTime(unsentOnly=true) {
        let packet_bits = 0;
        this.sendQueue.forEach(pkt => {
            if (!unsentOnly || !pkt.sent)
                packetbits += (pkt.payload.byteLength * 8) + MAX_PKT_HEADER_BITS;

        });
		return Math.floor((packet_bits/this.settings.baud)*1000);
    }

	// Milliseconds required to transmit the largest possible packet.
    // With a 256-byte packet (2048 butes):
    //   At 1200 baud, it works out to about 2.2 seconds.
    //   At 4800 baud, it works out to about 0.55 seconds
	maxPacketSendTime() {
        let packet_bits = MAX_PKT_HEADER_BITS + (this.max_iframe_data * 8);
		return Math.floor((packet_bits/this.settings.baud)*1000);
	}

    t1interval() {
        // this varies depending on how many items are in the send queue
        return sendQueueSendTime(false) + this.ack_time;
    }

    t2interval() {
        return (this.maxPacketSendTime * 2);
    }

    t3interval() {
        return this.link_poll_time;
    }

    //
    // Send side stuff
    // 

    // This is our low-level send routine. Everything that wants to send a
    // packet calls into this.
	emitPacket(packet) {
		if (typeof packet == "undefined" || !(packet instanceof Packet)) {
            throw 'emitPacket - Invalid packet';
		}
		this.emit("packet",	packet);
	}

    // create a brand new packet. 
    createPacket(type, poll_final=false, command=false, payload=false) {
        let packet =  new Packet(this._properties.modulo);
        packet.destination = this.destination;
        packet.source = this.source;
        packet.repeater_path = this.repeater_path;
        packet.protocal_id = this.protocol_id;

        packet.receive_sequence = this._state.receive_sequence;
        packet.send_sequence = this._state.send_sequence;

        packet.type = type;
        packet.poll_final = poll_final;
        packet.command = command;
        if (payload) {
            packet.payload = payload;
        }

        return packet;
    }

    resetConnectionState() {
        stopAllTimers();
        this._state.connection = DISCONNECTED;
        this._state.receive_sequence = 0;
        this._state.send_sequence = 0;
        this._state.remote_receive_sequence = 0;
        this._state.remote_REJ_seqno = -1;
        this._state.remote_busy = false;
        this._sendQueue.length = 0;
    }

    // Send an RR (Receive Ready) packet. This happens every time we've
    // drained our sendQueue (at least as much as we're going to in this
    // go-round, and we'd like the other side to confirm that they got it.
    // It's sent at the end of a drain and whenever the t1 timer expires.
    //
    // Default to true because when the t1 timer expires it needs to
    // call this as true.
    // 
	sendRR(pollFinal=true) {
		emitPacket(createPacket(masks.control.frame_types.s_frame.subtypes.rr,
                                pollFinal, true));
	}


    // Send the packets in the out queue.
    //
    // There three ways to get there:
    //    1) We called send
    //    2) The T2 timer expired while waiting for a batch of incoming
    //       packets and we want to send what we've got
    //    3) The T3 timer was started after having gotten an RNR packet
    //       from the remote.
    //
    // If the REJ sequence number is set, we resend outstanding
    // packets and any new packets (up to max_frames)
    //
    // Otherwise, we just send new packets (up to max_frames)
	drain() {
        // If T2 is running, we don't do anything and wait for T2 to expire.
        // In that case, we just got a packet from the remote and we're
        // waiting to see if we can coalesce a bunch into one response.
        // So...wait a little longer before we start talking.
        if (this._t2_timer.running)
            return;

        // We got an RNR (Remote Not Ready) frame from the remote earlier.
        // In that case the t3 timer is running, and we shouldn't do anything
        // until it times out and sends an RR, querying the remote to
        // see if it's ready to receive again. If we get another RNR it'll
        // just start the t3 all over again. If not, it'll call into here
        // and we'll drain at that point.
		if (this._state.remote_busy) {
			return;
		}
        
        let sequenceNum = this._state.send_sequence;
        if (this._state.remote_REJ_seqno > 0) {
            sequenceNum = this._state.remote_REJ_seqno;
        }

        // send the packets. Note that we don't actually remove them from
        // the send queue, we just flag them as sent.
		let startTimer = false;
        this.sendQueue.forEach(pkt => {
			if (distance_between(
					sequenceNum,
					this._state.remote_receive_sequence,
                    this.settings.modulo
				) < this.settings.max_frames
			) {
				pkt.receive_sequence = this._state.receive_sequence;
                if (!pkt.sent) {
                    pkt.send_sequence = this._state.send_sequence;
                    pkt.sent = true;
                    this._state.send_sequence = 
                        (this._state.send_sequence + 1) % this.settings.modulo;
                }
				startTimer = true;
				emitPacket(pkt);
                
                sequenceNum = (sequenceNum + 1) % settings.modulo;
			}
		});
        
        // if we have no rejects but we have nothing new to send, just
        // send an RR
        if ((this._state.remote_REJ_seqno < 0) && !startTimer) {
            this.sendRR(false);
            startTimer = true;
        }
        
        // reset the REJ sequence number
        this._state.remote_REJ_seqno = -1;
        
		if (startTimer)
            this._t1_timer.start(this.sendRR, this.resetLink, this.t1interval);
	}

	renumber() {
        // iterate over this the old fashioned way because we need to know
        // what the index into the array is anyway.
		for (let p = 0; p < this.sendQueue.length; p++) {
			this.sendQueue[p].send_sequence = p % settings.modulo;
			this.sendQueue[p].receive_sequence = 0;
			this.sendQueue[p].sent = false;
		}
	}

	receiveAcknowledgement(packet) {
        
        // first, scan the sent packets. If it's a packet we've already
        // sent and it's earlier than the incoming packet's receive seqno,
        // it was received successfully and we can discard it.
		for (var p = 0; p < this.sendQueue.length; p++) {
			if (this.sendQueue[p].sent
				&&
				this.sendQueue[p].send_sequence != packet.receive_sequence
				&&
				distance_between(
					packet.receive_sequence,
					this.sendQueue[p].send_sequence,
                    this.settings.modulo
				) <= this.settings.max_frames
			) {
                // remove the packet
				this.sendQueue.splice(p, 1);
				p--;
			}
		}
        
        // set the current receive to the received packet's seqno
		this._state.remote_receive_sequence = packet.receive_sequence;
	}


    // Connect (6.3.1)
    //
    // Initiate the connection from here by sending a SABM packet.
    // (Set Asynchronous Balanced Mode Frame)
    //
    // This starts a connect timer.
    //
    connect() {

        // XXX move this validation elsewhere.
		if (!this._state.initialized) {
            if (this.remoteCallsign.length > 0 && this.remoteSSID > 0
               && this.localCallsign.length > 0 && this.localSSID > 0) {
                this._state.initialized = true;
            } else {
                throw 'localCallsign/SSID or remoteCallsign/SSID not set';
            }
		}

        resetConnectionState();
        this._state.connection = CONNECTING;

        let pktType = (settings.modulo == 128) ? 
                    masks.control.frame_types.u_frame.subtypes.sabme :
                    masks.control.frame_types.u_frame.subtypes.sabm;
		emitPacket(createPacket(pktType, true, true));

        // (Re)start the connect timer
        this._t1_timer.start(this.connect, this.connectFailed, this.t1interval);
	}

    // Called by the timer callback if the remote never replies to our
    // connect SABM/SABME
    connectFailed() {
        this.stopAllTimers();
        this._state.connection = DISCONNECTED;
    }

    // Disconnect (6.3.4)
    //
    // Send a DISC packet and then start the disconnect timer (which is
    // supposed to have the same timing as the t1 timer).
    // If the t1 times out, we retry a few times and then give up and sent
    // out a DM packet and shut everything down.
    // 
    // If the other side gets this, we should get a DM packet from them
    // which is handled by the receive state machine.
    //
    // XXX The top layer shouldn't call this without checking to see if the
    // the sendQueue is empty (via session.sendQueueLength()) or packets
    // in the queue won't get sent.
    //
    disconnect() {
        // if we're not connected, this isn't really an error, but we
        // should blab about it.
		if (this._state.connection != CONNECTED) {
			console.log("ax25.Session.disconnect: Not connected.");
            // stop the send timer in case we started connecting and then
            // were told to stop before we actually connected.
            this.stopAllTimers();
			this._state.connection = DISCONNECTED;
			return;
		}

		this._state.connection = DISCONNECTING;
        this.sendQueue.length = 0;

		emitPacket(createPacket(masks.control.frame_types.u_frame.subtypes.disc,
                                true, true));

        // (Re)start the disconnect timer
        this._t1_timer.start(this.disconnect, this.disconnectFailed, this.t1interval);
	}

    // Called by the timer callback if the remote never replies
    // send a DM for kicks, and then go to sleep.
    disconnectFailed() {
        // XXX double check the poll_final and command values. Are they
        // supposed to be false, false?
		emitPacket(createPacket(masks.control.frame_types.u_frame.subtypes.dm,
                                false, false));

        stopAllTimers();
        this._state.connection = DISCONNECTED;
    }

    // Reset the link when T1 completely times out, or if there's an
    // unexpected UA frame, or if there's an FRMR frame from an older
    // protocal TNC. Section 6.5
    resetLink() {
        // not sure there's anything special to do here before trying
        // the SABM/SABME all over again.
        this.connect();
    }

    // Add a new IFrame packet to our send queue.
    // "data" is the data to go into the Iframe.
    // If it won't all fit, we'll create multiple packets and shove them in
    // one-by-one.
    send(data, encoding = 'utf8') {

        if (Array.isArray(data) || data instanceof ArrayBuffer) {
            data = Buffer.from(data);
        } else if (typeof data == 'string') {
            data = Buffer.from(data, encoding);
        }

		while (data.byteLength) {
		    let pkt = createPacket(masks.control.frame_types.i_frame,
                            false, true, data.slice(0, this.max_iframe_data));
			this._sendQueue.push(pkt);
            data = data.slice(this.max_iframe_data);
		}
        
        // Ok, now try to send them. If the t2 timer is running this will
        // just do nothing and we'll send them later. If it's not running,
        // this will start the send process.
        drain();
	}


    // Receive
    //
    receive(packet) {
        // XXX Should we require the app to specify our address and
        // just use that, ignoring any packets that aren't for us?
        // Or should we leave that filtering up to the application layer?
		if (!this._state.initialized) {
			this.destination = packet.source;
            this.source = packet.destination;
			this._state.initialized = true;
		}

        // pull the repeater path from the incoming packet and reverse
        // it so it's handily available for any outbound packets we
        // want to send.
        let repeaterPath = [];
        while (packet.repeaterPath.length - 1) {
            let address = packet.repeaterPath.shift();
			// Drop any packet that was meant for a repeater and not us
            if (address.ssid & masks.address.crh) {
                return false;
            }
			address.ssid |= (0<<7);
			repeaterPath.push(address);
        }
        this.repeaterPath = repeaterPath;

        let response = null;

		let emit = [];

		switch (get_frame_type_name(packet.type)) {
		
            // Set Asynchronous Balanced Mode, aka Connect in 8-frame
            // mode (4.3.3.1). If we're not connected, this will initiate
            // the connection. If we are connected, this will reset it and
            // and outstand IFrames get tossed.
            // Theoretically we can send a DM frame if we don't want to
            // accept this, but why wouldn't we?
			case 'u_frame_sabm':
                resetConnectionState();
				this._state.connection = CONNECTED;
				settings.modulo = 8; // SABM means old version of protocol
				renumber();
				emit = ["connection", true];
		        response = createPacket(
                    masks.control.frame_types.u_frame.subtypes.ua,
                    packet.poll_final,
                    true)
				break;

            // Connect Extended (128-frame mode) (4.3.3.2). As with the
            // SABM, if we're not connected this will initiate the connection.
            // If we are connected, this will reset it and and outstand IFrames
            // get tossed.
            // Theoretically we can send a DM frame if we don't want to
            // accept this, but why wouldn't we?
			case 'u_frame_sabme':
                resetConnectionState();
				this._state.connection = CONNECTED;
				settings.modulo = 128; // SABME means newer version of protocol
				renumber();
				emit = ["connection", true];
		        response = createPacket(
                    masks.control.frame_types.u_frame.subtypes.ua,
                    packet.poll_final,
                    true);
				break;

            // Disconnect (4.3.3.3). This is fairly straightforward.
            // If we're connected, reset our state, send a disconnect message,
            // and let the upper layer know the remote disconnected.
            // If we're not connected, reply with a WTF? (DM) message.
			case 'u_frame_disc':
				if (state.connection == CONNECTED) {
                    resetConnectionState();
                    this.emit("connection", false);
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.ua,
                        packet.poll_final,
                        true);
				} else {
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        true,
                        true);
				}
                break;
				
            // Unnumbered Acknowledge (4.3.3.4). We get this in response to
            // SABM(E) packets and DISC packets. It's not clear what's supposed
            // to happen if we get this when we're in another state. Right now
            // if we're connected, we ignore it.
			case 'u_frame_ua':
				if (state.connection == CONNECTING) {
                    // finish the connect
					this._state.connection = CONNECTED;
                    this._t1_timer.stop();
                    this._t3_timer.start();
                    emit = ["connection", true];
				} else if (state.connection == DISCONNECTING) {
                    // finish the disconnect
					this._state.connection = DISCONNECTED;
                    stopAllTimers();
                    emit = ["connection", false];
				} else if (state.connection == CONNECTED) {
					this._state.remote_busy = false;
                    // ignore it otherwise.
					//this.connect();
				} else {
                    // we're disconnected and got a UA. Send a Disconnected
                    // Mode response. (4.3.3.5)
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        packet.poll_final,
                        true);
				}
				break;
			
            // Disconnected Mode (4.3.3.5).
            // If we're connected and we get this, the remote hasn't gone
            // through the whole connection process. It probably missed part
            // of the connection frames or something. So...start all
            // over and retry the connection.
            // If we think we're in the middle of setting up a connection and
            // get this, something got out of sync with the remote and it's
            // confused - maybe it didn't hear a disconnect we we sent, or
            // it's replying to a SABM saying it's too busy. If we're trying
            // to disconnect and we get this, everything's cool. Either way,
            // we transition to disconnected mode.
            // If we get this when we're unconnected, we send a WTF? (DM)
            // message as a reply.
			case 'u_frame_dm':
				if (state.connection == CONNECTED) {
					this.connect();
				} else if(state.connection == CONNECTING || state.connection == DISCONNECTING) {
                    resetConnectionState();
					if (state.connection == CONNECTING) {
                        // reconnect in old mode
						this._settings.modulo = 8;
						this.connect();
					}
					emit = ["connection", false];
				} else {
					this._state.remote_busy = false;
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        packet.poll_final,
                        true);
				}
				break;
		
            // Unnumbered Information (4.3.3.6). We send this to the upper
            // layer as an out-of-band UI packet, but if the pollfinal flag
            // is set internally we fabricate a response for it.
            //
            // XXX handle "uidata" at upper layer - make note of this in the
            // docs.
			case 'u_frame_ui':
                this._state.remote_busy = false;
				if (packet.pollFinal) {
                    let type = this._state.connection == CONNECTED ?
                        masks.control.frame_types.u_frame.subtypes.rr :
                        masks.control.frame_types.u_frame.subtypes.dm;
                    response = createPacket(type, false, true);
				}
				emit = ["uidata", packet.info];
				break;

			// Exchange Identification (4.3.3.7). Placeholder pending XID
            // implementation.
			case 'u_frame_xid':
                // XXX read the sent XID parameters and change our settings
                // as needed. Fabricate a response if this was initiated
                // by the remote. If we sent a XID earlier and this is a
                // reply to it, we don't worry about sending a reply.
                this._state.remote_busy = false;
                xidData = Buffer.concat("");
                response = createPacket(
                    masks.control.frame_types.u_frame.subtypes.xid,
                    false,
                    true,
                    xidData);
				break;

            // Test (4.3.3.8). Echo back a test response.
			case 'u_frame_test':
                this._state.remote_busy = false;
                response = createPacket(
                    masks.control.frame_types.u_frame.subtypes.test,
                    packet.poll_final,
                    true,
                    packet.payload);
				break;
			
            // Frame Recovery message. (4.3.3.9). This was removed from the
            // AX25 standard, and if we get one we've got an old client and
            // just supposed to reset the link and possibly reconnect as
            // modulo8.
			case 'u_frame_frmr':
                this._state.remote_busy = false;
				if(state.connection == CONNECTING && settings.modulo == 128) {
					settings.modulo = 8;
					this.connect();
				} else if(state.connection == CONNECTED) {
					this.connect();
				} else {
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        true,
                        true);
				}
				break;
			
            // Receive Ready (4.3.2.1)
            // Update our counts and handle any connection status changes
            // (pollFinal).
            // Get ready to do a drain by starting the t2 timer. If we get
            // more RR's or IFRAMES, we'll have to reset the t2 timer. 
            // If we're not connected, send a WTF? (DM) packet
			case 's_frame_rr':
                this._state.remote_busy = false;
				if (state.connection == CONNECTED) {
					this._state.remote_busy = false;
					receiveAcknowledgement(packet);
                    // XXX do we need to send a REJ or SREJ if it was out of
                    // order?
					if (packet.command && packet.poll_final) {
                        response = createPacket(
                            masks.control.frame_types.s_frame.subtypes.rr,
                            true,
                            true);
					}
                    this._t2_timer.start();
				} else if (packet.command) {
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        true,
                        true);
				}
				break;
			
            // Receive Not Ready (4.3.2.2) (6.4.9)
            // Just update our counts and handle any connection status
            // changes (pollFinal).
            // Don't send a reply or any data, and clear the t2 timer in case
            // we're about to send some. (Subsequent received packets may
            // restart the t2 timer.)
            // 
            // XXX (Not sure on this) We may need to restart the T1 timer
            // instead of the t3 if we got this as a reject of an IFrame.
			case 's_frame_rnr':
				if (state.connection == CONNECTED) {
					state.remote_busy = true;
					receiveAcknowledgement(packet);
                    // XXX do we need to send a REJ or SREJ if it was out of
                    // order?
					if (packet.command && packet.poll_final) {
                        response = createPacket(
                            masks.control.frame_types.s_frame.subtypes.rr,
                            true,
                            true);
					}
                    stopAllTimers();
                    this._t3_timer.start();
				} else if (packet.command) {
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        true,
                        true);
				}
				break;
			
            // Reject (4.3.2.3). The remote rejected a single connected frame,
            // which means it got something out of order.
            // Leave T1 alone, as this will trigger a resend
            // Set T2, in case we get more data from the remote soon.
			case 's_frame_rej':
				if (state.connection == CONNECTED) {
					state.remote_busy = false;
					receiveAcknowledgement(packet);
					if (packet.command && packet.poll_final) {
                        response = createPacket(
                            masks.control.frame_types.s_frame.subtypes.rr,
                            true,
                            true);
					}
                    this._state.remote_REJ_seqno = packet.receive_sequence;
                    this._t2_timer.start();
				} else {
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        true,
                        true);
				}
				break;
			
            // Information (4.3.1). This is our data packet.
            // We don't current send SREJ's at all.
			case 'i_frame':
				if (state.connection == CONNECTED) {
					if (packet.receive_sequence==this._state.receive_sequence) {
                        // everything's good.
						state.sent_REJ = false;
						state.receive_sequence =
							(state.receive_sequence + 1) % settings.modulo;
                        receiveAcknowledgement(packet);
                        response = createPacket(
                            masks.control.frame_types.s_frame.subtypes.rr,
                            packet.poll_final,
                            packet.command);
                        if (!packet.poll_final) {
                            this._t2_timer.start();
                        }
						emit = ["data", packet.info];
					} else if (!state.sent_REJ) {
						state.sent_REJ = true;
                        response = createPacket(
                            masks.control.frame_types.s_frame.subtypes.rej,
                            packet.poll_final,
                            packet.command);
                        if (!packet.poll_final) {
                            this._t2_timer.start();
                        }
					}
                    // else {
                    //    we got an out of sequence packet, but we already
                    //    sent a REJ so do nothing.
                    // }
                    
				} else if (packet.command) {
                    response = createPacket(
                        masks.control.frame_types.u_frame.subtypes.dm,
                        true,
                        true);
				}
				break;
				
		}

		if (response instanceof Packet)
			emitPacket(response);

		if (emit.length == 2)
			this.emit(emit[0], emit[1]);

	}

}

module.exports = Session;
