const { PassThrough, Transform } = require("node:stream");

function defaultErrorHandler(error) {
	// onerror2 and this handler
	if (this.listenerCount("error") < 3) {
		console.error("Plumber found unhandled error:", error);
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

	const callbacks = [];
	function callNext() {
		if (callbacks.length > 0) {
			const next = callbacks.shift();
			next();
		}
	}

	const wrapper = new Transform({
		objectMode: true,
		transform(chunk, encoding, next) {
			callbacks.push(next);

			// We write to the original stream and wait for a "data" or "error" event
			// the `next` callback will be called once we received the event
			// this should ensure the backpressure is handled correctly
			original.write(chunk, encoding);
		},
	});

	original.on("data", (data) => {
		// Push data to the wrapper
		if (!wrapper.push(data)) {
			// If  the wrapper is full, we need to pause the original stream
			original.pause();
		}

		callNext();
	});

	original.on("end", () => wrapper.push(null));
	original.on("drain", () => wrapper.emit("drain"));
	original.on("error", (err) => {
		// Modern stream destroy themselves when an error is thrown
		// luckly they have an hidden _undestroy method
		if (original._undestroy) {
			original._undestroy();
		}

		callNext();

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
