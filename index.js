const { PassThrough, Transform } = require("node:stream");

function defaultErrorHandler(error) {
	// onerror2 and this handler
	if (this.listenerCount("error") < 3) {
		console.error(
			"Plumber found unhandled error:",
			error,
		);
	}
}

const PLUMBER_IS_PLUMBER = "plumber:isPlumber";
const PLUMBER_IS_PATCHED = "plumber:isPatched";
const PLUMBER_SKIP = "plumber:stop";

const PIPE_FN_PATCHED = Symbol.for("plumber:patched");
const PIPE_FN_ORIGINAL = Symbol.for("plumber:original");

function patchPipe(stream, alternatePipe) {
	stream[PIPE_FN_PATCHED] = alternatePipe;
	stream[PIPE_FN_ORIGINAL] = stream.pipe;
	stream.pipe = stream[PIPE_FN_PATCHED];
	stream[PLUMBER_IS_PATCHED] = true;
}

/**
 * Wrap the stream in a new transform in order to prevent errors from being sent to the original stream
 *
 * inspired by https://github.com/lewisdiamond/stromjs/blob/master/src/functions/duplex.ts
 *
 * @param {Stream} original
 * @param {*} errorHandler
 * @returns
 */
function wrapStream(original, errorHandler) {
	if (!errorHandler) {
		return original;
	}

	let ranErrorCallback = false;
	let unpauseCallback;

	const wrapper = new Transform({
		objectMode: true,
		transform(chunk, encoding, callback) {
			ranErrorCallback = false;

			return original.write(chunk, encoding, (err, data) => {
				if (err) {
					// If the error callback already ran we call it directly
					// otherwise we need to store the callback until we run the error callback
					if (ranErrorCallback) {
						callback();
					} else {
						unpauseCallback = callback;
					}
				} else {
					callback(null, data);
				}
			});
		},
	});

	// Hoist data to wrapper
	original.on("data", (data) => {
		if (!wrapper.push(data)) {
			original.pause();
		}
	});

	original.on("end", () => wrapper.push(null));
	original.on("drain", () => wrapper.emit("drain"));
	original.on("error", (err) => {
		// Modern stream destroy themselves when an error is sent
		// luckly they have an hidden _undestroy method
		if (original._undestroy) {
			original._undestroy();
		}

		if (unpauseCallback) {
			unpauseCallback();
			unpauseCallback = null;
		}

		ranErrorCallback = true;

		errorHandler(err);
	});

	return wrapper;
}

function plumber(opts = {}) {
	if (typeof opts === "function") {
		/* eslint-disable-next-line no-param-reassign */
		opts = { errorHandler: opts };
	}

	const through = new PassThrough({ objectMode: true });
	through[PLUMBER_IS_PLUMBER] = true;

	let errorHandler;
	if (opts.errorHandler !== false) {
		errorHandler =
			typeof opts.errorHandler === "function"
				? opts.errorHandler
				: defaultErrorHandler;
	}

	function alternatePipe(rawDest, ...rest) {
		if (!rawDest) {
			throw new Error("plumber: Can't pipe to undefined");
		}

		if (plumber.isStopped(rawDest) || plumber.isPlumber(rawDest)) {
			// send to the real pipe()
			this[PIPE_FN_ORIGINAL](rawDest, ...rest);

			return rawDest;
		}

		const dest = wrapStream(rawDest, errorHandler);

		// send to the real pipe()
		this[PIPE_FN_ORIGINAL](dest, ...rest);

		// Patching pipe method
		if (opts.inherit !== false) {
			patchPipe(dest, alternatePipe);
		}

		rawDest[PLUMBER_IS_PATCHED] = true;
		dest[PLUMBER_IS_PATCHED] = true;

		return dest;
	}

	patchPipe(through, alternatePipe);

	return through;
}

module.exports = plumber;

module.exports.stop = () => {
	const through = new PassThrough({ objectMode: true });
	through[PLUMBER_SKIP] = true;
	return through;
};

module.exports.isPlumbed = (stream) => !!stream[PLUMBER_IS_PATCHED];

module.exports.isStopped = (stream) => !!stream[PLUMBER_SKIP];

module.exports.isPlumber = (stream) => !!stream[PLUMBER_IS_PLUMBER];
