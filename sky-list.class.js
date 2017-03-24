import axios from 'axios';
import queryUtilities from './utilities/queryUtilities';

// Default
const defaultConfig = {
	api: '/umbraco/api/SiteSearchApi/Search/',
	debounce: 200,
	pagination: false,
	urlParams: true,
};

const defaultParameters = {
	offset: 0,
	limit: 10,
};

export default class SkyList {

	constructor(instanceConfig, instanceParameters) {
		// List preferences
		this.preferences = Object.assign({}, defaultConfig, instanceConfig);

		// List parameters (for url query string)
		this.params = Object.assign({}, defaultParameters, instanceParameters);

		// Populate params object from url if properties exist there
		const queryParams = queryUtilities.get();
		Object.keys(queryParams).forEach((key) => {
			if (key in this.params) {
				this.params[key] = queryParams[key];
			}
		});

		// Loading state boolean
		this.loading = false;

		// Untouched state boolean
		this.untouched = true;

		// Result object
		this.results = {
			pagination: {
				total: 0,
			},
			items: [],
		};

		// Token used to cancel a request
		this._lastCancelToken = axios.CancelToken.source();
	}

	/**
	* Fetch results based on the current query and offset.
	*
	* @param {number} [optional] offset
	* @return {promise}
	*/
	_fetch(offset) {
		// Cancel last request
		this.cancel();

		// Set loading state
		this.loading = true;

		// Set untouched state
		this.untouched = false;

		// Set limit
		this.params.limit = Number(this.params.limit);

		// Set the offset (only if offset is passed)
		if (offset || Number(offset) === 0) {
			this.params.offset = Number(offset);
		}

		// Update url
		if (this.preferences.urlParams) {
			queryUtilities.set(this.params);
		}

		const axiosConfig = {
			url: this.preferences.api,
			method: 'GET',
			params: this.params,
			cancelToken: this._lastCancelToken.token,
		};

		const promise = new Promise((resolve) => {
			// Cancel any queued requests
			clearTimeout(this.debounce);
			this.debounce = setTimeout(() => {
				axios(axiosConfig).then((res) => {
					this.loading = false;
					// Update pagination
					this.results.pagination = res.data.pagination;

					// Either replace items or cancat
					if (this.params.offset === 0 || this.preferences.pagination || !res.data.data.length) {
						this.results.items = res.data.data;
					} else {
						this.results.items = this.results.items.concat(res.data.data);
					}
					// Resolve promise with results
					resolve(this.results);
				}, () => {
				});
			}, this.preferences.debounce);
		});
		return promise;
	}

	// Next page
	next() {
		return this._fetch(this.params.offset + this.params.limit);
	}

	// Previous page
	previous() {
		return this._fetch(Math.max(0, this.params.offset - this.params.limit));
	}

	// Update list
	update() {
		this._fetch();
	}

	// Reset list
	reset() {
		// Cancel any ongoing requests
		this.cancel();

		// Set states
		this.loading = false;
		this.untouched = true;

		// Flush items
		this.results.items = [];

		// Reset meta stuff
		this.results.pagination.total = 0;
		this.params.offset = 0;

		// Reset query
		Object.assign(this.params, this.params);

		// Reset url
		if (this.preferences.urlParams) {
			queryUtilities.clear(this.params);
		}
	}

	// Cancel request
	cancel() {
		// Cancel last request
		this._lastCancelToken.cancel();

		// Set up new axios request token (to allow next cancel)
		const cancelToken = axios.CancelToken.source();
		this._lastCancelToken = cancelToken;
	}
}
