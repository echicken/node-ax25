// AX.25 & KISS protocol-related constants

var Defs = {
	FLAG : (1<<1)|(1<<2)|(1<<3)|(1<<4)|(1<<5)|(1<<6),	// Unused, but included for non-KISS implementations.

	// Address field - SSID subfield bitmasks
	A_CRH	: (1<<7),						// Command/Response or Has-Been-Repeated bit of an SSID octet
	A_RR	: (1<<5)|(1<<6),				// The "R" (reserved) bits of an SSID octet
	A_SSID	: (1<<1)|(1<<2)|(1<<3)|(1<<4),	// The SSID portion of an SSID octet

	// Control field bitmasks
	PF 				: (1<<4),				// Poll/Final
	NS 				: (1<<1)|(1<<2)|(1<<3),	// N(S) - send sequence number
	NR 				: (1<<5)|(1<<6)|(1<<7),	// N(R) - receive sequence number
	PF_MODULO128	: (1<<8), 				// Poll/Final in modulo 128 mode I & S frames
	NS_MODULO128	: (127<<1),				// N(S) in modulo 128 I frames
	NR_MODULO128	: (127<<9),				// N(R) in modulo 128 I & S frames
	// 	Information frame
	I_FRAME			: 0,
	I_FRAME_MASK	: 1,
	// 	Supervisory frame and subtypes
	S_FRAME			: 1,
	S_FRAME_RR		: 1,				// Receive Ready
	S_FRAME_RNR		: 1|(1<<2),			// Receive Not Ready
	S_FRAME_REJ		: 1|(1<<3),			// Reject
	S_FRAME_SREJ	: 1|(1<<2)|(1<<3),	// Selective Reject
	S_FRAME_MASK	: 1|(1<<2)|(1<<3),
	// 	Unnumbered frame and subtypes
	U_FRAME			: 3,
	U_FRAME_SABM	: 3|(1<<2)|(1<<3)|(1<<5),			// Set Asynchronous Balanced Mode
	U_FRAME_SABME	: 3|(1<<3)|(1<<5)|(1<<6),			// SABM for modulo 128 operation
	U_FRAME_DISC	: 3|(1<<6),							// Disconnect
	U_FRAME_DM		: 3|(1<<2)|(1<<3),					// Disconnected Mode
	U_FRAME_UA		: 3|(1<<5)|(1<<6),					// Acknowledge
	U_FRAME_FRMR	: 3|(1<<2)|(1<<7),					// Frame Reject
	U_FRAME_UI		: 3,								// Information
	U_FRAME_XID		: 3|(1<<2)|(1<<3)|(1<<5)|(1<<7),	// Exchange Identification
	U_FRAME_TEST	: 3|(1<<5)|(1<<6)|(1<<7),			// Test
	U_FRAME_MASK	: 3|(1<<2)|(1<<3)|(1<<5)|(1<<6)|(1<<7),

	// Protocol ID field bitmasks (most are unlikely to be used, but are here for the sake of completeness.)
	PID_X25			: 1,											// ISO 8208/CCITT X.25 PLP
	PID_CTCPIP		: (1<<1)|(1<<2),								// Compressed TCP/IP packet. Van Jacobson (RFC 1144)
	PID_UCTCPIP		: (1<<0)|(1<<1)|(1<<2),							// Uncompressed TCP/IP packet. Van Jacobson (RFC 1144)
	PID_SEGF		: (1<<4),										// Segmentation fragment
	PID_TEXNET		: (1<<0)|(1<<1)|(1<<6)|(1<<7),					// TEXNET datagram protocol
	PID_LQP			: (1<<2)|(1<<6)|(1<<7),							// Link Quality Protocol
	PID_ATALK		: (1<<1)|(1<<3)|(1<<6)|(1<<7),					// Appletalk
	PID_ATALKARP	: (1<<0)|(1<<1)|(1<<3)|(1<<6)|(1<<7),			// Appletalk ARP
	PID_ARPAIP		: (1<<2)|(1<<3)|(1<<6)|(1<<7),					// ARPA Internet Protocol
	PID_ARPAAR		: (1<<0)|(1<<2)|(1<<3)|(1<<6)|(1<<7),			// ARPA Address Resolution
	PID_FLEXNET		: (1<<1)|(1<<2)|(1<<3)|(1<<6)|(1<<7),			// FlexNet
	PID_NETROM		: (1<<0)|(1<<1)|(1<<2)|(1<<3)|(1<<6)|(1<<7),	// Net/ROM
	PID_NONE		: (1<<4)|(1<<5)|(1<<6)|(1<<7),					// No layer 3 protocol implemented
	PID_ESC			: 255											// Escape character. Next octet contains more Level 3 protocol information.
}

module.exports = Defs;