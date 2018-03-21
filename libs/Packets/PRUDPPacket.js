//const PRUDPPacketError = require('./errors/packet.error.class');

// Commented out because unused. Must please linter
//const RC4 = require('../rc4.class');
//const cipher = new RC4('CD&ML');
/*
const TYPES = require('./types/packet.types');
const FLAGS = require('./types/flag.types');*/

const TYPES = {
	SYN: 0,
	CONNECT: 1,
	DATA: 2,
	DISCONNECT: 3,
	PING: 4
};
const FLAGS = {
	ACK: 1,
	RELIABLE: 2,
	NEED_ACK: 4,
	HAS_SIZE: 8,
	MULTI_ACK: 200
};

/**
 * Class that represents a PRUDP packet
 */
class PRUDPPacket {

	constructor(version = 0) {
		this.version = version;
		this.channels = {
			source: 0,
			destination: 0
		}
		this.connectionSignatureLength = 0;
		this.packetSignatureLength = 0;
		this.type = 0;
		this.flags = 0;
		this.sessionId = 0;
		this.sequenceId = 0;
		this.fragmentID = 0;
		/**@type {Buffer} */
		this.connectionSignature = null;
		/**@type {Buffer} */
		this.packetSignature = null;
		/**@type {Buffer} */
		this.payload = null;
		this.payloadSize = 0;
		this.implementsChecksum = false;
		this.checksum = 0;
	}

	//#region packet type methods
	/**
	 * Checks if the packet is of the given type
	 * @param {Number} type the type to check agaisnt
	 * @return {Boolean} returns true if the packet matches the specified type
	 */
	isType(type) {
		return this.type === type;
	}

	/**
	 * Sets the type of the packet
	 * @param {Number} type the type that the packet will be set to
	 */
	setType(type) {
		this.type = type;
	}

	isSyn() {
		return this.isType(TYPES.SYN);
	}

	isConnect() {
		return this.isType(TYPES.CONNECT);
	}

	isData() {
		return this.isType(TYPES.DATA);
	}

	isPing() {
		return this.isType(TYPES.PING);
	}

	isDisconnect() {
		return this.isType(TYPES.DISCONNECT);
	}
	//#endregion packet type methods

	//#region packet has flag methods

	/**
	 * Checks if the packet has th given flag
	 * @param {Number} flag the flag to check 
	 * @return {Boolean} returns true if the packet has the specified flag
	 */
	has_flag(flag) {
		return (this.flags & flag) === flag;
	}

	/**
	 * Sets a flag in the packet
	 * @param {Number} flag the flag to add to the packet 
	 */
	setFlag(flag) {
		this.flags |= flag;
	}

	/**
	 * removes a flag in the packet
	 * @param {Number} flag the flag to remove from the packet 
	 */
	remove_flag(flag) {
		this.flags &= ~flag;
	}

	hasFlagAck() {
		return this.has_flag(FLAGS.ACK);
	}
	hasFlagReliable() {
		return this.has_flag(FLAGS.RELIABLE);
	}
	hasFlagNeedAck() {
		return this.has_flag(FLAGS.NEED_ACK);
	}
	hasFlagHasSize() {
		return this.has_flag(FLAGS.HAS_SIZE);
	}
	hasFlagMultiAck() {
		return this.has_flag(FLAGS.MULTI_ACK);
	}

	//#endregion packet has flag methods

	static isHex(str) {
		return /^([0-9A-Fa-f]{2})+$/.test(str);
	}

	/**
	 * Sets the checksum of the packet
	 * @param {(String|Buffer|Number)} key the key used to hash the packet
	 */
	setChecksum(key) {
		throw new Error('Abstract method please instance a class that extends PRUDPPacket');
	}

	/**
	 * Converts the object to a string(debug/visual)
	 * @returns {String} The converted string
	 */
	toString() {
		throw new Error('Abstract method please instance a class that extends PRUDPPacket');
	}

	/**
	 * Convers this packet to a buffer
	 * @returns {Buffer} the buffer representing the packet instance
	 */
	toBuffer() {
		throw new Error('Abstract method please instance a class that extends PRUDPPacket');
	}

	/**
	 * Creates an ack packet(if necessary) for this packet
	 * @param {Object} options Options for creating a packet
	 * @param {?Buffer} options.connectionSignature the connection signature for the syn packet ack, if null generate a random signature
	 * @param {?Buffer} options.packetSignaturethe packet signature for the connect packet ack, if null generate a random signature
	 * @param {?Number} options.sessionId the sessionID for every packet except SYN
	 * @returns {PRUDPPacketVersion0} if the packet doesn't have the NeedAck flag returns null
	 * otherwise returns the created packet
	 */
	createAck(options) {
		throw new Error('Abstract method please instance a class that extends PRUDPPacket');
	}

	/**
	 * Creates a packet of type syn
	 * @returns {PRUDPPacket} the created Packet
	 */
	static createSyn() {
		throw new Error('Abstract method please instance a class that extends PRUDPPacket');
	}

	/**
	 * Parses a given string of buffer to an instance of PRUDPacket
	 * @param {Buffer|String} raw the buffer or string from which the packet will be parsed
	 * @returns {PRUDPPacket} returns an object that represents the 
	 */
	static parse() {
		throw new Error('Abstract method please instance a class that extends PRUDPPacket');
	}

	/**
	 * Gets the packet version from the buffer
	 * @param {Buffer} buffer the buffer containing the packet data
	 * @returns {Number}
	 */
	static getVersionFromBuffer(buffer) {
		if(buffer[0] === 0xA1 && buffer[1] === 0xAF || buffer[0] === 0xAF && buffer[1] === 0xA1) {
			return 0;
		} else if(buffer[0] === 0xEA && buffer[1] === 0xD0) {
			return buffer[2];
		}
		throw new Error('Invalid packet structure');
	}



}
PRUDPPacket.TYPES = TYPES;
PRUDPPacket.FLAGS = FLAGS;
module.exports = PRUDPPacket;