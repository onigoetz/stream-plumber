# @onigoetz/stream-plumber

Prevent pipe breaking caused by errors from [gulp](https://github.com/gulpjs/gulp) plugins or any other stream

This :monkey:-patch plugin is fixing [issue with Node Streams piping](https://github.com/gulpjs/gulp/issues/91).
For explanations, read [this small article](https://gist.github.com/floatdrop/8269868).

Briefly it replaces `pipe` method and removes standard `onerror` handler on `error` event, which unpipes streams on error by default.

> This is a fork of [gulp-plumber](https://github.com/floatdrop/gulp-plumber) with modernized dependencies and works with modern Node.JS streams

## Usage :monkey:

First, install `@onigoetz/stream-plumber` as a dependency:

```shell
npm install @onigoetz/stream-plumber
```

Then, add it to your `gulpfile.js`:

```javascript
var plumber = require('@onigoetz/stream-plumber');
var coffee = require('gulp-coffee');

gulp.src('./src/*.ext')
	.pipe(plumber())
	.pipe(coffee())
	.pipe(gulp.dest('./dist'));
```

## API

### plumber([options])

Returns Stream, that fixes `pipe` methods on Streams that are next in pipeline.

#### options
Type: `Object` / `Function`
Default: `{}`

Sets options described below from its properties. If type is `Function` it will be set as `errorHandler`.

#### options.inherit
Type: `Boolean`
Default: `true`

Monkeypatch `pipe` functions in underlying streams in pipeline.

#### options.errorHandler
Type: `Boolean` / `Function` <br/>
Default: `true`

Handle errors in underlying streams and output them to console.
 * `function` - it will be attached to stream `on('error')`.
 * `false` - error handler will not be attached.
 * `true` - default error handler will be attached.

### plumber.stop()

This method will return default behaviour for pipeline after it was piped.

```javascript
var plumber = require('@onigoetz/stream-plumber');

gulp.src('./src/*.scss')
    .pipe(plumber())
    .pipe(sass())
    .pipe(uglify())
    .pipe(plumber.stop())
    .pipe(gulp.dest('./dist'));
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)
