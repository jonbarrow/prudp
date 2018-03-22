const EventEmitter = require('events');
const crypto = require('crypto');
const Packets = require('./Packets');
const PRUDP = require('./prudp');
const dgram = require('dgram');

const PRUDPPacket = Packets.PRUDPPacket;
const PRUDPPacketVersion0 = Packets.PRUDPPacketVersion0;

class PRUDPServer extends EventEmitter {
	/**
	* Creates a prudp server
	* @param {!Number} port The port to connect to in the host
	* @param {!String} accessKey The access key used to create checksum and packet signature
	* @param {!String} encryptionKey The encryption key for the payload
	* @param {Number} [options.version=0] The PRUDP protocol version to use
	* @param {Number} [options.localChannel=0xA1] The local prudp channel
	* @param {Boolean} [options.destroyOldConnections=true] If a new connection is started from the same ip and port
	* as a previous port, either destroy the old connection or create a new one
	*/
	constructor(port, accessKey, encryptionKey, options) {
		super();
		options = Object.assign({
			version: 0,
			localChannel: 0xA1,
			destroyOldConnections: true
		}, options);
		this.port = port;
		this.accessKey = accessKey;
		this.encryptionKey = encryptionKey;
		this.version = options.version;
		this.localChannel = options.localChannel;
		this.destroyOldConnections = options.destroyOldConnections;
		this.clients = {};
		this.socket = dgram.createSocket('udp4');//TODO make this use both ipv4 and 6?
		this.socket.on('message', receivedDatagram.bind(this));
	}
	
	listen() {
		console.log(this.port)
		this.socket.bind(this.port, () => {
			this.emit('listening')
		})
	}
}
/**
* Handles a received message from remote server/client
* @param {Buffer} msg the buffer of the received payload
* @param {Object} rinfo the address info of the received package
*/
function receivedDatagram(msg, rinfo) {
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
	if(packet.isSyn() && packet.hasFlagNeedAck()) {
		const connect_str = `${rinfo.address}:${rinfo.port}`;

		if(this.clients[connect_str] != null) {
			if(this.destroyOldConnections){
				this.clients[connect_str].destroy();
				delete this.clients[connect_str];	
			}else {
				return; //TODO check if it's active
			}
		}
		const client = new PRUDP(rinfo.address, rinfo.port, this.accessKey, this.encryptionKey, {
			version: this.version,
			localChannel: this.localChannel,
			remoteChannel: packet.channels.source
		}, true);
		client.once('connected', _client => {
			this.emit('connection', _client);
		});
		this.clients[connect_str] = client;
		client.setSocket(this.socket, msg, rinfo);
	}
}

module.exports = PRUDPServer;