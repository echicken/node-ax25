#node-ax25

A KISS &amp; AX.25 stack for node.js.

This project is incomplete, but is in progress as of September 2013.  Usage examples will follow once there's more that can be done with this.

In its current state, this module could be used for things like APRS monitoring and messaging, or anything else that doesn't require connected-mode sessions or flow control.

Next up is an ax25Session object, to be followed by some kind of ax25Server.  These will allow stateful sessions with remote systems.

---

###Dependencies

[node-serialport](https://github.com/voodootikigod/node-serialport)

If you intend to interface with a conventional KISS TNC, the node-serialport module will be required.  Installation of this package can be a bit more complicated than is usual, so be sure to read the instructions.