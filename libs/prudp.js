const Packets = require('./Packets');
const PRUDPPacket = Packets.PRUDPPacket;
const PRUDPPacketVersion0 = Packets.PRUDPPacketVersion0;
const crypto = require('crypto');
const EventEmitter = require('events');
const readyStates = {
	CONNECTING: Symbol('Connecting'),
	OPEN: Symbol('Open'),
	CLOSING: Symbol('Closing'),
	CLOSED: Symbol('Closed')
}
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
			clearTimeout(this.window[packet.sequenceId].timeoutReference);
			delete this.window[packet.sequenceId];
		}
	}
	
	/**
	* @param {Number} sequenceId the sequence id of the packet being waited on
	* @returns {Boolean} true if the packet is in the congestion window
	*/
	waitingFor(sequenceId) {
		return this.window[sequenceId] != null;
	}
	
	/**
	* Replaces the timeout of the sentPacket with a new one
	* @param {Number} sequenceId the sequence id of the packet
	* @param {Number} ref the timeout ref of setTimeout
	*/
	replaceTimeoutRef(sequenceId, ref) {
		this.window[sequenceId].timeoutReference = ref;
	}
}

class PRUDP extends EventEmitter {
	/**
	* Creates a prudp client
	* @param {!String} host The host to connect to
	* @param {!Number} port The port to connect to in the host
	* @param {!String} accessKey The access key used to create checksum and packet signature
	* @param {!String} encryptionKey The encryption key for the payload
	* @param {Number} [options.version=0] The PRUDP protocol version to use
	* @param {Number} [options.localChannel=0xAF] The local prudp channel
	* @param {Number} [options.remoteChannel=0xA1] The remote prudp channel
	* @param {Boolean} [options.isServer=false] Was this client created by the server?
	*/
	constructor(host, port, accessKey, encryptionKey, options) {
		super();
		options = Object.assign({
			version: 0,
			localChannel: 0xAF,
			remoteChannel: 0xA1,
			isServer: false
		}, options);
		const md5 = crypto.createHash('md5');
		this.host = host;
		this.port = port;
		this.accessKey = accessKey;
		this.encryptionKey = encryptionKey;
		this.localChannel = options.localChannel;
		this.remoteChannel = options.remoteChannel;
		this.md5AccessKey = md5.update(this.accessKey).digest();
		const hmac = crypto.createHmac('sha256', this.md5AccessKey);
		
		this.remoteHash = hmac.update(`${this.host}:${this.port}`).digest();
		/**@type {Buffer} */
		this.otherSideHash = null;
		this.isServer = options.isServer;
		this.version = options.version;
		this._state = readyStates.CLOSED; //CLOSED 
		this.congestionWindow = new PRUDPCongestionWindow(5);
		this.timeout = 1000 * 5;//ms
		this.sequenceId = 0;
		this.sessionId = crypto.randomBytes(2).readUInt16LE(0);
		if(this.version === 0)
		this.PRUDPPacket = PRUDPPacketVersion0;
		if(!this.isServer) {
			this.socket = dgram.createSocket('udp4');
			this.socket.on('message', receivedDatagram.bind(this));
		}
	}
	
	/**
	* Connects to the endpoint this prudp instance points to
	* emits connect on success
	*/
	connect() {
		//this.socket.bind(9103)
		if(this._state !== readyStates.CLOSED)
			return;
		this.send(this.PRUDPPacket.createSyn(this.localChannel, this.remoteChannel));
	}
	
	/**
	 * Sets the socket info
	 * @param {dgram.socket} socket the socket where packets come from
	 * @param {Buffer} initialData the buffer of the received payload
	 * @param {Object} rinfo the address info of the received package
	 */
	setSocket(socket, initialData, rinfo) {
		this.socket = socket;
		this.socket.on('message', receivedDatagram.bind(this));
		receivedDatagram.call(this, initialData, rinfo);
	}

	send(packet) {
		sendRawPacket.call(this, packet);
	}
}

/**
* Function called when a packet timesout
* @param {PRUDPPacket} packet the packet that timed out
*/
function packetTimeout(packet) {
	sendRawPacket.call(this, packet);
}

