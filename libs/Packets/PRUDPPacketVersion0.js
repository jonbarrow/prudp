const PRUDPPacket = require('./PRUDPPacket');

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
	if(packet.isConnect() || packet.is_syn()) {
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
	} else if (packet.isData()  && !packet.hasFlagHack()) {
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
		this.connectionSignatureLength = 4;
		this.packetSignatureLength = 4;
		if(buffer != undefined && buffer !== null) {
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
		buffer.writeUInt8(this.sessionId, currentOffset++);
		this.packetSignature.copy(buffer, currentOffset);
		currentOffset += this.packetSignatureLength;
		buffer.writeUInt16LE(this.sequenceId, currentOffset);	
		currentOffset += 2;
		
		if(this.isConnect() || this.is_syn()) {
			this.connectionSignature.copy(buffer, currentOffset);
			currentOffset += this.connectionSignatureLength;
		} else if(this.isData()) {
			buffer.writeUInt8(this.fragmentID, currentOffset++);
		}
		
		if((this.isData() && !this.hasFlagHack()) || this.hasFlagHasSize()) {
			let size = this.payloadSize;
			if(this.hasFlagHasSize()) {
				buffer.writeUInt16LE(this.payloadSize, currentOffset);
				currentOffset += 0x02;
			} else {
				size = this.payload === null ? 0 : buffer.length;
			} 
			this.payload.copy(buffer, currentOffset);
			currentOffset += size;
		}
		buffer.writeUInt8(this.checksum, currentOffset++);
		return buffer.slice(0, currentOffset);
	}
	
	/**
	* Sets the checksum of the packet
	* @param {(String|Buffer|Number)} key the key used to hash the packet
	*/
	setChecksum(key) {
		let number = 0;
		if(typeof key === 'String') {
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
		key += buffer.subarray(-((length & 3) >>> 0)).reduce((a, b) => {
			return a + b;
		}, 0);
		
		const buff = Buffer.alloc(4);
		buff.writeUInt32LE(sum, 0);
		key += buff.reduce((a, b) => { return a + b; }, 0);
		
		return (key & 0xFF) >>> 0;
	}
}

module.exports = PRUDPPacketVersion0;