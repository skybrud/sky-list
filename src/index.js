import SkyList from './SkyList';

const defaults = {
	registerComponents: true,
};

export { SkyList };

export default {
	install(Vue, options) {
		const { registerComponents } = Object.assign({}, defaults, options);

		if (registerComponents) {
			Vue.component('SkyList', SkyList);
		}
	},
};