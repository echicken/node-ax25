'use strict';
const EventEmitter = require('events');
const path = require('path');
const Masks = require(path.join(__dirname, 'masks.js'));
const Packet = require(path.join(__dirname, 'packet.js'));

const DISCONNECTED = 0;
const CONNECTING = 1;
const CONNECTED = 2;
const IREJ = 0;
const SREJ = 1;
const SREJREJ = 2;

class T1_Timer {

    constructor (interval, repetitions) {

        let evt = null;
        let running = false;

        this.stop = function () {
            if (running) {
                clearInterval(evt);
                running = false;
            }
        }

        this.start = function (callback, on_timeout) {
            this.stop();
            let repetition = 0;
            evt = setInterval(
                () => {
                    if (repetition < repetitions) {
                        repetition++;
                        callback();
                    } else {
                        this.stop();
                        on_timeout();
                    }
                }, interval
            );
            running = true;
        }

        Object.defineProperty(this, 'running', { get : () => running });

    }

}

class Session extends EventEmitter {

    constructor () {

        super();

        // The current state of the session, with AX.25 2.2 defaults where applicable
        const state = {
            at : 3000, // Acknowledge Timer (ms), interval for timer T1
            cs : DISCONNECTED, // Connected status
            fd : false, // Full duplex
            md : 8, // Modulo, 8 or 128
            n1 : 256, // Information field length, default 256
            n2 : 10, // Ack retries; if t1 expires n2 times in a row, session ends
            rm : SREJ, // Rejection Mode: IREJ, SREJ, or SREJREJ
            t1 : null, // Acknowledgement Timer T1
            t2 : null, // Response Delay Timer T2
            t3 : null, // Inactive Link Timer T3 (null or Number timer ID)
            vs : 0, // Send State Variable V(S)
            vr : 0, // Receive State Variable V(R)
            va : 0, // Acknowledge State Variable V(A)
            ws : 7, // Window Size Receive
            rx : [], // I frames segmented or received out of sequence go here
            tx : [] // I frames waiting to be sent go here, { sent, packet }
        };
        // at, fd, md, n1, n2, sr, and ws should be set to pre 2.2 defaults if
        // a packet appears to come from an earlier version (command and response
        // bits are the same).  These parameters can also be negotiated via XID.

        // Allow public methods to access private properties of 'state'
        // Your program should not call _get or _set directly.

        this._get = function (property) {
            return state[property];
        }

        this._set = function (property, value) {
            state[property] = value;
        }

        // For debugging
        this._get_state = function () {
            return state;
        }

    }

    receive(packet) {

        // This section is slowly being populated with notes as I peruse the 2.2
        // spec as it exists here: https://www.tapr.org/pdf/AX25.2.2.pdf
        // Last time around (oops) I used 2.0: https://www.tapr.org/pub_ax25.html
        // Where the spec gives clear instructions on how to respond to a given
        // frame based on the current state of the connection, I'll sketch out
        // the process to be followed.  From there, I'll break logic out into
        // reusable procedures where it makes sense to do so.
        switch (packet.type_name) { // Would be more efficient to use packet.type and Masks
            case 'i_frame':
                // this needs plenty of work re: outstanding rej conditions among others;
                // I will have to peruse the spec a few more times and build this out
                // if connected
                //   flush sent frames up to N(R) - 1
                //   update va
                //   unset t1
                //   if there are sent I frames that remain unacknowledged
                //     set t1
                //   if frame is in sequence
                //     increment vr
                //     if this is not a segment
                //       emit data event
                //     else if this is a segment
                //       store frame in rx[]
                //       if this is the first segment
                //         set a 'receiving segmented data' flag in state
                //       else if this is the final segment
                //         splice rx[] from 0 and emit data event (or segmented data event?)
                //     if P bit set
                //       resond with RR or RNR with F bit set
                //     else if we have I frames we can send (mind ws and md)
                //       send outstanding I frames up to window size
                //     else
                //       send an RR frame (after t2 timeout?)
                //    else if rm is IREJ
                //      if P bit set
                //        send a REJ frame with F bit set
                //      else if no outstanding IREJ condition
                //        send a REJ frame
                //        set outstanding IREJ condition flag (add to state)
                //      discard the frame
                //    else if rm is SREJ
                //      if P bit set
                //        send a REJ frame with F bit set
                //      else if no outstanding SREJ condition
                //        send an SREJ with P bit set and N(R) current vr
                //        set 'outstanding SREJ condition' flag (add to state)
                //      else
                //        send an SREJ with P bit set to 0 and N(R) current vr
                //      store the frame in rx[]
                //    else if rm is SREJREJ
                //      this is poorly described in the spec IMHO; I will tackle
                //      it when I'm less sleepy.
                //  else (if disconnected)
                //    if P bit set
                //      respond with DM with F bit set
                break;
            case 's_frame_rr':
                // if connected and P bit set, respond with RR, RNR, or REJ with F bit set
                // else if disconnected and P bit set, respond with DM with F bit set
                break;
            case 's_frame_rnr':
                // if connected and P bit set, respond with RR, RNR, or REJ with F bit set
                // else if disconnected and P bit set, respond with DM with F bit set
                break;
            case 's_frame_rej':
                // if connected and P bit set, respond with RR, RNR, or REJ with F bit set
                // else if disconnected and P bit set, respond with DM with F bit set
                break;
            case 's_frame_srej':
                // if connected and P bit set, respond with RR, RNR, or REJ with F bit set
                // else if disconnected and P bit set, respond with DM with F bit set
                break;
            case 'u_frame_sabm':
                // if P bit set, respond with UA or DM with F bit set
                break;
            case 'u_frame_sabme':
                // if P bit set, respond with UA or DM with F bit set
                break;
            case 'u_frame_disc':
                // if P bit set, respond with UA or DM with F bit set
                break;
            case 'u_frame_dm':
                break;
            case 'u_frame_ua':
                break;
            case 'u_frame_frmr':
                // Examine payload
                break;
            case 'u_frame_ui':
                break;
            case 'u_frame_xid':
                break;
            case 'u_frame_test':
                break;
            default:
                break;
        }

    }

    send(data, encoding = 'ascii') {

        if (Array.isArray(data) || data instanceof ArrayBuffer) {
            data = Buffer.from(data);
        } else if (typeof data == 'string') {
            data = Buffer.from(data, encoding);
        }

        if (Buffer.isBuffer(data)) {
            // Make as many Packet objects as needed to transmit 'data' (see state.n1)
            // Append packets to state.tx, { sent : false, packet : packet }
            // Call transmit function to send as many I frames as possible
        }

    }

}

module.exports = Session;
