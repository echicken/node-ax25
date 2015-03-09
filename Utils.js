var util = require("util");

var Utils = function() {

	this.testCallsign = function(callsign) {
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

	this.logByte = function(b) {
		console.log(
			util.format(
				"%d%d%d%d%d%d%d%d",
				(b & (1<<7)) ? 1 : 0,
				(b & (1<<6)) ? 1 : 0,
				(b & (1<<5)) ? 1 : 0,
				(b & (1<<4)) ? 1 : 0,
				(b & (1<<3)) ? 1 : 0,
				(b & (1<<2)) ? 1 : 0,
				(b & (1<<1)) ? 1 : 0,
				(b & (1<<0)) ? 1 : 0
			)
		);
	}

	/*	distanceBetween(leader, follower, modulus)
		Find the difference between 'leader' and 'follower' modulo 'modulus'. */
	this.distanceBetween = function(l, f, m) {
		return (l < f) ? (l + (m - f)) : (l - f);
	}

	// Turns a string into an array of character codes
	this.stringToByteArray = function(s) {
		s = s.split("");
		var r = new Array();
		for(var i = 0; i < s.length; i++)
			r.push(s[i].charCodeAt(0));
		return r;
	}

	// Turns an array of ASCII character codes into a string
	this.byteArrayToString = function(s) {
		var r = "";
		for(var i = 0; i < s.length; i++)
			r += String.fromCharCode(s[i]);
		return r;
	}


}

module.exports = new Utils;