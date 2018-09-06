import SkyList from './SkyList.vue';

const defaults = {
	registerComponents: true,
};

export { SkyList };

export default function install(Vue, options) {
	if (install.installed === true) {
		return;
	}

	const { registerComponents } = Object.assign({}, defaults, options);

	if (registerComponents) {
		Vue.component(SkyList.name, SkyList);
	}
};
