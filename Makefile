.PHONY: default
default: lint test

.PHONY: test
test:
	./node_modules/.bin/mocha

.PHONY: lint
lint:
	node_modules/.bin/jshint .
