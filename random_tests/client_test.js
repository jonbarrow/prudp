const libs = require('../libs')
const PRUDP = libs.PRUDP;

const prudp = new PRUDP("34.211.235.135", 60000, "ridfebb9", "TODO", 0, 0xAF, 0xA1);
prudp.connect();