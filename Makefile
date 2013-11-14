.PHONY: default
default: dependencies test

.PHONY: dep
dependencies:
	npm install

.PHONY: test
test: lint
	./node_modules/.bin/mocha

.PHONY: lint
lint:
	node_modules/.bin/jshint .
