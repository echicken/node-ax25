var ax25Utils = function() {

	var whatever = "whatever";
	this.whatever = whatever;

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

exports.ax25Utils = ax25Utils;