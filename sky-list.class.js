import axios from 'axios';

// Default
const defaultPreferences = {
	api: '/umbraco/api/SiteSearchApi/Search/',
	limit: 10,
	pagination: false,
	debounceTime: 200,
};

export default class SkyList {

	constructor(instancePreferences) {
		// List preferences
		this.preferences = Object.assign(defaultPreferences, instancePreferences);

		// Used to cancel the request
		this._lastCancelToken = axios.CancelToken.source();

		// List query
		this.query = {
			keywords: '',
		};

		// The current offset
		this.offset = 0;

		// Loading boolean
		this.loading = true;

		// Result object
		this.results = {
			pagination: {
				total: 0,
			},
			items: [],
		};

		this.fetch();
	}

	/**
	* Fetch results based on the current query and offset.
	*
	* @param {number} [optional] offset
	* @return {promise}
	*/
	fetch(offset = 0) {
		// Cancel any ongoing requests
		this._lastCancelToken.cancel();
		this._lastCancelToken = axios.CancelToken.source();

		// Set the offset
		this.offset = offset;

		// Endpoint
		const url = this.preferences.api;

		// Merged params
		const params = Object.assign(this.query, {
			limit: this.preferences.limit,
			offset: this.offset,
		});

		this.loading = true;

		const promise = new Promise((resolve) => {
			// Cancel any queued requests
			clearTimeout(this.debounce);
			if (params.keywords.length) {
				this.debounce = setTimeout(() => {
					axios({
						method: 'GET',
						url,
						params,
					}).then((res) => {
						this.loading = false;
						// Update pagination
						this.results.pagination = res.data.pagination;

						// Either replace items or cancat
						if (this.offset === 0 || this.preferences.pagination || !res.data.data.length) {
							this.results.items = res.data.data;
						} else {
							this.results.items = this.results.items.concat(res.data.data);
						}

						// $location.search(this.query);
						resolve(this.results);
					});
				}, this.preferences.debounceTime);
			} else {
				this.loading = false;
				resolve(true);
			}
		});
		return promise;
	}

	// Next page
	fetchNext() {
		return this.fetch(this.offset + this.preferences.limit);
	}

	// Previous page
	fetchPrevious() {
		return this.fetch(Math.max(0, this.offset - this.preferences.limit));
	}

	// Reset list
	empty() {
		this.results.items = [];
		this.results.pagination.total = 0;
	}

	// Update list
	update() {
		// this.empty();
		this.fetch();
	}

	// Cancel request
	cancel() {
		this._lastCancelToken.cancel();
		this._lastCancelToken = axios.CancelToken.source();
	}
}
