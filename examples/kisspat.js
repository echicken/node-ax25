/* KISS TNC reverse gateway for pat 
usage:
node kisspat.js [CMScallsign]
pat connect telnet://[YOURcallsign]@127.0.0.1:8772/

Listens for connections on CMS port 8772, pretends to be a CMS Telnet server, connects to CMS gateway over AX.25 instead.
Tested on Mac to Kenwood D74a over bluetooth to KB0SRJ-10 on 144.930 1200 baud.
*/

var net = require('net');
var ax25 = require("ax25/index.js"),
util = require("util");

var HOST = '127.0.0.1';
var PORT = 8772;
var urCallsign = "NOCALL";
var urSSID = 0;

var sessions = {};
var clients = {};

var myArgs = process.argv.slice(2);

urCallsign = parseCallsign(myArgs[0]);
urSSID = parseSSID(myArgs[0]);

var tnc = new ax25.kissTNC(
	{	serialPort : "/dev/tty.TH-D74-SerialPort",
		baudRate : 1200 
	}
);

tnc.on(
	"frame",
	function(frame) {
		var packet = new ax25.Packet();
		packet.disassemble(frame);
		var clientID = util.format(
			"[%s-%s|%s-%s]",
			packet.sourceCallsign.trim(),
			packet.sourceSSID,
			packet.destinationCallsign.trim(),
			packet.destinationSSID
		);

		//console.log(util.format("Recv frame %s: %s",clientID,packet.log()));

		if(typeof sessions[clientID] != "undefined")
			sessions[clientID].receive(packet);
	}

);


tnc.on( "opened", function() { console.log("TNC open on "+tnc.serialPort); 

// Create a server instance, and chain the listen function to it
// The function passed to net.createServer() becomes the event handler for the 'connection' event
// The sock object the callback function receives UNIQUE for each connection
net.createServer(function(sock) {

    console.log('Client connected: ' + sock.remoteAddress + ' ' + sock.remotePort);
    sock.cmsState = 1;
    sock.write("Callsign :\r");

    // Add a 'data' event handler to this instance of socket
    sock.on('data', function(data) {
  
        switch(sock.cmsState) {
          case 1:
	    sock.myCallsign = parseCallsign(data.toString());
            sock.mySSID = parseSSID(data.toString());
            sock.clientID = util.format(
			"[%s-%s|%s-%s]",
			urCallsign.trim(),
			urSSID,
			sock.myCallsign.trim(),
			sock.mySSID
		);
            clients[sock.clientID] = sock;
            sock.cmsState = 2;
            sock.write("Password :\r");
            break;
          case 2:
            sock.cmsState = 3;
            if(typeof sessions[sock.clientID] == "undefined") 
              connectKISS(sock.clientID,sock.myCallsign,sock.mySSID);
            else
	      console.log(util.format("Session %s already exists",clientID));
            break;
          case 3: 
            if(typeof sessions[sock.clientID] != "undefined") {
		console.log(util.format(
			"Send %s %s",sock.clientID,data.toString().replace(/[^\x20-\x7E]/g, '?')));
		//sessions[sock.clientID].send(string2Bin(data.toString()));
		sessions[sock.clientID].send(buffer2Bin(data));
            }
            else
	        console.log(util.format("Socket data received for unknown session %s",clientID));
            break;
          default:
            break;
        }
    });

    // Add a 'close' event handler to this instance of socket
    sock.on('close', function(data) {
        console.log('Client disconnected: ' + sock.remoteAddress +' '+ sock.remotePort);
        if(typeof sessions[sock.clientID] != "undefined") {
	 	sessions[sock.clientID].disconnect();
		delete sessions[sock.clientID];
	}
    });
    
   
}).listen(PORT, HOST);
   console.log('Server listening on ' + HOST +':'+ PORT);
 } );

function connectKISS(clientID,myCallsign,mySSID) {

    if(typeof sessions[clientID] == "undefined") {
        var session = new ax25.Session();
	session.localCallsign = myCallsign;
	session.localSSID = mySSID;
	session.remoteCallsign = urCallsign;
	session.remoteSSID = urSSID;
	sessions[clientID] = session; 
	session.on("packet",
			function(frame) {
					//console.log(util.format("Send frame %s - %s",clientID,frame.log()));
					tnc.send(frame.assemble());
			}
	);

	session.on("data",
			function(data) {
				console.log(
					util.format(
						"Recv %s %s",clientID,bin2String(data).replace(/[^\x20-\x7E]/g, '?')));
        			if(typeof clients[clientID] != "undefined") 
					clients[clientID].write(bin2String(data));
			}
	);

	session.on(
				"connection",
				function(state) {
					console.log(
						util.format(
							"Session %s %s.",
							clientID,
							(state) ? "connected" : "disconnected"
						)
					);
					if(!state) {
						delete sessions[clientID];
        					if(typeof clients[clientID] != "undefined") {
							clients[clientID].end();
							delete clients[clientID];
						}
					}
				}
			);

	session.on(
				"error",
				function(err) {
					console.log(err);
				}
			);
    session.connect();
    }
}

function buffer2Bin(buffer) {
  var result = [];
  for (var i = 0; i < buffer.length; i++) {
    result.push(buffer[i]);
  }
  return result;
}

function bin2String(array) {
  return String.fromCharCode.apply(String, array);
}

function parseCallsign(callsign)
{
  return callsign.trim().toUpperCase().split("-")[0].concat("      ").substr(0,6);
}

function parseSSID(callsign)
{
  var parts = callsign.trim().split("-");
  if(parts.length > 1)
	return parseInt(parts[1]);
  else 
	return 0;
}

