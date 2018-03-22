const PURDP = require('../')
const PRUDPServer = PURDP.Server;

const prudpserver = new PRUDPServer(60000, "ridfebb9", "TODO", {
	version: 0,
	localChannel: 0xAF
} )
prudpserver.listen()