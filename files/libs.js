"use strict";

exports.utils = $tw.utils;
let lib,libname;
try {
	lib = require("$:/plugins/tiddlywiki/highlight/highlight.js")
	libname = "highlight" 
} catch (e) {
	lib = (require("$:/plugins/bj/tiddlyprism/prismjs.js").Prism||Prism)
	libname = "Prism"
}

exports.highlightElement  = function (el) {
	if (libname="Prism") return lib.highlightElement(el,false);
	return lib.highlightElement(el);
} 
			
		
		
	
	
