const { Transform, PassThrough } = require("node:stream");

module.exports.noop = () => new PassThrough({ objectMode: true });

module.exports.peek = (peekCallback) =>
	new Transform({
		objectMode: true,
		transform(data, enc, cb) {
			peekCallback(data);
			cb(null, data);
		},
	});
