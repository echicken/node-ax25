var util		= require("util");
var events		= require("events");
var ax25		= require("./index.js");

var Session = function(args) {

	var self = this;
	events.EventEmitter.call(this);

}
util.inherits(Session, events.EventEmitter);

module.exports = Session;