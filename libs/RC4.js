const crypto = require('crypto');

module.exports = {

	/**
	 * Encrypts the given data with the specified key
	 * @param {*} data The data being encrypted
	 * @param {*} key the key used to encyrpt the data
	 * @param {String} inputEncoding the type of input for data, if null data is treated as a buffer
	 * @param {String} outputEncoding the return type of the encrypted data, if null a buffer is returned
	 * @returns {Buffer|String} The encrypted data
	 */
	encrypt(data, key, inputEncoding, outputEncoding) {
		//Encrypting and decrypting alghorithms of RC4 are the same
		return module.exports.decrypt(data, key, inputEncoding,outputEncoding);
	},
	/**
	 * Decrypts the given data with the specified key
	 * @param {*} data The data being decrypted
	 * @param {*} key the key used to decrypt the data
	 * @param {String} inputEncoding the type of input for data, if null data is treated as a buffer
	 * @param {String} outputEncoding the return type of the encrypted data, if null a buffer is returned
	 * @returns {Buffer|String} The decrypted data
	 */
	decrypt(data, key, inputEncoding, outputEncoding) {
		const decipher = crypto.createDecipheriv("rc4", key, '');
		let output = decipher.update(data, inputEncoding,	outputEncoding);
		decipher.final();
		return output;
	}
}