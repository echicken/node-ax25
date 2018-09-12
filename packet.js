'use strict';
const path = require('path');
const masks = require(path.join(__dirname, 'masks.js'));

function validate_address(obj) {
    return (
        typeof obj.callsign == 'string' &&
        obj.callsign.length > 0 &&
        obj.callsign.length < 7 &&
        typeof obj.ssid == 'number' &&
        obj.ssid >= 0 &&
        obj.ssid <= 15
    );
}

function validate_sequence(n, m) {
    return ((m === 8 || m === 128) && n >= 0 && n < m);
}

function validate_frame_type(t) { // lol :|
    return Object.keys(masks.control.frame_types).some(
        (e) => {
            if (typeof masks.control.frame_types[e].subtypes == 'object') {
                return Object.keys(masks.control.frame_types[e].subtypes).some(
                    (ee) => (masks.control.frame_types[e].subtypes[ee] === t)
                );
            } else {
                return masks.control.frame_types[e].type === t;
            }
        }
    );
}

function get_frame_type_name(t) {
    let ret = null;
    Object.keys(masks.control.frame_types).some(
        (e) => {
            if (typeof masks.control.frame_types[e].subtypes == 'object') {
                return Object.keys(masks.control.frame_types[e].subtypes).some(
                    (ee) => {
                        if (masks.control.frame_types[e].subtypes[ee] === t) {
                            ret = `${e}_${ee}`;
                            return true;
                        } else {
                            return false;
                        }
                    }
                );
            } else {
                if (masks.control.frame_types[e].type === t) {
                    ret = e;
                    return true;
                } else {
                    return false;
                }
            }
        }
    );
    return ret;
}

function parse_address(data, offset) {
    const ret = { callsign : '', ssid : 0, crh : false, ext : false };
    for (let n = offset; n < (offset + 6); n++) {
        ret.callsign += String.fromCharCode((data.readUInt8(n)>>1));
    }
    var byte = data.readUInt8(offset + 6);
    ret.ssid = ((byte&(masks.address.ssid))>>1);
    ret.crh = ((byte&(masks.address.crh)) > 0);
    ret.ext = ((byte&(masks.address.ext)) > 0);
    return ret;
}

function encode_address(callsign, ssid, crh, ext) {
    while (callsign.length < 6) {
        callsign += ' ';
    }
    const arr = callsign.split('').map((e) => e.charCodeAt(0)<<1);
    arr.push((ext ? 1 : 0)|(ssid<<1)|((crh ? 1 : 0)<<7));
    return Buffer.from(arr);
}

class Packet {

    constructor (modulo = 8) {

        if (modulo !== 8 && modulo !== 128) {
            throw `Invalid window-size parameter ${modulo}; must be 8 or 128`;
        }

        const properties = {
            destination : { callsign : '', ssid : 0 },
            source : { callsign : '', ssid : 0 },
            repeater_path : [],
            receive_sequence : 0,
            send_sequence : 0,
            type : masks.control.frame_types.u_frame.subtypes.ui,
            protocol_id : masks.pid.none,
            poll_final : false,
            command : false,
            response : false,
            payload : Buffer.from([]),
            sent : false,  // for session.js's use
        };

        // Your program should not use Packet[_window_size, _set, _get] directly

        this._window_size = modulo;

        this._set = function (property, value) {
            if (typeof properties[property] == 'undefined') {
                throw `Invalid property ${property}`;
            }
            properties[property] = value;
        }

        this._get = function (property) {
            if (typeof properties[property] == 'undefined') {
                throw `Invalid property ${property}`;
            }
            return properties[property];
        }

    }

    get destination() {
        return this._get('destination');
    }

    set destination(value) {
        if (!validate_address(value)) {
            throw `Invalid destination ${value}`;
        } else {
            this._set('destination', value);
        }
    }

    get source() {
        return this._get('source');
    }

    set source(value) {
        if (!validate_address(value)) {
            throw `Invalid source ${value}`;
        } else {
            this._set('source', value);
        }
    }

    get repeater_path() {
        return this._get('repeater_path');
    }

    set repeater_path(value) {
        if (typeof value != 'object' || !Array.isArray(value)) {
            throw `Invalid repeater_path ${value}`;
        } else if (!value.every(validate_address)) {
            throw `Invalid repeater_path entry ${e}`;
        } else {
            this._set('repeater_path', value);
        }
    }

    get receive_sequence() {
        return this._get('receive_sequence');
    }

    set receive_sequence(value) {
        if (!validate_sequence(value, this._window_size)) {
            throw `Invalid receive_sequence ${value}`;
        } else {
            this._set('receive_sequence', value);
        }
    }

    get send_sequence() {
        return this._get('send_sequence');
    }

