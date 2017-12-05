'use strict';
const EventEmitter = require('events');
const path = require('path');
const Masks = require(path.join(__dirname, 'masks.js'));
const Packet = require(path.join(__dirname, 'packet.js'));

class T1_Timer {

    constructor (interval, repetitions, callback, on_timeout) {

        let repetition = 0;

        let evt = setInterval(
            () => {
                if (repetition < repetitions) {
                    repetition++;
                    callback();
                } else {
                    clearInterval(evt);
                    on_timeout();
                }
            }, interval
        );

        this.cancel = function () {
            clearInterval(evt);
        }

    }

}

class Session extends EventEmitter {

    constructor () {

        super();

        const state = {
            c : false, // Connected status
            n1 : 256, // Information field length, default 256
            n2 : 10, // Ack retries; if t1 expires n2 times in a row, session ends
            t1 : null, // Acknowledgement Timer T1
            t2 : null, // Response Delay Timer T2
            t3 : null, // Inactive Link Timer T3
            vs : 0, // Send State Variable V(S)
            vr : 0, // Receive State Variable V(R)
            va : 0, // Acknowledge State Variable V(A)
            ws : 8, // Window size, 8 or 128
            rx : [], // I frames segmented or received out of sequence go here
            tx : [] // I frames waiting to be sent go here, { sent, packet }
        };

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

        // Yeah, this is going to be fun.
        switch (packet.type_name) {
            case 'i_frame':
                break;
            case 's_frame_rr':
                break;
            case 's_frame_rnr':
                break;
            case 's_frame_rej':
                break;
            case 's_frame_srej':
                break;
            case 'u_frame_sabm':
                break;
            case 'u_frame_sabme':
                break;
            case 'u_frame_disc':
                break;
            case 'u_frame_dm':
                break;
            case 'u_frame_ua':
                break;
            case 'u_frame_frmr':
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
