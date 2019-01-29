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
			:result="data.items"
			:states="states"
			:pagination="data.pagination"
			:facets="{
				toggle: toggleFacetValue,
				isSelected: isSelected,
				items: data.facets
			}"
			:request="{
				submit: request,
				more: more,
				all: all,
			}"
		/>
	</div>
</template>
