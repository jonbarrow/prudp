const PRUDPPacket = require('./PRUDPPacket');
const crypto = require('crypto');
/**
* Deserializes a packet 
* @param {PRUDPPacket} packet The prudppacket instance where to read the buffer to
* @param {Buffer} buffer The buffer containing the packet
*/
function parseBuffer(packet, buffer){
	let currentOffset = 0;
	packet.channels.source = buffer.readUInt8(currentOffset++);
	packet.channels.destination = buffer.readUInt8(currentOffset++);
	const type_flags = buffer.readUInt16LE(currentOffset);
	currentOffset += 2;
	packet.type = type_flags & 0x000F;
	packet.flags = (type_flags & 0xFFF0) >> 4;
	packet.sessionId = buffer.readUInt8(currentOffset++);
	packet.packetSignature = buffer.slice(currentOffset, currentOffset + packet.packetSignatureLength);
	currentOffset += packet.packetSignatureLength;
	packet.sequenceId = buffer.readUInt16LE(currentOffset);
	currentOffset += 2;
	if(packet.isConnect() || packet.isSyn()) {
		packet.connectionSignature = buffer.slice(currentOffset, currentOffset + packet.connectionSignatureLength);
		currentOffset += packet.connectionSignatureLength;
	} else if (packet.isData()) {
		packet.fragmentID = buffer.readUInt8(currentOffset++);
	}
	
	if(packet.hasFlagHasSize()) {
		packet.payloadSize = buffer.readUInt16LE(currentOffset);
		currentOffset += 2;
		packet.payload = buffer.slice(currentOffset, packet.payloadSize + currentOffset);
		currentOffset += packet.payloadSize;
	} else if (packet.isData()  && !packet.hasFlagAck()) {
		packet.payloadSize = buffer.length - currentOffset - 1;
		packet.payload = buffer.slice(currentOffset, packet.payloadSize + currentOffset);
		currentOffset += packet.payloadSize;
	}
	packet.checksum = buffer.readUInt8(currentOffset);
}

/**
* Class that represents a PRUDPPacket of version 0
*/
class PRUDPPacketVersion0 extends PRUDPPacket {
	/**
	* Creates an instance of a PRUDPPacket version 0
	* @param {(String|Buffer)} [buffer] 
	*/
	constructor(buffer) {
		super(0);
		this.implementsChecksum = true;
		this.packetSignature = Buffer.alloc(this.packetSignatureLength);
		this.packetSignature.fill(0)
		this.connectionSignature = Buffer.alloc(this.connectionSignatureLength);
		this.connectionSignature.fill(0)
		this.connectionSignatureLength = 4;
		this.packetSignatureLength = 4;
		if(buffer !== undefined && buffer !== null) {
			if(typeof buffer === 'String' && PRUDPPacket.isHex(buffer)) {
				buffer = Buffer.from(buffer, 'hex');
			}
			if(buffer instanceof Buffer) {
				parseBuffer(this, buffer);
			} 
		} 
	}
	
	/**
	* Serializes the instance of PRUDPPacket to a buffer
	* @param {Number} [maxPacketSize=500]
	* @returns {Buffer}
	*/
	toBuffer(maxPacketSize = 500) {
		const buffer = Buffer.alloc(maxPacketSize);
		let currentOffset = 0;
		buffer.writeUInt8(this.channels.source, currentOffset++);
		buffer.writeUInt8(this.channels.destination, currentOffset++);
		const type_flags = (this.flags << 4) | this.type;
		buffer.writeUInt16LE(type_flags, currentOffset);
		currentOffset += 2;
		buffer.writeUInt8((this.sessionId & 0xFF) >>>0, currentOffset++);
		this.packetSignature.copy(buffer, currentOffset);
		currentOffset += this.packetSignatureLength;
		buffer.writeUInt16LE(this.sequenceId, currentOffset);	
		currentOffset += 2;
		
		if(this.isConnect() || this.isSyn()) {
			this.connectionSignature.copy(buffer, currentOffset);
			currentOffset += this.connectionSignatureLength;
		} else if(this.isData()) {
			buffer.writeUInt8(this.fragmentID, currentOffset++);
		}
		
		if((this.isData() && !this.hasFlagAck()) || this.hasFlagHasSize()) {
			let size = this.payloadSize;
			if(this.hasFlagHasSize()) {
				buffer.writeUInt16LE(this.payloadSize, currentOffset);
				currentOffset += 0x02;
			} else {
				size = this.payload === null ? 0 : buffer.length;
			} 
 			if(size > 0) {
				this.payload.copy(buffer, currentOffset);
				currentOffset += size;
			}

		}
		buffer.writeUInt8(this.checksum, currentOffset++);
		return buffer.slice(0, currentOffset);
	}
	
	/**
	* Sets the checksum of the packet
	* @param {(String|Buffer|Number)} key the key used to hash the packet
	*/
	setChecksum(key) {
		this.checksum = calculateChecksum.call(this, key);
	}
	
	/**
	* Checks the checksum of the packet
	* @param {(String|Buffer|Number)} key the key used to hash the packet
	* @returns {Boolean} true if the checksum matches the calculated checksum
	*/
	checkChecksum(key) {
		return this.checksum === calculateChecksum.call(this, key)
	}
	
