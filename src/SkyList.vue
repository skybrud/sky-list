<style lang="scss" src="./SkyList.scss"></style>
<script src="./SkyList.js"></script>


<template>
	<div :class="['sky-list', { loading : states.loading }]">
		<slot
			:query="listQuery"
			:result="currentResultSet"
			:states="states"
			:pagination="result.pagination"
			:fetch="more"
		>
			<!-- <div class="sky-list-form">
				<input
					type="text"
					v-model="listQuery.keywords"
				/>
			</div> -->

			<div
				v-if="(validQuery || config.immediate)"
				class="sky-list-content"
			>
				<div
					v-if="config.showCount && states.hasFetchedOnce && (currentResultSet.length > 0)"
					class="sky-list-message"
				>
					<span>
						<!-- Your search for <em>"{{listQuery.keywords}}"</em> returned <em>{{result.pagination.total}} {{(result.pagination.total === 1) ? 'result' : 'results'}}</em> -->
					</span>
				</div>

				<div
					v-if="currentResultSet.length > 0"
					class="sky-list-result"
				>
					<ul>
						<li
							class="sky-list-item"
							v-for="(item, index) in currentResultSet"
							:key="item.id"
						>
							<span v-text="`Result item with ID: ${item.id}`" />
						</li>
					</ul>

				</div>
				<div
					v-else-if="states.hasFetchedOnce"
					class="sky-list-result empty"
				>
					<span v-text="'Your search returned no results'" />
				</div>

				<div :class="sky-list-pagination">
					<button
						@click="more(true)"
						class="sky-list-more"
					>
						<span v-text="`Show All`" />
					</button>
				</div>
			</div>
		</slot>
	</div>
</template>
