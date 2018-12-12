<style lang="scss" src="./SkyList.scss"></style>
<script src="./SkyList.js"></script>


<template>
	<div :class="['sky-list', { loading : states.loading }]">
		<slot
			:query="{
				parameters: queryParts.parameters,
				filters: queryParts.filters,
			}"
			:result="data.items"
			:filters="data.filters"
			:states="states"
			:pagination="data.pagination"
			:fetch="more"
		>
		</slot>
	</div>
</template>
