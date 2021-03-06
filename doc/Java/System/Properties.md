# fridge-freezer

## Java/System/Properties

Read java system properties easily.

### Methods

#### get(key)

Get a property.

* *key* String - The property key.

#### getAsObject(regex)

Get properties as a Object.

If a regex is set, only matching properties are returned
and the matching part of the regex will be removed from the key.

* *regex* RegExp - RegExp for filter properties by key.

#### getAsObjectStructure(regex, [separator])

Get properties as a object structure.

Like getAsObject() but split the list in a object structure.

* *regex* RegExp - RegExp for filter properties by key.
* *separator* String - String for splitting.
