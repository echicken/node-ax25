var ax25Defs = require("./ax25defs.js").ax25Defs;

/*	testCallsign(callsign) - boolean
	Returns true if 'callsign' is a valid AX.25 callsign (a string
	containing up to six letters and numbers only.) */
var testCallsign = function(callsign) {
	if(typeof callsign == "undefined" || callsign.length > 6)
		return false;
	callsign = callsign.toUpperCase().replace(/\s*$/g, "");
	for(var c = 0; c < callsign.length; c++) {
		var a = callsign[c].charCodeAt(0);
		if(	(a >= 48 && a <= 57)
			||
			(a >=65 && a <=90)
		) {
			continue;
		}
		return false;
	}
	return true;
}

var ax25Packet = function(frame) {
	
	var properties = {
		'destinationCallsign'	: "",
		'destinationSSID'		: 0,
		'sourceCallsign'		: "",
		'sourceSSID'			: 0,
		'repeaterPath'			: [],
		'pollFinal'				: 0,
		'command'				: 0,
		'response'				: 0,
		'type'					: 0,
		'nr'					: 0,
		'ns'					: 0,
		'pid'					: ax25Defs.PID_NONE,
		'info'					: []
	};
	
	this.__defineGetter__(
		"destinationCallsign",
		function() {
			if(!testCallsign(properties.destinationCallsign))
				throw "ax25Packet: Invalid destination callsign.";
			return properties.destinationCallsign;
		}
	);
	
	this.__defineSetter__(
		"destinationCallsign",
		function(callsign) {
			if(typeof callsign == "undefined" || !testCallsign(callsign))
				throw "ax25Packet: Invalid destination callsign.";
			properties.destinationCallsign = callsign;
		}
	);
	
	this.__defineGetter__(
		"destinationSSID",
		function() {
			if(properties.destinationSSID < 0 || properties.destinationSSID > 15)
				throw "ax25Packet: Invalid destination SSID.";
			return properties.destinationSSID;
		}
	);
	
	this.__defineSetter__(
		"destinationSSID",
		function(ssid) {
			if(typeof ssid != "number" || ssid < 0 || ssid > 15)
				throw "ax25Packet: Invalid destination SSID.";
			properties.destinationSSID = ssid;
		}
	);
	
	this.__defineGetter__(
		"sourceCallsign",
		function() {
			if(!testCallsign(properties.sourceCallsign))
				throw "ax25Packet: Invalid source callsign.";
			return properties.sourceCallsign;
		}
	);
	
	this.__defineSetter__(
		"sourceCallsign",
		function(callsign) {
			if(typeof callsign == "undefined" || !testCallsign(callsign))
				throw "ax25Packet: Invalid source callsign.";
			properties.sourceCallsign = callsign;
		}
	);
	
	this.__defineGetter__(
		"sourceSSID",
		function() {
			if(properties.sourceSSID < 0 || properties.sourceSSID > 15)
				throw "ax25Packet: Invalid source SSID.";
			return properties.sourceSSID;
		}
	);
	
	this.__defineSetter__(
		"sourceSSID",
		function(ssid) {
			if(typeof ssid != "number" || ssid < 0 || ssid > 15)
				throw "ax25Packet: Invalid source SSID.";
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
			var msg = "ax25Packet: Repeater path must be array of valid {callsign, ssid} objects.";
			if(typeof repeaters == "undefined" || !(repeaters instanceof Array))
				throw msg;
			for(var r = 0; r < repeaters.length; r++) {
				if(	!repeaters[r].hasOwnProperty('callsign')
					||
					!testCallsign(repeaters[r].callsign)
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
				throw "ax25Packet: Invalid poll/final bit assignment (should be boolean.)";
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
				throw "ax25Packet: Invalid command bit assignment (should be boolean.)";
			properties.command = (command) ? 1 : 0;
			properties.response = (command) ? 0 : 1;
		}
	);
	
	this.__defineGetter__(
		"response",
		function() {
			return (properties.response == 1) ? true : false;
		}
	);
	
	this.__defineSetter__(
		"response",
		function(response) {
			if(typeof response != "boolean")
				throw "ax25Packet: Invalid response bit assignment (should be boolean.)";
			properties.response = (response) ? 1 : 0;
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
			if(	properties.type == ax25Defs.I_FRAME
				||
				(properties.type&ax25Defs.U_FRAME) == ax25Defs.S_FRAME
			) {
				control|=(properties.nr<<5);
			}
			if(properties.type == ax25Defs.I_FRAME)
				control|=(properties.ns<<1);
			if(this.pollFinal)
				control|=(properties.pollFinal<<4);
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
				throw "ax25Packet: Invalid frame type assignment.";
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
			if(typeof nr != "number" || nr < 0 || nr > 7)
				throw "ax25Packet: Invalid N(R) assignment.";
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
			if(typeof ns != "number" || ns < 0 || ns > 7)
				throw "ax25Packet: Invalid N(S) assignment.";
			properties.ns = ns;
		}
	);
	
	this.__defineGetter__(
		"pid",
		function() {
			return (properites.pid == 0) ? undefined : properties.pid;
		}
	);
	
	this.__defineSetter__(
		"pid",
		function(pid) {
			if(typeof pid != "number")
				throw "ax25Packet: Invalid PID field assignment.";
			if(	properties.type == ax25Defs.I_FRAME
				||
				properties.type == ax25Defs.U_FRAME_UI
			) {
				properties.pid = pid;
			} else {
				throw "ax25Packet: PID can only be set on I and UI frames.";
			}
		}
	);
	
	this.__defineGetter__(
		"info",
		function() {
			if(properties.info.length < 1)
				return undefined;
			else
				return properties.info;
		}
	);
	
	this.__defineSetter__(
		"info",
		function(info) {
			if(typeof info == "undefined")
				throw "ax25Packet: Invalid information field assignment.";
			if(properties.type == ax25Defs.I_FRAME || properties.type == ax25Defs.U_FRAME)
				properties.info = info;
			else
				throw "ax25Defs.Packet: Info field can only be set on I and UI frames.";
		}
	);
	
	this.__defineGetter__(
		"infoString",
		function() {
			var str = "";
			for(var i = 0; i < properties.info.length; i++)
				str += String.fromCharCode(properties.info[i]);
			return str;
		}
	);
	
	this.__defineSetter__(
		"infoString",
		function(info) {
			if(typeof info != "string")
				throw "ax25Packet.infoString: type mismatch.";
			info = info.split("");
			for(var i = 0; i < info.length; i++)
				info[i] = info[i].charCodeAt(0);
			properties.info = info;
		}
	);
	
	this.disassemble = function(frame) {

		if(frame.length < 15)
			throw "ax25Packet.disassemble: Frame does not meet minimum length.";

		// Address Field: Destination subfield
		var field = frame.splice(0, 6);
		for(var f = 0; f < field.length; f++)
			properties.destinationCallsign += String.fromCharCode(field[f]>>1);
		field = frame.shift();
		properties.destinationSSID = (field&ax25Defs.A_SSID)>>1;
		properties.command = (field&ax25Defs.A_CRH)>>7;
		
		// Address Field: Source subfield
		field = frame.splice(0, 6);
		for(var f = 0; f < field.length; f++)
			properties.sourceCallsign += String.fromCharCode(field[f]>>1);
		field = frame.shift();
		properties.sourceSSID = (field&ax25Defs.A_SSID)>>1;
		properties.response = (field&ax25Defs.A_CRH)>>7;

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
			repeater.ssid = (field&ax25Defs.A_SSID)>>1;
			properties.repeaterPath.push(repeater);
		}
		
		// Control field
		var control = frame.shift();
		properties.pollFinal = (control&ax25Defs.PF)>>4;
		if((control&ax25Defs.U_FRAME) == ax25Defs.U_FRAME) {
			properties.type = control&ax25Defs.U_FRAME_MASK;
			if(properties.type == ax25Defs.U_FRAME_UI) {
				properties.pid = frame.shift();
				properties.info = frame;
			}
		} else if((control&ax25Defs.U_FRAME) == ax25Defs.S_FRAME) {
			properties.type = control&ax25Defs.S_FRAME_MASK;
			properties.nr = (control&ax25Defs.NR)>>5;
		} else if((control&1) == ax25Defs.I_FRAME) {
			properties.type = ax25Defs.I_FRAME;
			properties.nr = (control&ax25Defs.NR)>>5;
			properties.ns = (control&ax25Defs.NS)>>1;
			properties.pid = frame.shift();
			properties.info = frame;
		} else {
			throw "ax25Packet.dissassemble: Invalid packet.";
		}
		
	}
	
	this.assemble = function() {
	
		// Try to catch a few obvious derps
		if(properties.destinationCallsign.length == 0)
			throw "ax25Packet: Destination callsign not set.";
		if(properties.sourceCallsign.length == 0)
			throw "ax25Packet: Source callsign not set.";
		if(	properties.type == ax25Defs.I_FRAME
			&&
			(	!properties.hasOwnProperty('pid')
				||
				!properties.hasOwnProperty('info')
				||
				properties.info.length == 0
			)
		) {
			throw "ax25Packet: I or UI frame with no payload.";
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
		frame.push((properties.command<<7)|(properties.destinationSSID<<1));

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
			(properties.response<<7)
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
		frame.push(this.control);

		// PID field (I and UI frames only)
		if(	properties.pid
			&&
			(	properties.type == ax25Defs.I_FRAME
				||
				properties.type == ax25Defs.U_FRAME_UI
			)
		) {
			frame.push(properties.pid);
		}

		// Info field (I and UI frames only)
		if(	properties.info.length > 0
			&&
			(	properties.type == ax25Defs.I_FRAME
				||
				properties.type == ax25Defs.U_FRAME_UI
			)
		) {
			for(var i = 0; i < properties.info.length; i++)
				frame.push(properties.info[i]);
		}
		
		return frame;
	}
	
	if(typeof frame != "undefined")
		this.disassemble(frame);
	
}

exports.ax25Packet = ax25Packet;