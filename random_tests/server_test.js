const libs = require('../libs')
const PRUDPServer = libs.PRUDPServer;

const prudpserver = new PRUDPServer(60000, "ridfebb9", "TODO", {
	version: 0,
	localChannel: 0xAF
} )
prudpserver.listen()