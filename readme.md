# sky-list
> Simple js module with shared list methods used by sky-news, sky-search, etc.

## Dependencies
- [axios](https://github.com/mzabriskie/axios)

## Usage
Use `new SkyList( [config], [params] )` to create instance. If no config or params supplied the defaults are:
``` js
// Default configuration
{
    // API endpoint
	api: '/umbraco/api/SiteSearchApi/Search/',
	// Debounce concurrent requests by ms
	debounce: 200,
	// Append to list if false. Use pagination if true (exchange all items in list on next() or previous()
	pagination: false,
	// Keep url query parameters updated
	urlParams: true,
};

// Default parameters
{
    keywords: ''
};
```
**Examples:**
``` js
import SkyList from 'sky-list.class';

// Custom config and parameters
const list = new SkyList({
    api: '/lookAtThatGloriousEndpoint/',
    debounce: 400,
    pagination: true,
    urlParams: true,
},{
    keywords: '',
    stayClassy: false,
});

// Update params
list.params.keyword = 'lamp';
list.params.stayClassy = true;

// Trigger update
list.update();

// Get items here
list.results.items;
```
Find more example of usage and Vue integration in [skySearch](https://github.com/skybrud/sky-search).

## Methods
The `SkyList` class exposes these methods:
- `update()` - Fetches list (based on `list.params`)
- `next()` - Fetches next items in list
- `previous()` - Fetches previous items in list (only applicable when `pagination:true`)
- `reset()` - Clear list contents and revert to initial state
- `cancel()` - Cancel previous request

# Credits
This module is made by the Frontenders at [skybrud.dk](http://www.skybrud.dk/). Feel free to use it in any way you want. Feedback, questions and bugreports should be posted as issues. Pull-requests appreciated!
