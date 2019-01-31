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
			:action="{
				toggleValue: toggleValue,
				setValue: setValue,
			}"
			:facets="data.facets"
			:request="{
				submit: request,
				more: more,
				all: alle,
			}"
		/>
	</div>
</template>
