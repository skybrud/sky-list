# sky-list
> Vue module for requesting search API (via axios) and displaying result with different pagination options

## List of content
* [Installation](#installation)
* [Usage](#usage)
* [Option tables](#options)
* [Examples](#examples)
* [API Response Setup](#api)


## <a id="installation"></a>Installation
```bash
npm install sky-list
```

```bash
yarn add sky-list
```

## <a id="usage"></a>Usage
### Import
```js
import Vue from 'vue';
```
Different import approaches. The First provides the minified and compiled dist version, the other the raw .vue file.
```js
import SkyList from 'sky-list';
import SkyList from '${YOUR-PROJECT-ROOT-PATH}/node_modules/sky-list/src/';
```
Install plugin
```js
Vue.use(SkyList);
```

## <a id="options"></a>Option tables
### SkyList options
| Name  | Type  | Default   | Options   | Description   |
|----|----|----|----|----|
| **parameters** | Object | `{ keywords: '' }`  |  | Parameters to use in query declared with initial value |
| **options** | Object | `{` <br>  `api: '/umbraco/api/site/search/',` <br> `limit: 10,` <br> `showCount: false,` <br> `paginationType: 'more',` <br> `loadFetch: false,` <br>`}` | **paginationType** <br> navigation <br> numeric <br> pagination <br> more <br> all | Change custom request setup. <br> `loadFetch`: enables/disables fetch on page load. <br> `showCount`: enables/disables "x" results found. <br> `api`: your prefered endpoint |
| **filter** | Object | `{}` |  | Declare query properties to be handled as filters eg: <br> `{ fitlerName: initialValue }` |
| **value-map** | Object | `{}` |  | If a v-model returns a object and a prop is needed, it can be declared with initial value eg: <br> `{ nestedPropName: initialValue }` |
| **validate-query** | Function | `query => query.keywords` |  |  |
| **live-search** | Boolean | `true` |  | Enable/disable search on query change |

### Slots options
| Name | Slot-scope | Description |
|--|--|--|
| **listForm** | `query` Object | Slot for custom form setup to be `v-model`'ed against SkyList query |
| **listItem** | `index` Number <br> `listItem` Object | Slot for custom item markup |
| **resultMessage** | `query` Object <br> `pagination` Object | Slot for custom message when results are found |
| **noResultMessage** | `query` Object | Slot for custom message when **no** results are found |
| **listMore** | `itemsLeft` Number | Slot for custom show more button |
| **listPrev** |  | Slot for custom previous button |
| **listNext** |  | Slot for custom next button |
| **paginationBullet** | `count` Number | Slot for custom pagination bullets |


## <a id="examples"></a>Examples
```html
<sky-list>
	<div
		slot="listForm"
		slot-scope="{ query }"
	>
		<input type="text" v-model="query['keywords']" placeholder="Type your search query">
	</div>


	<div
		slot="listItem"
		slot-scope="{ index, item }"
		:item="item"
	>
	    Custom handling of list item
	</div>
</sky-list>
```

### Component options (with default values)
```html
<sky-list
    :parameters="{ keywords: '' }" || Add your own key/value pair with initial values
    :options="{
    	api: '/umbraco/api/site/search/',
    	limit: 10,
    	showCount: false, || true |false
    	paginationType: 'more', || 'navigation' | 'pagination' | 'more' | 'all' | 'numeric'
    	loadFetch: false,
    }"
    :validate-query="query => query.keywords" || parse in your own query validation
    :live-search="true" || true/false
    :value-map="{}" || If v-model returns an object setup rule for which prop to use eg. { nestedPropName: initialValue }
>
    <!-- content config here -->
    <!-- pagination config here -->
</sky-list>
```

### Content slots (with default values)
Sky-list exposes different slot which can be customized

#### Message slots
`resultMessage`: custom message displayed when results are found
```html
<sky-list ... >
    <span
        slot="resultMessage"
        slot-scope="{ query, pagination }"
    >
    	Your search for <em>"{{query.keywords}}"</em> returned <em>{{pagination.total}} {{(pagination.total === 1) ? 'result' : 'results'}}</em>
    </span>
</sky-list>
```

`noResultMessage`: custom message displayed when no results are found
```html
<sky-list ... >
    <span
        slot="noResultMessage"
        slot-scope="{ query }"
        v-text="'Your search for ${query.keywords} returned no results'"
    />
</sky-list>
```
#### List item slot
`listItem`: Slot for customizing list items. exposes item object and list index
```html
<sky-list ...>
	<div
		slot="listItem"
		slot-scope="{ item, index }"
	>
	    <small v-text="`No. ${index + 1}`"
	    <h2 v-text="item.title" />
	    <p v-text="item.teaser" />
	</div>
</sky-list>
```

Preferably this can be used with custom components like this
```html
<sky-list ...>
    <MyComponent
        slot="listItem"
		slot-scope="{ item, index }"
		:my-prop-for-data="item"
		:my-prop-for-index="index"
	/>
</sky-list>
```

#### Pagination slot options (with default values)
##### paginationType: 'more' | 'all'
Slot for customizing show more / all button
```html
<sky-list ... >
	<span
	    slot="listMore"
	    slot-scope="{ itemsLeft }"
	    v-text="`${itemsLeft} not displayed`"
    />
</sky-list>
```

##### paginationType: 'navigation' | 'pagination'
`listPrev`: Slot for customizing previous button
`nextPrev`: Slot for customizing next button
```html
<sky-list ... >
    <span slot="listPrev">Previous</span>
    <span slot="listNext">Next</span>
</sky-list>
```

##### paginationType: 'numeric' | 'pagination'
`paginationBullet`: Slot for customizing bullets
```html
<sky-list ... >
	<span
	    slot="paginationBullet"
	    slot-scope=" { count }"
	    v-text="`Page ${count}`"
    />
</sky-list>
```

## <a id=“api”></a>API Response Setup
SkyList expects a response with the following setup
```js
{
    "meta":{
        "code":200
    },
    "pagination":{
        "total":1,
        "limit":10,
        "offset":0
    },
    "data":[
        {
            title: 'item1',
            teaser: 'lorem ipsum',
        },
        {
            title: 'item2',
            teaser: '',
        },
        {
            title: 'item3',
            teaser: null,
        },
        ...
    ]
}
```

## Credits
This module is made by the Frontenders at [skybrud.dk](http://www.skybrud.dk/). Feel free to use it in any way you want. Feedback, questions and bugreports should be posted as issues. Pull-requests appreciated!
