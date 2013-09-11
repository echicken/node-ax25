var ax25Utils = function() {

	/*	testCallsign(callsign) - boolean
	Returns true if 'callsign' is a valid AX.25 callsign (a string
	containing up to six letters and numbers only.) */
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
}