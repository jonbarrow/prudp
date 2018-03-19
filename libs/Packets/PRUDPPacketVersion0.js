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
	if(packet.is_connect() || packet.is_syn()) {
		packet.connectionSignature = buffer.slice(currentOffset, currentOffset + packet.connectionSignatureLength);
		currentOffset += packet.connectionSignatureLength;
	} else if (packet.is_data()) {
		packet.fragmentID = buffer.readUInt8(currentOffset++);
	}

	if(packet.has_flag_has_size()) {
		packet.payloadSize = buffer.readUInt16LE(currentOffset);
		currentOffset += 2;
		packet.payload = buffer.slice(currentOffset, packet.payloadSize + currentOffset);
		currentOffset += packet.payloadSize;
	} else if (packet.is_data()  && !packet.has_flag_ack()) {
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
	PRUDPPacketVersion0(buffer) {
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

	toBuffer() {
		
	}
}