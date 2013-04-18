#!/usr/local/bin/node

var connstr = process.argv [2],
	folder = process.argv [3];

var Mapper = require ('../libs'),
	mapper = new Mapper (connstr, folder);

mapper.pull ()
	.then (function () {
		mapper.watch ();
	});