'use strict';
const EventEmitter = require('events');
const path = require('path');
const Masks = require(path.join(__dirname, 'masks.js'));
const Packet = require(path.join(__dirname, 'packet.js'));

class Session extends EventEmitter {

    constructor () {

        super();

    }

}

module.exports = Session;
