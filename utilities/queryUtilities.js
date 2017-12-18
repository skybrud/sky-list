// import core.js polyfill
import 'core-js/fn/object/assign';

function updateQueryString(string) {
	if (window && window.history.pushState) {
		const base = `${window.location.protocol}//${window.location.host}${window.location.pathname}${window.location.hash}`;
		const seperator = (string.length) ? '?' : '';
		const url = `${base}${seperator}${string}`;

		window.history.replaceState({
			path: url,
		}, '', url);
	}
}

function unserialize(queryString) {
	const string = queryString.match(/^\?/) ? queryString.substring(1) : queryString;
	return string.trim().split('&').reduce((accumulator, currentValue) => {
		const parts = currentValue.replace(/\+/g, ' ').split('=');
		const result = accumulator;
		let key = parts[0];
		let value = parts[1];

		key = decodeURIComponent(key);
		value = value === undefined ? true : decodeURIComponent(value);

		if (key in result) {
			if (key) {
				result[key] = value;
			}
		} else if (Array.isArray(result[key])) {
			result[key].push(value);
		} else {
			result[key] = value;
		}

		return result;
	}, {});
}

function serialize(queryObject) {
	const order = Object.keys(queryObject).sort();
	const serialized = [];

	order.forEach((key) => {
		const property = encodeURIComponent(key);
		const value = queryObject[key] === undefined ? true : encodeURIComponent(queryObject[key]);
		if (key) {
			serialized.push(`${property}=${value}`);
		}
	});

	return serialized.join('&');
}

export default {
	get(parameter) {
		const queryObject = unserialize(window.location.search);
		if (parameter) {
			return (parameter in queryObject) ? queryObject[parameter] : undefined;
		}
		return queryObject;
	},
	set(parameters, merge = true) {
		const queryObject = (merge) ? unserialize(window.location.search) : {};
		if (typeof parameters === 'object') {
			Object.assign(queryObject, parameters);
		} else if (typeof params === 'string') {
			const parametersObject = {};
			parametersObject[parameters] = '';
			Object.assign(queryObject, parametersObject);
		}

		updateQueryString(serialize(queryObject));

		return queryObject;
	},
	clear(parameters) {
		const queryObject = unserialize(window.location.search);

		Object.keys(parameters).forEach((key) => {
			if (key in queryObject) {
				delete queryObject[key];
			}
		});

		updateQueryString(serialize(queryObject));
	},
};
