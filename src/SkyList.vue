<style lang="scss" src="./SkyList.scss"></style>
<script src="./SkyList.js"></script>


<template>
	<div :class="[
		'sky-list',
		{ 'sky-list--loading' : states.loading },
	]">
		<slot
			:query="{
				parameters: query.parameters,
				facets: query.facets,
			}"
			:data="{
				misc: data.misc,
				meta: data.meta,
				items: data.items,
				pagination: data.pagination,
				facets: data.facets,
			}"
			:states="states"
			:action="{
				toggleValue: toggleValue,
				setValue: setValue,
			}"
			:request="{
				submit: request,
				more: more,
				all: all,
			}"
		/>
	</div>
</template>
