# ax25
Javascript classes for the AX.25 (packet radio) protocol.

Move along, nothing to see here.  This is incomplete, in flux, and entirely
broken at the moment.  Pull requests would probably be counterproductive.  Do
not use this, do not expect it to work.

## Contents

* [Masks](#masks)
* [Packet](#packet)
    * [Constructor](#packet-constructor)
    * [Properties](#packet-properties)
    * [Methods](#packet-methods)

## Masks

Contains bitfield masks, mostly for internal use.  See _masks.js_ for details.
The only items likely to be of use to you are under _Masks.control.frame_types_,
which you can use when assigning a _type_ to a _Packet_.  _Masks.pid_ may also
come in handy if you aren't doing unproto operation and need something to
compare against _Packet.protocol_id_.

## Packet

An Object representing an AX.25 frame (packet).  All attributes of the packet
are broken out into properties that you can read or write as needed.

### Packet Constructor

```js
const packet = new AX25.Packet(modulo = 8);
```

If you are using modulo 128 operation, pass the number 128 as the only parameter.
This is necessary in order for the packet to be assembled or disassembled correctly.

### Packet Properties

* destination
    * Object { callsign, ssid }
* source
    * Object { callsign, ssid }
* repeater_path
    * Array[Object] [ { callsign, ssid, h }, ... ]
    * Boolean 'h' sets/unsets the has-been-repeated bit
* receive_sequence
    * N(R)
* send_sequence
    * N(S)
* type
    * One of Masks.control.frame_types[type/subtypes]
* type_name
    * Read-only, for now
    * A _String_ identifying the type of frame, one of:
        * i_frame
        * s_frame_rr, s_frame_rnr, s_frame_rej, s_frame_srej
        * u_frame_sabm, u_frame_sabme, u_frame_disc, u_frame_dm, u_frame_ua, u_frame_frmr, u_frame_ui, u_frame_xid, u_frame_test
* protocol_id
    * One of Masks.pid
* poll_final
    * Boolean, poll/final bit is set
* command
    * Boolean, packet is a command
* response
    * Boolean, packet is a response
* payload
    * Buffer, the Info field of an I, UI, XID, TEST, or FRMR frame

### Packet Methods

* assemble()
    * Call this method once you've set all necessary attributes of your _Packet_
    * Returns a _Buffer_, which is the serialized packet (without a start flag, Frame Check Sequence, or stop flag)
* disassemble(data)
    * Parses the packet contained in _Buffer_ _data_ and populates all properties based on the attributes therein
