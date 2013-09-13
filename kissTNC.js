var kissDefs	= require("./kissdefs.js").kissDefs;
var util		= require("util");
var events		= require("events");
var SerialPort	= require("serialport").SerialPort;

var kissTNC = function(
	serialPort,		// eg. "COM3" or "/dev/ttyUSB0" (Required)
	baudRate,		// eg. 9600 (rate for serial comms with the TNC) (Required)
	txDelay,		// In milliseconds (Optional)
	persistence,	// eg. .25, a number between zero and 1 (Optional)
	slotTime,		// In milliseconds (Optional)
	txTail,			// In milliseconds (Optional, deprecated)
	fullDuplex		// Boolean (Optional)
) {

	events.EventEmitter.call(this);

	var self = this;

	var properties = {
		'serialPort'	: 0,
		'baudRate'		: 0,
		'txDelay'		: 50,
		'persistence'	: 63,
		'slotTime'		: 10,
		'txTail'		: 1,
		'fullDuplex'	: false
	}

	this.__defineSetter__(
		"serialPort",
		function(serialPort) {
			if(typeof serialPort != "string")
				throw "kissTNC: Invalid or no serialPort argument provided.";
			properties.serialPort = serialPort;
		}
	);
	
	this.__defineGetter__(
		"serialPort",
		function() {
			return properties.serialPort;
		}
	);
	
	this.__defineSetter__(
		"baudRate",
		function(baudRate) {
			if(typeof baudRate != "number")
				throw "kissTNC: Invalid or no baudRate argument provided.";
			properties.baudRate = baudRate;
		}
	);
	
	this.__defineGetter__(
		"baudRate",
		function() {
			return properties.baudRate;
		}
	);

	this.__defineSetter__(
		"txDelay",
		function(txDelay) {
			if(	typeof txDelay != "number"
				||
				txDelay < 0
				||
				txDelay > 255
			) {
				throw "kissTNC: Invalid txDelay";
			}
			properties.txDelay = txDelay / 10;
			sendFrame(kissDefs.TXDELAY, [properties.txDelay]);
		}
	);
	
	this.__defineGetter__(
		"txDelay",
		function() {
			return properties.txDelay * 10;
		}
	);

	this.__defineSetter__(
		"persistence",
		function(persistence) {
			if(	typeof persistence != "number"
				||
				persistence < 0
				||
				persistence > 1
			) {
				throw "kissTNC: Invalid persistence";
			}
			properites.persistence = (persistence * 256) - 1;
			sendFrame(kissDefs.PERSISTENCE, [properties.persistence]);
		}
	);
	
	this.__defineGetter__(
		"persistence",
		function() {
			return (properties.persistence / 256) + 1;
		}
	);

	this.__defineSetter__(
		"slotTime",
		function(slotTime) {
			if(	typeof slotTime != "number"
				||
				slotTime < 0
				||
				slotTime > 255
			) {
				throw "kissTNC: Invalid slotTime";
			}
			properties.slotTime = slotTime / 10;
			sendFrame(kissDefs.SLOTTIME, [properties.slotTIme]);
		}
	);
	
	this.__defineGetter__(
		"slotTime",
		function() {
			return properties.slotTime * 10;
		}
	);
	
	this.__defineSetter__(
		"txTail",
		function(txTail) {
			if(	typeof txTail != "number"
				||
				txTail < 0
				||
				txTail > 255
			)
				throw "kissTNC: Invalid txTail";
			properties.txTail = txTail / 10;
			sendFrame(kissDefs.TXTAIL, [properties.txTail]);
		}
	);
	
	this.__defineGetter__(
		"txTail",
		function() {
			return properties.txTail * 10;
		}
	);

	this.__defineSetter__(
		"fullDuplex",
		function(fullDuplex) {
			if(typeof fullDuplex != "boolean")
				throw "kissTNC: fullDuplex must be boolean";
			properties.fullDuplex = fullDuplex;
			sendFrame(
				kissDefs.FULLDUPLEX,
				[(properties.fullDuplex) ? 1 : 0]
			);
		}
	);
	
	this.__defineGetter__(
		"fullDuplex",
		function() {
			return (properties.fullDuplex == 1) ? true : false;
		}
	);
	
	this.serialPort		= serialPort;
	this.baudRate		= baudRate;
	
	var dataBuffer = [];
		
	var sendFrame = function(command, data) {
		if(!(data instanceof Array))
			throw "kissTNC: Invalid send data";
		data.unshift(command);
		data.unshift(kissDefs.FEND);
		data.push(kissDefs.FEND);
		serialHandle.write(
			data,
			function(err, result) {
				if(typeof err != "undefined")
					self.emit("error", "kissTNC: Send error: " + err);
				if(typeof result != "undefined")
					self.emit("sent", "kissTNC: Send result: " + result);
			}
		);
	}
	
	var dataHandler = function(data) {
		var str = "";
		var escaped = false;
		for(var d = 0; d < data.length; d++) {
			if(data[d] == kissDefs.FESC) {
				escaped = true;
				continue;
			}
			if(escaped && data[d] == kissDefs.TFEND)
				data[d] = kissDefs.FEND;
			if(escaped && data[d] == kissDefs.TFESC)
				data[d] = kissDefs.FESC;
			if(escaped || data[d] != kissDefs.FEND)
				dataBuffer.push(data[d]);
			if(!escaped && data[d] == kissDefs.FEND && dataBuffer.length > 1) {
				self.emit("frame", dataBuffer.slice(1));
				dataBuffer = [];
			}
			if(escaped)
				escaped = false;
		}
	}
	
	var serialHandle = new SerialPort(
		properties.serialPort, {
			'baudRate' : properties.baudRate
		}
	);
	
	serialHandle.on(
		"error",
		function(err) {
			self.emit("error", "kissTNC: Serial port error: " + err);
		}
	);
	
	serialHandle.on(
		"open",
		function() {
			if(typeof txDelay != "undefined")
				self.txDelay = txDelay;
			if(typeof persistence != "undefined")
				self.persistence = persistence;
			if(typeof slotTime != "undefined")
				self.slotTIme = slotTime;
			if(typeof txTail != "undefined")
				self.txTail = txTail;
			if(typeof fullDupled != "undefined")
				self.fullDuplex = fullDuplex;
			self.emit("opened");
		}
	);
	
	serialHandle.on(
		"close",
		function() {
			self.emit("closed");
		}
	);
		
	serialHandle.on(
		"data",
		function(data) {
			dataHandler(data);
		}
	);

	this.setHardware = function(value) {
		sendFrame(kissDefs.SETHARDWARE, [value]);
	}
	
	this.send = function(data) {
		if(!(data instanceof Array))
			throw "kissTNC.send: data type mismatch.";
		sendFrame(kissDefs.DATAFRAME, data);
	}
	
	this.exitKISS = function() {
		sendFrame(kissDefs.RETURN, []);
	}

	this.close = function() {
		serialHandle.close();
	}
	
}
util.inherits(kissTNC, events.EventEmitter);

exports.kissTNC = kissTNC;