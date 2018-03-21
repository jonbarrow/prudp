const Packets = require('./Packets');
const PRUDPPacket = Packets.PRUDPPacket;
const PRUDPPacketVersion0 = Packets.PRUDPPacketVersion0;
const EventEmitter = require('events');
const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const dgram = require('dgram');

class SentPRUDPPacket { 
	/**
	 * Creates and instance of the PRUDP packet
	 * @param {PRUDPPacket} packet The packet that was sent
	 * @param {Number} timeoutReference The setTimeout value returned 
	 */
	constructor(packet, timeoutReference) {
		this.packet = packet;
		this.timeoutReference = timeoutReference;
	}
}

/**
 * Class that manages how many packets may be in transit without having a confirmation
 */
class PRUDPCongestionWindow {
	/**
	 * Creates and instance of a prudp congestion window
	 * @param {Number} [maxWindowSize=5] sets the maximum number of unacknowledged packets that may be in transit end-to-end
	 */
	constructor(maxWindowSize=5) {
		this.maxWindowSize = maxWindowSize;
		this.currentSize = 0;
		this.window = {}
	}

	/**
	 * Checks if the current windowSize is full
	 * @returns {Boolean} true if the maxWindowSize equals to the number of packets in transit
	 */
	isFull() {
		return this.currentSize === this.maxWindowSize;
	}

	/**
	 * Adds a packet to the window size
	 * @param {SentPRUDPPacket} sentPacket the packet sent by the PRUDP instance
	 * @returns {Boolean} returns true if the packet was added to to the window
	 */
	addSentPacket(sentPacket) {
		if(this.isFull())
			return false;
		this.currentSize++;
		this.window[sentPacket.packet.sequenceId] = sentPacket;
		return true;
	}

	/**
	 * Acknowledges a packet
	 * @param {PRUDPPacket} packet the packet that acknowledged another packet 
	 * TODO
	 */
	acknowledgePacket(packet) {
		if(this.window[packet.sequenceId] !== undefined) {
			this.currentSize--;
			delete this.window[packet.sequenceId];
		}
	}
}

class PRUDP extends EventEmitter {
	/**
	 * Creates a prudp client
	 * @param {!String} host The host to connect to
	 * @param {!Number} port The port to connect to in the host
	 * @param {!String} access_key The access key used to create checksum and packet signature
	 * @param {!String} encryption_key The encryption key for the payload
	 * @param {Number} [version=0] The PRUDP protocol version to use
	 * @param {Number} [localChannel=0xAF] The local prudp channel
	 * @param {Number} [remoteChannel=0xA1] The remote prudp channel
	 * @param {?dgram.Socket} isServer True if the this instance was created by the server
	 */
	constructor(host, port, access_key, encryption_key, version=0, localChannel=0xAF, remoteChannel=0xA1, socket = null) {
		super();
		this.host = host;
		this.port = port;
		this.access_key = access_key;
		this.encryption_key = encryption_key;
		this.localChannel = localChannel;
		this.remoteChannel = remoteChannel;
		this.isServer = isServer;
		this.version = version;
		this._state = 4; //CLOSED 
		this.congestionWindow = new PRUDPCongestionWindow(5);
		if(socket === null) {
			this.socket = dgram.createSocket('udp4');
		} else {
			this.socket = socket;
			this._state = 1;
		}
		this.socket.on('message', receivedDatagram.bind(this));
	}
}

/**
 * Handles a received packet os type syn
 * @param {PRUDPPacket} packet the received prudp packet
 */
function receivedSyn(packet) {
	if(packet.hasFlagNeedAck())
}

/**
 * Handles a received message from remote server/client
 * @param {Buffer} msg the buffer of the received payload
 * @param {Object} rinfo the address info of the received package
 */
function receivedDatagram(msg, rinfo) {
	if(rinfo.address !== this.host || rinfo.port !== port) {
		return;
	} 
	/**@type {PRUDPPacket} */
	let packet = null;
	if(PRUDPPacketVersion0.isBufferVersion0(msg)) {
		packet = new PRUDPPacketVersion0(msg);
	} else {
		this.emit('error', new Error(`Received message of unknown version`), msg);
	}
	if(packet.version !== this.version) {
		this.emit('error', new Error(`Received message of version ${packet.version} and expected version ${this.version}`), packet);		
	}
	//TODO check if I only need to check the destination
	if(packet.channels.destination !== this.localChannel && packet.channels.source !== this.remoteChannel) {
		return;
	}

}

PRUDP.states = readyStates;

module.exports = PRUDP