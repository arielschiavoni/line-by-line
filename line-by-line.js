/*
 * Line By Line
 *
 * A NodeJS module that helps you reading large text files, line by line,
 * without buffering the files into memory.
 *
 * Copyright (c) 2012 Markus von der Wehd <mvdw@mwin.de>
 * MIT License, see LICENSE.txt, see http://www.opensource.org/licenses/mit-license.php
 */

var path = require('path');
var fs = require('fs');
var events = require("events");

// let's make sure we have a setImmediate function (node.js <0.10)
if (typeof global.setImmediate == 'undefined') { setImmediate = process.nextTick;}

var LineByLineReader = function (filepath, options) {
	var self = this;

	this._filepath = path.normalize(filepath);
	this._encoding = options && options.encoding || 'utf8';
	this._skipEmptyLines = options && options.skipEmptyLines || false;

	this._readStream = null;
	this._lines = [];
	this._lineFragment = '';
	this._paused = false;
	this._end = false;
	this._ended = false;

	events.EventEmitter.call(this);

	setImmediate(function () {
		self._initStream();
	});
};

LineByLineReader.prototype = Object.create(events.EventEmitter.prototype, {
	constructor: {
		value: LineByLineReader,
		enumerable: false
	}
});

LineByLineReader.prototype._initStream = function () {
	var self = this,
		readStream = fs.createReadStream(this._filepath, { encoding: this._encoding });

	readStream.on('error', function (err) {
		self.emit('error', err);
	});

	readStream.on('open', function () {
		self.emit('open');
	});

	readStream.on('data', function (data) {
		self._readStream.pause();
		self._lines = self._lines.concat(data.split(/(?:\n|\r\n|\r)/g));

		self._lines[0] = self._lineFragment + self._lines[0];
		self._lineFragment = self._lines.pop() || '';

		setImmediate(function () {
			self._nextLine();
		});
	});

	readStream.on('end', function () {
		self._end = true;

		setImmediate(function () {
			self._nextLine();
		});
	});

	this._readStream = readStream;
};

LineByLineReader.prototype._nextLine = function () {
	var self = this,
		line;

	if (this._end && this._lineFragment) {
		this.emit('line', this._lineFragment);
		this._lineFragment = '';

		if (!this._paused) {
			setImmediate(function () {
				self.end();
			});
		}
		return;
	}

	if (this._paused) {
		return;
	}

	if (this._lines.length === 0) {
		if (this._end) {
			this.end();
		} else {
			this._readStream.resume();
		}
		return;
	}

	line = this._lines.shift();

	if (!this._skipEmptyLines || line.length > 0) {
		this.emit('line', line);
	}

	if (!this._paused) {
		setImmediate(function () {
			self._nextLine();
		});
	}
};

LineByLineReader.prototype.pause = function () {
	this._paused = true;
};

LineByLineReader.prototype.resume = function () {
	var self = this;

	this._paused = false;

	setImmediate(function () {
		self._nextLine();
	});
};

LineByLineReader.prototype.end = function () {
	if (!this._ended){
		this._ended = true;
		this.emit('end');
	}
};

LineByLineReader.prototype.close = function () {
	var self = this;

	this._readStream.destroy();
	this._end = true;

	setImmediate(function () {
		self._nextLine();
	});
};

module.exports = LineByLineReader;
