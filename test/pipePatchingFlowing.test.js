const test = require("ava");
const { finished } = require("node:stream/promises");
const gulp = require("gulp");

const noop = require("./util").noop;

const plumber = require("../");
const fixturesGlob = ["./test/fixtures/*"];

test("in non-flowing mode", (t) => {
	return new Promise((done) => {
		const lastNoop = noop();
		const stream = gulp
			.src(fixturesGlob)
			.pipe(plumber())
			.pipe(noop())
			.pipe(noop())
			.pipe(lastNoop);

		stream.on("finish", () => {
			t.truthy(plumber.isPlumbed(lastNoop));
			done();
		});
	});
});

test("in flowing mode", async (t) => {
	const lastNoop = noop();
	const stream = gulp
		.src(fixturesGlob)
		.pipe(plumber())
		.pipe(noop())
		.pipe(noop())
		.pipe(lastNoop);

	stream.on("data", (file) => {
		t.truthy(file);
	});

	await finished(stream);

	t.truthy(plumber.isPlumbed(lastNoop));
});