/**
* Sends a packet through the udp layers, adds it to the congestion queue if necessary
* @param {PRUDPPacket} packet the packet to be sent to the remote endpoint 
*/
function sendRawPacket(packet) {
	const resendingPacket = this.congestionWindow.waitingFor(packet.sequenceId);
	if(this.congestionWindow.isFull() && !resendingPacket) {
		return;
	}
	if(resendingPacket) {
		const ref = setTimeout(packetTimeout.bind(this, packet), this.timeout);
		this.congestionWindow.replaceTimeoutRef(packet.sequenceId, ref);
	} else {
		if(!packet.hasFlagAck() && !packet.hasFlagMultiAck()) {
			packet.sequenceId = this.sequenceId++;
		}
		if(packet.hasFlagNeedAck() || packet.hasFlagReliable()) {
			const ref = setTimeout(packetTimeout.bind(this, packet), this.timeout);
			this.congestionWindow.addSentPacket(new SentPRUDPPacket(packet, ref));
		} 
		if(packet.isConnect() && packet.hasFlagAck()) {
			this.emit('connected', this);
			this._state = readyStates.OPEN;
		}
		if(packet.implementsChecksum)
		packet.setChecksum(this.accessKey);
	}
	
	this.socket.send(packet.toBuffer(), this.port, this.host);
}

/**
* Handles a received ack and removes the corresponding packet from the CongestionWindow
* @param {PRUDPPacket} packet the packet that acknowledged it
* @returns {Boolean} true if the packet as processed and doesn't need more processing
*/
function handleReceivedAck(packet) {
	if(!packet.hasFlagAck() && !packet.hasFlagReliable()) {
		return false;
	}
	if(packet.isConnect() && packet.hasFlagAck()) {
		this.emit('connected', this);
		this._state = readyStates.OPEN;
	}
	this.congestionWindow.acknowledgePacket(packet);
	return true;
}

/**
* Sends an ACK for the specified packet
* @param {PRUDPPacket} packet the received packet
*/
function sendAckForPacket(packet) {
	const ack = packet.createAck( {
		sessionId: this.sessionId,
		connectionSignature: this.remoteHash.slice(0, packet.connectionSignatureLength),
		packetSignature: this.otherSideHash
	})
	if(ack === null)
		return;
	sendRawPacket.call(this, ack);
}

/**
* Handles a received and sends an ack if needed
* @param {PRUDPPacket} packet the received packet
*/
function handleReceivedPacket(packet){	
	if(packet.hasFlagNeedAck() || packet.hasFlagReliable()) {
		return sendAckForPacket.call(this, packet);
	}
	if(packet.isSyn() && packet.hasFlagAck()) {	//send the connect packet
		this.otherSideHash = packet.connectionSignature;
		const con = this.PRUDPPacket.createConnect(this.localChannel, this.remoteChannel, this.remoteHash, this.otherSideHash);
		return sendRawPacket.call(this, con);
	}
}

/**
* Handles a received message from remote server/client
* @param {Buffer} msg the buffer of the received payload
* @param {Object} rinfo the address info of the received package
*/
function receivedDatagram(msg, rinfo) {
	if(rinfo.address !== this.host || rinfo.port !== this.port) {
		return;
	} 
	/**@type {PRUDPPacket} */
	let packet = null;
	//TODO version 1
	if(PRUDPPacketVersion0.isBufferVersion0(msg)) {
		packet = new PRUDPPacketVersion0(msg);
	} else {
		this.emit('error', new Error(`Received message of unknown version`), msg);
	}
	if(packet.version !== this.version) {
		this.emit('error', new Error(`Received message of version ${packet.version} and expected version ${this.version}`), packet);		
	}
	if(packet.implementsChecksum && !packet.checkChecksum(this.accessKey)) {
		return; //Invalid key
	}
	//TODO check if I only need to check the destination/localChannel
	if(packet.channels.destination !== this.localChannel && packet.channels.source !== this.remoteChannel) {
		return;
	}
	handleReceivedAck.call(this, packet);
	handleReceivedPacket.call(this, packet);
}

PRUDP.states = readyStates;

module.exports = PRUDP