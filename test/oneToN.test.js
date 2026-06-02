const { Readable, Transform } = require("node:stream");
const { finished } = require("node:stream/promises");
const test = require("ava");
const streamx = require("streamx");

const plumber = require("../");
const { peek } = require("./util");

// Simulates gulp.dest() with sourcemaps: a streamx-based Transform that emits
// two chunks per input (e.g. compiled CSS file + .map file)
function streamxOneToTwoTransform() {
	return new streamx.Transform({
		transform(chunk, cb) {
			this.push(`${chunk}-a`);
			this.push(`${chunk}-b`);
			cb();
		},
	});
}

test("1-to-N streamx transform does not cause push-after-EOF", async (t) => {
	const actual = [];

	const stream = Readable.from([1, 2, 3])
		.pipe(plumber())
		.pipe(streamxOneToTwoTransform())
		.pipe(peek((data) => actual.push(data)));

	stream.on("data", () => {});

	await finished(stream);

	t.deepEqual(actual, ["1-a", "1-b", "2-a", "2-b", "3-a", "3-b"]);
});

test("pipeline completes when using 1-to-N streamx transform", async (t) => {
	// Guards against the pipeline hanging forever (original.end() never called)
	const stream = Readable.from([1, 2, 3])
		.pipe(plumber())
		.pipe(streamxOneToTwoTransform());

	stream.on("data", () => {});

	await t.notThrowsAsync(
		Promise.race([
			finished(stream),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("pipeline did not complete")), 2000),
			),
		]),
	);
});
