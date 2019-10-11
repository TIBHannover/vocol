#!/bin/bash 

# this file is created manaually and we use it to search,test, and fix code;

# TODO add more content to check with jshint;
# Idea: Script will generate us an overview of small error like missing semicolons and others


# Hint if not jshint is not installed you can do so by running 'npm install -g jshint'  it will install it globally so you dont have to reinstall it for other projects


jshint app.js
jshint  ./bin/www