const Masks = {
    flag : (63<<1), // Unused, but included for non-KISS implementations.
    address : { // Address field - SSID subfield bitmasks
        ext : 1,
    	crh : (1<<7), // Command/Response or Has-Been-Repeated bit of an SSID octet
    	rr : (3<<5), // The "R" (reserved) bits of an SSID octet
    	ssid : (15<<1), // The SSID portion of an SSID octet
    },
    control : { // Control field bitmasks
    	pf : (1<<4), // Poll/Final
    	ns : (7<<1), // N(S) - send sequence number
    	nr : (7<<5), // N(R) - receive sequence number
    	pf_128 : (1<<8), // Poll/Final in modulo 128 mode I & S frames
    	ns_128 : (127<<1), // N(S) in modulo 128 I frames
    	nr_128 : (127<<9), // N(R) in modulo 128 I & S frames
        frame_types : {
        	i_frame : { type : 0 }, // Information frame
        	s_frame : { // Supervisory frame and subtypes
                type : 1,
                mask : 1|(3<<2),
                subtypes : {
                	rr : 1, // Receive Ready
                	rnr : 1|(1<<2), // Receive Not Ready
                	rej : 1|(1<<3), // Reject
                	srej : 1|(3<<2) // Selective Reject
                }
            },
        	u_frame : { // Unnumbered frame and subtypes
                type : 3,
                mask : 15|(7<<5),
                subtypes : {
                	sabm : 15|(1<<5), // Set Asynchronous Balanced Mode
                	sabme : 3|(1<<3)|(3<<5), // SABM Extended
                	disc : 3|(1<<6), // Disconnect
                	dm : 15, // Disconnected Mode
                	ua : 3|(3<<5), // Acknowledge
                	frmr : 3|(1<<2)|(1<<7), // Frame Reject
                	ui : 3, // Information
                	xid : 15|(1<<5)|(1<<7), // Exchange Identification
                	test : 3|(7<<5)
                }
            }
        }
    },
    pid : { // Protocol ID field bitmasks
    	x25 : 1, // ISO 8208/CCITT X.25 PLP
    	ctcpip : (3<<1), // Compressed TCP/IP packet. Van Jacobson (RFC 1144)
    	utcpip : 7, // Uncompressed TCP/IP packet. Van Jacobson (RFC 1144)
    	segf : (1<<3), // Segmentation fragment
    	texnet : 3|(3<<6), // TEXNET datagram protocol
    	lqp : (1<<2)|(3<<6), // Link Quality Protocol
    	atalk : (1<<1)|(1<<3)|(3<<6), // Appletalk
    	atalkarp : 3|(1<<3)|(3<<6), // Appletalk ARP
    	arpaip : (3<<2)|(3<<6), // ARPA Internet Protocol
    	arpaar : (1<<0)|(3<<2)|(3<<6), // ARPA Address Resolution
    	flexnet : (7<<1)|(3<<6), // FlexNet
    	netrom : 15|(3<<6), // Net/ROM
    	none : (15<<4), // No layer 3 protocol implemented
    	esc : 255 // Escape character. Next octet contains more Level 3 protocol information.
    }
};

module.exports = Masks;
