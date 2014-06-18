var ax25 = require("./index.js"),
	util = require("util");

var Packet = function(args) {
	
	var properties = {
		'destinationCallsign'	: "",
		'destinationSSID'		: 0,
		'sourceCallsign'		: "",
		'sourceSSID'			: 0,
		'repeaterPath'			: [],
		'pollFinal'				: 0,
		'command'				: 0,
		'type'					: 0,
		'nr'					: 0,
		'ns'					: 0,
		'pid'					: ax25.Defs.PID_NONE,
		'info'					: [],
		'sent'					: false, // Relevant only to ax25.Session
		'modulo128'				: false
	};
	
	this.__defineGetter__(
		"destinationCallsign",
		function() {
			if(!ax25.Utils.testCallsign(properties.destinationCallsign))
				throw "ax25.Packet: Invalid destination callsign.";
			return properties.destinationCallsign;
		}
	);
	
	this.__defineSetter__(
		"destinationCallsign",
		function(callsign) {
			if(typeof callsign == "undefined" || !ax25.Utils.testCallsign(callsign))
				throw "ax25.Packet: Invalid destination callsign.";
			properties.destinationCallsign = callsign;
		}
	);
	
	this.__defineGetter__(
		"destinationSSID",
		function() {
			if(properties.destinationSSID < 0 || properties.destinationSSID > 15)
				throw "ax25.Packet: Invalid destination SSID.";
			return properties.destinationSSID;
		}
	);
	
	this.__defineSetter__(
		"destinationSSID",
		function(ssid) {
			if(typeof ssid != "number" || ssid < 0 || ssid > 15)
				throw "ax25.Packet: Invalid destination SSID.";
			properties.destinationSSID = ssid;
		}
	);
	
	this.__defineGetter__(
		"sourceCallsign",
		function() {
			if(!ax25.Utils.testCallsign(properties.sourceCallsign))
				throw "ax25.Packet: Invalid source callsign.";
			return properties.sourceCallsign;
		}
	);
	
	this.__defineSetter__(
		"sourceCallsign",
		function(callsign) {
			if(typeof callsign == "undefined" || !ax25.Utils.testCallsign(callsign))
				throw "ax25.Packet: Invalid source callsign.";
			properties.sourceCallsign = callsign;
		}
	);
	
	this.__defineGetter__(
		"sourceSSID",
		function() {
			if(properties.sourceSSID < 0 || properties.sourceSSID > 15)
				throw "ax25.Packet: Invalid source SSID.";
			return properties.sourceSSID;
		}
	);
	
	this.__defineSetter__(
		"sourceSSID",
		function(ssid) {
			if(typeof ssid != "number" || ssid < 0 || ssid > 15)
				throw "ax25.Packet: Invalid source SSID.";
			properties.sourceSSID = ssid;
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
		function(repeaters) {
			var msg = "ax25.Packet: Repeater path must be array of valid {callsign, ssid} objects.";
			if(typeof repeaters == "undefined" || !(repeaters instanceof Array))
				throw msg;
			for(var r = 0; r < repeaters.length; r++) {
				if(	!repeaters[r].hasOwnProperty('callsign')
					||
					!ax25.Utils.testCallsign(repeaters[r].callsign)
				) {
					throw msg;
				}
				if(	!repeaters[r].hasOwnProperty('ssid')
					||
					repeaters[r].ssid < 0
					||
					repeaters[r].ssid > 15
				) {
					throw msg;
				}
			}
			properties.repeaterPath = repeaters;
		}
	);
	
	this.__defineGetter__(
		"pollFinal",
		function() {
			return (properties.pollFinal == 1) ? true : false;
		}
	);
	
	this.__defineSetter__(
		"pollFinal",
		function(pollFinal) {
			if(typeof pollFinal != "boolean")
				throw "ax25.Packet: Invalid poll/final bit assignment (should be boolean.)";
			properties.pollFinal = (pollFinal) ? 1 : 0;
		}
	);

	this.__defineGetter__(
		"command",
		function() {
			return (properties.command == 1) ? true : false;
		}
	);
	
	this.__defineSetter__(
		"command",
		function(command) {
			if(typeof command != "boolean")
				throw "ax25.Packet: Invalid command bit assignment (should be boolean.)";
			properties.command = (command) ? 1 : 0;
		}
	);

	this.__defineGetter__(
		"response",
		function() {
			return (properties.command == 1) ? false : true;
		}
	);

	this.__defineSetter__(
		"response",
		function(response) {
			if(typeof response != "boolean")
				throw "ax25.Packet: Invalid response bit assignment (should be boolean.)";
			properties.command = (response) ? 0 : 1;
		}
	);
	
	/*	Assemble and return a control octet based on the properties of this
		packet.  (Note that there is no corresponding setter - the control
		field is always generated based on packet type, poll/final, and the
		N(S) and N(R) values if applicable, and must always be fetched from
		this getter. */
	this.__defineGetter__(
		"control",
		function() {
			var control = properties.type;
			if(	properties.type == ax25.Defs.I_FRAME
				||
				(properties.type&ax25.Defs.U_FRAME) == ax25.Defs.S_FRAME
			) {
				control|=(properties.nr<<((properties.modulo128) ? 9 : 5));
			}
			if(properties.type == ax25.Defs.I_FRAME)
				control|=(properties.ns<<1);
			if(this.pollFinal)
				control|=(properties.pollFinal<<((properties.modulo128) ? 8 : 4));
			return control;
		}
	);
	
	this.__defineGetter__(
		"type",
		function() {
			return properties.type;
		}
	);
	
	this.__defineSetter__(
		"type",
		function(type) {
			if(typeof type != "number")
				throw "ax25.Packet: Invalid frame type assignment.";
			properties.type = type;
		}
	);
	
	this.__defineGetter__(
		"nr",
		function() {
			return properties.nr;
		}
	);
	
	this.__defineSetter__(
		"nr",
		function(nr) {
			if(typeof nr != "number" || nr < 0 || nr > ((properties.modulo128) ? 127 : 7))
				throw "ax25.Packet: Invalid N(R) assignment.";
			properties.nr = nr;
		}
	);
	
	this.__defineGetter__(
		"ns",
		function() {
			return properties.ns;
		}
	);
	
	this.__defineSetter__(
		"ns",
		function(ns) {
			if(typeof ns != "number" || ns < 0 || ns > ((properties.modulo128) ? 127 : 7))
				throw "ax25.Packet: Invalid N(S) assignment.";
			properties.ns = ns;
		}
	);
	
	this.__defineGetter__(
		"pid",
		function() {
			return (properties.pid == 0) ? undefined : properties.pid;
		}
	);
	
	this.__defineSetter__(
		"pid",
		function(pid) {
			if(typeof pid != "number")
				throw "ax25.Packet: Invalid PID field assignment.";
			if(	properties.type == ax25.Defs.I_FRAME
				||
				properties.type == ax25.Defs.U_FRAME_UI
			) {
				properties.pid = pid;
			} else {
				throw "ax25.Packet: PID can only be set on I and UI frames.";
			}
		}
	);
	
	this.__defineGetter__(
		"info",
		function() {
			return properties.info;
		}
	);
	
	this.__defineSetter__(
		"info",
		function(info) {
			if(typeof info == "undefined")
				throw "ax25.Packet: Invalid information field assignment.";
			if(properties.type == ax25.Defs.I_FRAME || properties.type == ax25.Defs.U_FRAME)
				properties.info = info;
			else
				throw "ax25.Defs.Packet: Info field can only be set on I and UI frames.";
		}
	);
	
	this.__defineGetter__(
		"infoString",
		function() {
			return ax25.Utils.byteArrayToString(properties.info);
		}
	);
	
	this.__defineSetter__(
		"infoString",
		function(info) {
			if(typeof info != "string")
				throw "ax25.Packet.infoString: type mismatch.";
			properties.info = ax25.Utils.stringToByteArray(info);
		}
	);

	this.__defineGetter__(
		"sent",
		function() {
			return properties.sent;
		}
	);

	this.__defineSetter__(
		"sent",
		function(sent) {
			if(typeof sent != "boolean")
				throw "ax25.Packet.sent: Value must be boolean.";
			properties.sent = sent;
		}
	);

	this.__defineGetter__(
		"modulo128",
		function() {
			return properties.modulo128;
		}
	);

	this.__defineSetter__(
		"modulo128",
		function(modulo128) {
			if(typeof modulo128 != "boolean")
				throw "ax25.Packet.modulo128: Value must be boolean.";
			properties.modulo128 = modulo128;
		}
	);
	
	this.disassemble = function(frame) {

		if(frame.length < 15)
			throw "ax25.Packet.disassemble: Frame does not meet minimum length.";

		// Address Field: Destination subfield
		var field = frame.splice(0, 6);
		for(var f = 0; f < field.length; f++)
			properties.destinationCallsign += String.fromCharCode(field[f]>>1);
		field = frame.shift();
		properties.destinationSSID = (field&ax25.Defs.A_SSID)>>1;
		properties.command = (field&ax25.Defs.A_CRH)>>7;
		
		// Address Field: Source subfield
		field = frame.splice(0, 6);
		for(var f = 0; f < field.length; f++)
			properties.sourceCallsign += String.fromCharCode(field[f]>>1);
		field = frame.shift();
		properties.sourceSSID = (field&ax25.Defs.A_SSID)>>1;

		// Address Field: Repeater path
		while(field&1 == 0) {
			field = frame.splice(0, 6);
			var repeater = {
				'callsign' : "",
				'ssid' : 0
			};
			for(var f = 0; f < field.length; f++)
				repeater.callsign += String.fromCharCode(field[f]>>1);
			field = frame.shift();
			repeater.ssid = (field&ax25.Defs.A_SSID)>>1;
			properties.repeaterPath.push(repeater);
		}
		
		// Control field
		var control = frame.shift();
		if((control&ax25.Defs.U_FRAME) == ax25.Defs.U_FRAME) {
			properties.pollFinal = (control&ax25.Defs.PF)>>4;
			properties.type = control&ax25.Defs.U_FRAME_MASK;
			if(properties.type == ax25.Defs.U_FRAME_UI) {
				properties.pid = frame.shift();
				properties.info = frame;
			} else if(properties.type == ax25.Defs.U_FRAME_XID && frame.length > 0) {
				// Parse XID parameter fields and break out to properties
			} else if(properties.type == ax25.Defs.U_FRAME_TEST && frame.length > 0) {
				properties.info = frame;
			}
		} else if((control&ax25.Defs.U_FRAME) == ax25.Defs.S_FRAME) {
			properties.type = control&ax25.Defs.S_FRAME_MASK;
			if(properties.modulo128) {
				control|=(frame.shift()<<8);
				properties.nr = (control&ax25.Defs.NR_MODULO128)>>8;
				properties.pollFinal = (control&ax25.Defs.PF)>>7;
			} else {
				properties.nr = (control&ax25.Defs.NR)>>5;
				properties.pollFinal = (control&ax25.Defs.PF)>>4;
			}
		} else if((control&1) == ax25.Defs.I_FRAME) {
			properties.type = ax25.Defs.I_FRAME;
			if(properties.modulo128) {
				control|=(frame.shift()<<8);
				properties.nr = (control&ax25.Defs.NR_MODULO128)>>8;
				properties.ns = (control&ax25.Defs.NS_MODULO128)>>1;
				properties.pollFinal = (control&ax25.Defs.PF)>>7;
			} else {
				properties.nr = (control&ax25.Defs.NR)>>5;
				properties.ns = (control&ax25.Defs.NS)>>1;
				properties.pollFinal = (control&ax25.Defs.PF)>>4;
			}
			properties.pid = frame.shift();
			properties.info = frame;
		} else {
			throw "ax25.Packet.dissassemble: Invalid packet.";
		}
		
	}
	
	this.assemble = function() {
	
		// Try to catch a few obvious derps
		if(properties.destinationCallsign.length == 0)
			throw "ax25.Packet: Destination callsign not set.";
		if(properties.sourceCallsign.length == 0)
			throw "ax25.Packet: Source callsign not set.";
		if(	properties.type == ax25.Defs.I_FRAME
			&&
			(	typeof properties.pid == "undefined"
				||
				properties.info.length < 1
			)
		) {
			throw "ax25.Packet: I or UI frame with no payload.";
		}
		
		var frame = [];
		
		// Address field: Destination subfield
		for(var c = 0; c < 6; c++) {
			frame.push(
				(	(properties.destinationCallsign.length - 1 >= c)
					?
					properties.destinationCallsign[c].charCodeAt(0)
					:
					32
				)<<1
			);
		}
		frame.push((properties.command<<7)|(3<<5)|(properties.destinationSSID<<1)
		);

		// Address field: Source subfield
		for(var c = 0; c < 6; c++) {
			frame.push(
				(	(properties.sourceCallsign.length - 1 >= c)
					?
					properties.sourceCallsign[c].charCodeAt(0)
					:
					32
				)<<1
			);
		}
		frame.push(
			((properties.command^1)<<7)
			|
			(((properties.modulo128) ? 0 : 1)<<6)
			|
			(1<<5)
			|
			(properties.sourceSSID<<1)
			|
			((properties.repeaterPath.length < 1) ? 1 : 0)
		);

		// Address Field: Repeater path
		for(var r = 0; r < properties.repeaterPath.length; r++) {
			for(var c = 0; c < 6; c++) {
				frame.push(
					(	(properties.repeaterPath[r].callsign.length - 1 >= c)
						?
						properties.repeaterPath[r].callsign[c].charCodeAt(0)
						:
						32
					)<<1
				);
			}
			frame.push(
				(properties.repeaterPath[r].ssid<<1)
				|
				((r == properties.repeaterPath.length - 1) ? 1 : 0)
			);
		}

		// Control field
		if(!properties.modulo128) {
			frame.push(this.control);
		} else {
			frame.push(this.control&255);
			frame.push(this.control>>8);
		}

		// PID field (I and UI frames only)
		if(	properties.pid
			&&
			(	properties.type == ax25.Defs.I_FRAME
				||
				properties.type == ax25.Defs.U_FRAME_UI
			)
		) {
			frame.push(properties.pid);
		}

		// Info field
		if(	properties.info.length > 0
			&&
			(	properties.type == ax25.Defs.I_FRAME
				||
				properties.type == ax25.Defs.U_FRAME_UI
				||
				properties.type == ax25.Defs.U_FRAME_TEST
			)
		) {
			for(var i = 0; i < properties.info.length; i++)
				frame.push(properties.info[i]);
		}
		
		return frame;
	}

	this.log = function() {
		var type = "", pid = "";
		for(var def in ax25.Defs) {
			if(def.match(/^PID/) == null && ax25.Defs[def] == this.type && def.match(/MASK$/) == null)
				type = def;
			else if(def.match(/^PID/) !== null && ax25.Defs[def] == this.pid)
				pid = def.replace(/^PID_/, "");
		}
		return util.format(
			"%s-%s -> %s-%s%s, C: %s, R: %s, PF: %s, Type: %s, PID: %s, %s%s",
			this.sourceCallsign, this.sourceSSID,
			this.destinationCallsign, this.destinationSSID,
			(this.repeaterPath.length > 0) ? " (" + this.repeaterPath.join("->") + ")" : "",
			this.command, this.response, this.pollFinal, type, pid,
			(type == "I_FRAME" || type.match(/^S_FRAME.*/) !== null) ? "N(R): " + this.nr : "",
			(type == "I_FRAME")  ? ", N(S): " + this.ns : ""
		);
	}

	if(typeof args != "undefined" && typeof args.frame != "undefined") {
		this.disassemble(args.frame);
	} else if(typeof args != "undefined") {
		for(var a in args) {
			if(typeof this[a] == "undefined" || typeof args[a] == "function" || a == "frame") {
				console.log(
					"Not assigning " + a + ": " + typeof this[a]
				);
				continue;
			}
			this[a] = args[a];
		}
	}
	
}

module.exports = Packet;