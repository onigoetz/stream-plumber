const { Transform, PassThrough } = require("node:stream");

const test = require("ava");
const streamx = require("streamx");
const gulp = require("gulp");

const plumber = require("../");

const errorMessage = "Error: Bang!";
const fixturesGlob = ["./test/fixtures/index.js", "./test/fixtures/test.js"];
const delay = 20;

function failingQueueStream() {
	let i = 0;
	return new Transform({
		objectMode: true,
		transform(file, enc, cb) {
			i++;
			if (i === 2) {
				cb(new Error("Bang!"));
			} else {
				cb(null, file);
			}
		},
	});
}

test("should attach custom error handler", (t) =>
	new Promise((done) => {
		gulp
			.src(fixturesGlob)
			.pipe(
				plumber({
					errorHandler: (error) => {
						t.deepEqual(error.toString(), errorMessage);
						done();
					},
				}),
			)
			.pipe(failingQueueStream());
	}));

test("should attach custom error handler with function argument", (t) =>
	new Promise((done) => {
		gulp
			.src(fixturesGlob)
			.pipe(
				plumber((error) => {
					t.deepEqual(error.toString(), errorMessage);
					done();
				}),
			)
			.pipe(failingQueueStream());
	}));

test.skip("should attach default error handler", (t) => {
	// Error handlers are no longer attached to the object
	return new Promise((done) => {
		const mario = plumber();
		mario.errorHandler = (error) => {
			t.deepEqual(error.toString(), errorMessage);
			done();
		};
		gulp.src(fixturesGlob).pipe(mario).pipe(failingQueueStream());
	});
});

test.skip("default error handler should work", (t) => {
	// TODO: Find alternative way to test error handler (`gutil.log` was replaced by `fancyLog`)
	// var mario = plumber();
	// var _ = gutil.log;
	// gutil.log = done.bind(null, null);
	// gulp.src(fixturesGlob)
	//     .pipe(mario)
	//     .pipe(this.failingQueueStream())
	//     .on('end', function () {
	//         gutil.log = _;
	//     });
});

test("should attach error handler in non-flowing mode", (t) => {
	t.plan(1);
	return new Promise((done) => {
		const delayed = new PassThrough({ objectMode: true });
		setTimeout(delayed.write.bind(delayed, "data"), delay);
		setTimeout(delayed.write.bind(delayed, "data"), delay);
		delayed
			.pipe(
				plumber({
					errorHandler: () => {
						t.truthy(true);
						done();
					},
				}),
			)
			.pipe(failingQueueStream());
	});
});

// it.only('in flowing mode', function (done) {
//     var delayed = new Transform({objectMode: true, transform(file, enc, cb) { cb(null, file); }});
//     setTimeout(delayed.write.bind(delayed, 'data'), delay);
//     setTimeout(delayed.write.bind(delayed, 'data'), delay);
//     delayed
//         .pipe(plumber({ errorHandler: done.bind(null, null) }))
// // You cant do on('data') and pipe simultaniously.
//         .on('data', function () { })
//         .pipe(this.failingQueueStream());
// });

test("should not attach error handler in non-flowing mode", (t) =>
	new Promise((done) => {
		gulp
			.src(fixturesGlob)
			.pipe(plumber({ errorHandler: false }))
			.pipe(failingQueueStream())
			.on("error", (err) => {
				t.truthy(err instanceof Error);
				done();
			})
			.on("end", () => {});
	}));

// test('in flowing mode', function (done) {
//     (function () {
//         gulp.src(fixturesGlob)
//             .pipe(plumber({ errorHandler: false }))
// // You cant do on('data') and pipe simultaniously.
//             .on('data', function () { })
//             .pipe(failingQueueStream)
//             .on('end', done);
//     }).should.throw();
//     done();
// });

test("throw on piping to undefined", (t) => {
	t.throws(() => plumber.pipe());
});

test("throw after cleanup", (t) => {
	const mario = plumber({ errorHandler: false });
	const stream = mario.pipe(
		new streamx.Transform({
			transform(entry, cb) {
				cb();
			},
		}),
	);

	t.throws(() => {
		stream.emit("error", new Error(errorMessage));
	});

	t.deepEqual(mario.listenerCount("data"), 0);
	t.deepEqual(mario.listenerCount("drain"), 0);
	t.deepEqual(mario.listenerCount("error"), 0);
	t.deepEqual(mario.listenerCount("close"), 0);

	t.deepEqual(stream.listenerCount("data"), 0);
	t.deepEqual(stream.listenerCount("drain"), 0);
	t.deepEqual(stream.listenerCount("error"), 0);
	t.deepEqual(stream.listenerCount("close"), 0);
});
