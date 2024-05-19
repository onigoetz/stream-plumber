const test = require("ava");

const { Readable, PassThrough, Transform } = require("node:stream");
const { finished } = require("node:stream/promises");
const gulp = require("gulp");

const { peek } = require("./util");

const plumber = require("../");
const fixturesGlob = ["./test/fixtures/*"];

const expected = [];

test.before(
	() =>
		new Promise((done) => {
			const stream = gulp
				.src(fixturesGlob)
				.pipe(peek((item) => expected.push(item)));
			stream.on("finish", done);
		}),
);

test("should go through all files", async (t) => {
	t.plan(1);
	const actual = [];

	const stream = gulp
		.src(fixturesGlob)
		.pipe(plumber())
		.pipe(peek((file) => actual.push(file)));

	// Get the stream flowing
	stream.on("data", (data) => {});

	await finished(stream);

	t.deepEqual(
		actual.map((f) => f.path),
		expected.map((f) => f.path),
	);
});

test("piping into second plumber should keep piping", async (t) => {
	t.plan(1);
	const actual = [];

	const stream = gulp
		.src(fixturesGlob)
		.pipe(plumber())
		.pipe(new PassThrough({ objectMode: true }))
		.pipe(plumber())
		.pipe(peek((file) => actual.push(file)));

	// Get the stream flowing
	stream.on("data", (data) => {});

	await finished(stream);

	t.deepEqual(
		actual.map((f) => f.path),
		expected.map((f) => f.path),
	);
});

test("should work with readable array", async (t) => {
	const expected = ["1\n", "2\n", "3\n", "4\n", "5\n"];
	const actual = [];

	const stream = Readable.from([1, 2, 3, 4, 5])
		.pipe(plumber())
		.pipe(
			new Transform({
				objectMode: true,
				transform(e, enc, cb) {
					const content = Buffer.isBuffer(e) ? e.toString() : e;
					const string = `${JSON.stringify(content)}\n`;
					cb(null, string);
				},
			}),
		)
		.pipe(peek((file) => actual.push(file)));

	// Get the stream flowing
	stream.on("data", (data) => {});

	await finished(stream);

	t.deepEqual(
		actual.map((f) => f.path),
		expected.map((f) => f.path),
	);
});

test("should emit `end` after source emit `finish`", (t) => {
	t.plan(1);
	return new Promise((done, fail) => {
		gulp
			.src(fixturesGlob)
			.pipe(plumber())
			// Fetchout data
			.on("data", () => {})
			.on("end", () => {
				t.truthy(true);
				done();
			})
			.on("error", fail);
	});
});
