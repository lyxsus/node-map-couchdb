define (function () {
	var range = function (seek, range) {
		var tmp = range.split (/\-/);

		if (tmp.length == 2) {
			if (seek < parseInt (tmp [0])) return false;
			if (seek > parseInt (tmp [1])) return false;
			return true;
		}

		return false;
	};

	var key = function (seek, matrix) {
		if (typeof matrix != 'object') {
			return matrix;
		}

		if (seek) {
			if (matrix [seek]) {
				return matrix [seek];
			}

			for (var index in matrix) {
				if (range (seek, index)) {
				  return matrix [index];
				}
			}
		}

		return matrix.default;
	};

	function compute (branch, params) {
		if (typeof branch == 'object') {
			var hasDefault = false,
				hasOthers = false,
				hasConds = false,
				hasMatched = false,
				tmp, k, v;

			for (var i in branch) {
				if (i == 'default') {
					hasDefault = true;
				} else if (tmp = i.match (/([^\[]+)\[([^\[]+)\]/)) {
					hasConds = true;

					k = tmp [1];
					v = tmp [2];
					
					if (tmp = v.match (/(\d+)-(\d+)/)) {
						var min = parseInt (tmp [1]),
							max = parseInt (tmp [2]),
							cmp = parseInt (params [k]);

						if (cmp >= min && cmp <= max) {
							return compute (branch [i], params);
						}
					} else {
						if (params [k] == v) {
							return compute (branch [i], params);
						}
					}
				} else {
					hasOthers = true;
				}
			}

			if (hasOthers) {
				if (!hasConds) {
					return branch;
				}
			} else {
				if (hasDefault) {
					return compute (branch ['default'], params);
				}
			}

			return null;
		} else {
			return branch;
		}
	}

	return function (factors, params) {
		var result = {};

		for (var i in factors) {
			result [i] = compute (factors [i], params);
		}

		return result;
	};

});