    set send_sequence(value) {
        if (!validate_sequence(value, this._window_size)) {
            throw `Invalid send_sequence ${value}`;
        } else {
            this._set('send_sequence', value);
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

    get poll_final() {
        return this._get('poll_final');
    }

    set poll_final(value) {
        if (typeof value != 'boolean') {
            throw `Invalid poll_final ${value}`;
        } else {
            this._set('poll_final', value);
        }
    }

    get type() {
        return this._get('type');
    }

    set type(value) {
        if (!validate_frame_type(value)) {
            throw `Invalid frame type ${value}`;
        } else {
            this._set('type', value);
        }
    }

    get type_name() {
        return get_frame_type_name(this._get('type'));
    }

    get command() {
        return this._get('command');
    }

    set command(value) {
        if (typeof value != 'boolean') {
            throw `Invalid command ${value}`;
        } else {
            this._set('command', value);
        }
    }

    get response() {
        return this._get('response');
    }

    set response(value) {
        if (typeof value != 'boolean') {
            throw `Invalid response ${value}`;
        } else {
            this._set('response', value);
        }
    }

    get payload() {
        return this._get('payload');
    }

    set payload(value) {
        if (!Buffer.isBuffer(value)) {
            throw `Invalid payload ${value}`;
        } else {
            this._set('payload', value);
        }
    }

    get sent() {
        return this._get('sent');
    }

    set sent(value) {
        if (typeof value != 'boolean') {
            throw `Invalid sent ${value}`;
        } else {
            this._set('sent', value);
        }
    }

    assemble() {
        const control_length = this._window_size == 8 || (this.type&3) == 3 ? 1 : 2;
        const control_offset = 14 + (this.repeater_path.length * 7);
        const protocol_id_length = this.type == 3 || this.type == 0 ? 1 : 0;
        // We'll call the address, control, and protocol ID fields the 'header'
        const header = Buffer.concat(
            [   encode_address(
                    this.destination.callsign, this.destination.ssid, this.command, false
                ),
                encode_address(
                    this.source.callsign, this.source.ssid, this.response, (this.repeater_path.length < 1)
                )
            ].concat(
                this.repeater_path.map(
                    (e, i, a) => {
                        encode_address(e.callsign, e.ssid, e.h, (i == a.length - 1))
                    }
                )
            ).concat(
                Buffer.alloc(control_length),
                Buffer.alloc(protocol_id_length)
            )
        );
        let control = this.type;
        if ((control&3) == 3) {
            header.writeUInt8(control|((this.poll_final ? 1 : 0)<<4), control_offset);
            if (protocol_id_length > 0) {
                header.writeUInt8(this.protocol_id, control_offset + control_length);
            }
        } else {
            if (control == masks.control.frame_types.i_frame.type) {
                control|=(this.send_sequence<<1);
                header.writeUInt8(this.protocol_id, control_offset + control_length);
            }
            if (this._window_size == 8) {
                control|=((this.poll_final ? 1 : 0)<<4);
                control|=(this.receive_sequence<<5);
                header.writeUInt8(control, control_offset);
            } else {
                control|=((this.poll_final ? 1 : 0)<<8);
                control|=(this.receive_sequence<<9);
                // This is dumb but I'll sort it out later.
                header.writeUInt8(control&255, control_offset);
                header.writeUInt8((control&(255<<8))>>8, control_offset + 1);
            }
        }
        return Buffer.concat([header, this.payload]);
    }

    disassemble(data) {
        if (!Buffer.isBuffer(data)) {
            throw `data parameter must be Buffer, supplied ${typeof data}`;
        } else if (data.length < (this._window_size == 8 ? 15 : 17)) {
            throw `Packet does not meet minimum length`;
        } else {
            let address = parse_address(data, 0);
            this.destination = address;
            this.command = address.crh;
            address = parse_address(data, 7);
            this.source = address;
            this.response = address.crh;
            let offset = 14;
            if (!address.ext) {
                const repeater_path = [];
                while (!address.ext) {
                    address = parse_address(data, offset);
                    repeater_path.push(address);
                    offset = offset + 7;
                }
            }
            let control = data.readUInt8(offset);
            if ((control&3) == 3) {
                this.type = (control&masks.control.frame_types.u_frame.mask);
            } else {
                if ((control&1) == 0) {
                    this.type = masks.control.frame_types.i_frame.type;
                } else {
                    this.type = (control&masks.control.frame_types.s_frame.mask);
                }
                if (this._window_size == 128) {
                    offset++;
                    control|=(data.readUInt8(offset)<<8);
                    this.receive_sequence = ((control&masks.control.nr_128)>>9);
                    this.send_sequence = ((control&masks.control.ns_128)>>1);
                    this.poll_final = ((control&masks.control.pf_128) > 0);
                } else {
                    this.receive_sequence = ((control&masks.control.nr)>>5);
                    this.send_sequence = ((control&masks.control.ns)>>1);
                }
            }
            offset++;
            if (this.type == 0 || this.type == 3) { // I or UI frame
                this.protocol_id = data.readUInt8(offset);
                offset++;
            }
            this.payload = data.slice(offset);
        }
    }

}

module.exports = Packet;
