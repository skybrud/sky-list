# sky-list

Angular-module with shared list-methods used by sky-news, sky-search, etc.

Use ´createInstance(key:String, preferences:Object,})´ to create instance of skyList. This (and ´getInstance(key)´) will return a promise that resolves to the service-instance, that you can then call methods on and bind to your view. 
Remember to use ´killInstance(key)´ to cleanup when the consumer-directive is destroyed. 

Find example usage in [skyNews](https://github.com/skybrud/sky-news), or see TSdefinitions or source for further documentation.

### Credits

This module is made by the Frontenders at [skybrud.dk](http://www.skybrud.dk/). Feel free to use it in any way you want. Feedback, questions and bugreports should be posted as issues. Pull-requests appreciated!
