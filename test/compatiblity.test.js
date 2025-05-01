const test = require("ava");

const { finished } = require("node:stream/promises");
const gulp = require("gulp");

const stream = require("stream");
const streamx = require("streamx");
const composer = require("stream-composer");
const through2 = require("through2");
const readableStream = require("readable-stream");
const strom = require("stromjs");

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

const libraries = [
	{
		name: "stream",
		createTransform: () => {
			return new stream.Transform({
				objectMode: true,
				transform(from, encoding, cb) {
					this.push(from);
					cb();
				},
			});
		},
	},
	{
		name: "stream-composer",
		createTransform: () => {
			return composer.pipeline(
				new stream.PassThrough({ objectMode: true }),
				new stream.PassThrough({ objectMode: true }),
			);
		},
	},
	{
		name: "streamx",
		createTransform: () => {
			return new streamx.Transform({
				transform(from, cb) {
					this.push(from);
					cb();
				},
			});
		},
	},
	{
		name: "readable-stream",
		createTransform: () => {
			return new readableStream.Transform({
				objectMode: true,
				transform(from, encoding, cb) {
					this.push(from);
					cb();
				},
			});
		},
	},
	{
		name: "through2",
		createTransform: () => {
			return through2.obj((data, enc, cb) => {
				cb(null, data);
			});
		},
	},
	{
		name: "stromjs",
		createTransform: () => strom.filter(s => true),
	}
];

for (const { name, createTransform } of libraries) {
	test(`${name}: (plumbed) should go through all files`, async (t) => {
		t.plan(1);
		const actual = [];

		const stream = gulp
			.src(fixturesGlob)
			.pipe(plumber())
			.pipe(createTransform())
			.pipe(peek((file) => actual.push(file)));

		// Get the stream flowing
		stream.on("data", (data) => {});

		await finished(stream);

		t.deepEqual(
			actual.map((f) => f.path),
			expected.map((f) => f.path),
		);
	});

	test(`${name}: (unplumbed) should go through all files`, async (t) => {
		t.plan(1);
		const actual = [];

		const stream = gulp
			.src(fixturesGlob)
			//.pipe(plumber())
			.pipe(createTransform())
			.pipe(peek((file) => actual.push(file)));

		// Get the stream flowing
		stream.on("data", (data) => {});

		await finished(stream);

		t.deepEqual(
			actual.map((f) => f.path),
			expected.map((f) => f.path),
		);
	});
}
