//const PRUDPPacketError = require('./errors/packet.error.class');

// Commented out because unused. Must please linter
//const RC4 = require('../rc4.class');
//const cipher = new RC4('CD&ML');
/*
const TYPES = require('./types/packet.types');
const FLAGS = require('./types/flag.types');*/

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
	is_type(type) {
		return this.type === type;
	}

	/**
	 * Sets the type of the packet
	 * @param {Number} type the type that the packet will be set to
	 */
	set_type() {
		throw new Error('Abstract method please instance a class that extends PRUDPPacket');
	}

	is_syn() {
		return this.is_type(TYPES.SYN);
	}

	is_connect() {
		return this.is_type(TYPES.CONNECT);
	}

	is_data() {
		return this.is_type(TYPES.DATA);
	}

	is_ping() {
		return this.is_type(TYPES.PING);
	}

	is_disconnect() {
		return this.is_type(TYPES.DISCONNECT);
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
	set_flag(flag) {
		this.flags |= flag;
	}

	/**
	 * removes a flag in the packet
	 * @param {Number} flag the flag to remove from the packet 
	 */
	remove_flag(flag) {
		this.flags &= ~flag;
	}

	has_flag_ack() {
		return this.has_flag(FLAGS.ACK);
	}
	has_flag_reliable() {
		return this.has_flag(FLAGS.RELIABLE);
	}
	has_flag_need_ack() {
		return this.has_flag(FLAGS.NEED_ACK);
	}
	has_flag_has_size() {
		return this.has_flag(FLAGS.HAS_SIZE);
	}
	has_flag_multi_ack() {
		return this.has_flag(FLAGS.MULTI_ACK);
	}

	//#endregion packet has flag methods


	calc_checksum(checksum, packet) { //TODO?
		const tuple = [];
		let pos = 0;

		for (let i=0;i<this.constructor.FloorDiv(packet.length, 4);i++) {
			tuple.push(packet.readUInt32LE(pos, true));
			pos += 4;
		}

		const sum = tuple.reduce((a, b) => {
			return a + b;
		}, 0);
		const temp = (sum & 0xFFFFFFFF) >>> 0;

		checksum += packet.subarray(-((packet.length & 3) >>> 0)).reduce((a, b) => {
			return a + b;
		}, 0);

		const buff = Buffer.alloc(4);
		buff.writeUInt32LE(temp, 0);

		checksum += buff.reduce((a, b) => {
			return a + b;
		}, 0);

		checksum = (checksum & 0xFF) >>> 0;

		console.log(checksum);

		return checksum;
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

	static isHex(str) {
		return /^([0-9A-Fa-f]{2})+$/.test(str);
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
		throw new PRUDPPacketError('Invalid packet structure');
	}

}

module.exports = PRUDPPacket;