	/**
	* Creates an ack packet(if necessary) for this packet
	* @param {Object} options Options for creating a packet
	* @param {?Buffer} options.connectionSignature the connection signature for the syn packet ack, if null generate a random signature
	* @param {?Buffer} options.packetSignature packet signature for the connect packet ack, if null generate a random signature
	* @param {?Number} options.sessionId the sessionID for every packet except SYN
	* @returns {PRUDPPacketVersion0} if the packet doesn't have the NeedAck flag returns null
	* otherwise returns the created packet
	*/
	createAck(options) {
		if(!this.hasFlagNeedAck())
		return undefined;
		if (options == null) {
			options = {};
		}
		const ack = new PRUDPPacketVersion0();
		let hasSessionId = options.sessionId != null;
		ack.setType(this.type);
		ack.setFlag(PRUDPPacket.FLAGS.ACK);
		ack.channels.destination = this.channels.source;
		ack.channels.source = this.channels.destination;
		ack.sequenceId = this.sequenceId;
		
		if(this.isSyn()) {
			ack.setFlag(PRUDPPacket.FLAGS.HAS_SIZE);
			ack.sessionId = options.sessionId;			
			if(options.connectionSignature == null) {
				options.connectionSignature = crypto.randomBytes(this.connectionSignatureLength);
			}
			if(options.connectionSignature.length !== this.connectionSignatureLength) {
				throw new Error('Invalid connection signature length');
			}
			ack.connectionSignature = options.connectionSignature;
		} else if(hasSessionId) {
			ack.sessionId = options.sessionId;			
			if (this.isConnect()) {
				ack.setFlag(PRUDPPacket.FLAGS.HAS_SIZE);	
				if(options.packetSignature == null) {
					options.packetSignature = crypto.randomBytes(this.packetSignatureLength);
				}
				if(options.packetSignature.length !== this.packetSignatureLength) {
					throw new Error('Invalid packet signature length');
				}			
				ack.packetSignature = options.packetSignature;
			} else if (this.isData()) {
				ack.setFlag(PRUDPPacket.FLAGS.HAS_SIZE);
				const packetSignature = Buffer.alloc(this.packetSignatureLength);
				packetSignature.writeUInt32BE(0x12345678);
				ack.packetSignature = packetSignature;
			} else if (this.isDisconnect()) {
				//as is
			} else if (this.isPing()) {
				//TODO hows is packet signature generated?
			} else {
				throw new Error(`Unknown packet type ${this.type}`);
			}
		} else {
			throw new Error(`Missing session id in paramter for packet type ${this.type}`);
		}
		return ack;
	}
	
	/**
	* Creates a packet of type syn
	* @param {Number} localChannel the channel where this packet originates from
	* @param {Number} remoteChannel the channel where this packet is destinated to
	* @returns {PRUDPPacketVersion0} the created Packet
	*/
	static createSyn(localChannel, remoteChannel) {
		const syn = new PRUDPPacketVersion0();
		syn.setType(PRUDPPacket.TYPES.SYN);
		syn.setFlag(PRUDPPacket.FLAGS.NEED_ACK);
		syn.channels.source = localChannel;
		syn.channels.destination = remoteChannel;
		return syn;
	}
	
	/**
	* Creates a packet of type connect
	* @param {Number} localChannel the channel where this packet originates from
	* @param {Number} remoteChannel the channel where this packet is destinated to
	* @param {Buffer} connectionSignature
	* @param {Buffer} packetSignature
	* @returns {PRUDPPacket} the created Packet
	*/
	static createConnect(localChannel, remoteChannel, connectionSignature, packetSignature ) {
		const con = new PRUDPPacketVersion0();
		con.setType(PRUDPPacket.TYPES.CONNECT);
		con.setFlag(PRUDPPacket.FLAGS.NEED_ACK);
		con.setFlag(PRUDPPacket.FLAGS.RELIABLE);
		con.channels.source = localChannel;
		con.channels.destination = remoteChannel;	
		con.packetSignature = packetSignature;
		con.connectionSignature = connectionSignature;
		con.sequenceId = 1;
		return con
	}
	
	/**
	* Checks if the buffer is of version V0
	* @param {Buffer} buffer the buffer containing the package
	* @returns {Boolean} true if the buffer is of type V0; 
	*/
	static isBufferVersion0(buffer) {
		const source = buffer.readUInt8(0);
		const destination = buffer.readUInt8(1);
		if(source >= 0xA0 && source <= 0xAF && destination >= 0xA0 && destination <= 0xAF ) 
		return true;
		return false;
	}
}
/**
* Calculates the checksum of the packet
* @param {(String|Buffer|Number)} key the key used to hash the packet
* @returns {Number} the checksum
*/
function calculateChecksum(key) {
	let number = 0;
	if(typeof key === 'string') {
		key = Buffer.from(key);
	} 
	if (key instanceof Buffer) {
		key = key.reduce((a, b) => { return a + b; });
	}
	if(typeof key === 'number') {
		number = key & 0xFF;
	} else {
		throw new Error('Invalid key format to create checksum');
	}
	let buffer = this.toBuffer();
	buffer = buffer.slice(0, buffer.length - 1);
	const length = buffer.length;
	const tuple = [];
	let pos = 0;
	let sum = 0;
	const words = Math.floor(length/4);
	for (let i = 0; i < Math.floor(length/4); i++) {
		sum += buffer.readUInt32LE(i * 4, true);
	}
	sum = (sum & 0xFFFFFFFF) >>> 0;
	for(let i = words * 4; i < length; ++i) {
		key += buffer.readUInt8(i);
	}
	
	
	const buff = Buffer.alloc(4);
	buff.writeUInt32LE(sum, 0);
	key += buff.reduce((a, b) => { return a + b; });
	return (key & 0xFF) >>> 0;
}

module.exports = PRUDPPacketVersion0;