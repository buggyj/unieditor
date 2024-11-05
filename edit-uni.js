/*\
title: $:/plugins/bj/unieditor/edit-uni.js
type: application/javascript
module-type: widget

adapter to uniEditor lib for editing code  files

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var MIN_TEXT_AREA_HEIGHT = 100; // Minimum height of textareas in pixels

var Widget = require("$:/core/modules/widgets/widget.js").widget;
var newid=0;
var uniEditorWidget = function(parseTreeNode,options) {
			// Initialise the editor operations if they've not been done already
		if(!this.editorOperations) {
			uniEditorWidget.prototype.editorOperations = {};
			$tw.modules.applyMethods("texteditoroperation",this.editorOperations);
		}
	this.initialise(parseTreeNode,options);
};
if($tw.browser) {
var uniEditor =	require("$:/plugins/bj/unieditor/unieditor.js").uniEditor;
}
/*
Inherit from the base widget class
*/
uniEditorWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/

uniEditorWidget.prototype.render = function(parent,nextSibling) {
	var self = this;
	console.log("enter render")
    this.saving = false;
	// Save the parent dom node
	this.parentDomNode = parent;
	// Compute our attributes
	this.computeAttributes();
	// Execute our logic
	this.execute();
	// Create our element
 	// Create the wrapper for the toolbar and render its content
	this.toolbarNode = this.document.createElement("div");
	this.toolbarNode.className = "tc-editor-toolbar";
	parent.insertBefore(this.toolbarNode,nextSibling);
	this.domNodes.push(this.toolbarNode);
	this.editInfo = this.getEditInfo();
 	// Render toolbar child widgets
	this.renderChildren(this.toolbarNode,null);
	this.domNode = this.document.createElement("div");
	this.domNode.classList.add("tc-edit-texteditor","tc-edit-texteditor-body")
	this.domNode.style.display = "inline-block";
	parent.insertBefore(this.domNode,nextSibling);
 	this.domNodes.push(this.domNode);
	
	this.editopts.language=this.editInfo.type;
	if (!this.instance)
		this.instance = new uniEditor(this.domNode, (code) => {
			self.saveChanges(code);
		}, this.editopts);

	this.instance.setCode(this.editInfo.value)
	// Add widget message listeners
		this.addEventListeners([
			{type: "tm-edit-text-operation", handler: "handleEditTextOperationMessage"}
		]);
};
	uniEditorWidget.prototype.handleEditTextOperationMessage = function(event) {
		// Prepare information about the operation
		var operation =this.createTextOperation();
		// Invoke the handler for the selected operation
		var handler = this.editorOperations[event.param];
		if(handler) {
			handler.call(this,event,operation);
		}
		var newText = operation.text.substring(0,operation.cutStart) + operation.replacement + operation.text.substring(operation.cutEnd);
		// Execute the operation via the engine
		//var newText = this.engine.executeTextOperation(operation);
		console.log(operation)
		this.instance.setCode(newText)
	}; 
	uniEditorWidget.prototype.createTextOperation = function() {
	var textarea = this.domNode.querySelector('textarea');
	var operation = {
		text: textarea.value,
		selStart: textarea.selectionStart,
		selEnd: textarea.selectionEnd,
		cutStart: null,
		cutEnd: null,
		replacement: null,
		newSelStart: null,
		newSelEnd: null
	};
	operation.selection = operation.text.substring(operation.selStart,operation.selEnd);
	return operation;
};
//uniEditorWidget.prototype.destroy = function(){}
/*
Get the tiddler being edited and current value
*/
uniEditorWidget.prototype.getEditInfo = function() {
	// Get the edit value
	var self = this,
		value,
		type,
		update;
		
		// Get the current tiddler and the field name
		var tiddler = this.wiki.getTiddler(this.editTitle);
		if(tiddler) {
			// If we've got a tiddler, the value to display is the field string value
			value = tiddler.getFieldString(this.editField);
			type = tiddler.getFieldString("type")||'';
		} else {
			// Otherwise, we need to construct a default value for the editor
			value = '';
			type = '';
		}

		update = function(value) {
			var tiddler = self.wiki.getTiddler(self.editTitle),
				updateFields = {
					title: self.editTitle
				};
			updateFields[self.editField] = value;
            self.saving = true;
			self.wiki.addTiddler(new $tw.Tiddler(self.wiki.getCreationFields(),tiddler,updateFields,self.wiki.getModificationFields()));
		};console.log("type is "+type)
	if (type in this.mappings) type = this.mappings[type]||type
	return {value: value, update: update, type: type};
};

/*
Compute the internal state of the widget
*/
uniEditorWidget.prototype.execute = function() {
	// Get our parameters
	this.editTitle = this.getAttribute("tiddler",this.getVariable("currentTiddler"));
	this.editField = this.getAttribute("field","text");
	this.editIndex = this.getAttribute("index");
	this.editClass = this.getAttribute("class");
	// Get the editor element tag and type
	var tag,type;
	if(this.editField === "text") {
		tag = "textarea";
	} else {
		tag = "input";
		var fieldModule = $tw.Tiddler.fieldModules[this.editField];
		if(fieldModule && fieldModule.editTag) {
			tag = fieldModule.editTag;
		}
		if(fieldModule && fieldModule.editType) {
			type = fieldModule.editType;
		}
		type = type || "text";
	}

	this.editopts=$tw.wiki.getTiddlerData("$:/plugins/bj/unieditor/edoptions.json");
	this.mappings=$tw.wiki.getTiddlerData("$:/plugins/bj/unieditor/mappings.json");
 this.makeChildWidgets();
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
const modetid="$:/config/TextEditor/EditorHeight/Mode"
const Heighttid="$:/config/TextEditor/EditorHeight/Height"
uniEditorWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	// Completely rerender if any of our attributes have changed
	if(changedAttributes.tiddler || changedAttributes.field || changedAttributes.index) {
		this.refreshSelf();
		return true;
	}
	if(changedTiddlers[this.editTitle]) {
		//BJ FIXED saving cause the widget to get redrawn
        //Gurumed - Only a 'saving' variable is needed and every time we 
        //save we set to true, and then test here, if true set to false and
        //return, else refresh
        if (this.saving) {
            this.saving = false
        }else {
            this.refreshSelf()
        }
		return true;
	}
	if(changedTiddlers[modetid]) {
		var fields ={}
		var mode = $tw.wiki.getTiddlerText(modetid)
		if (mode ==="fixed") this.editopts.height = $tw.wiki.getTiddlerText(Heighttid)
		else this.editopts.height =""
		fields.text = JSON.stringify(this.editopts,null,$tw.config.preferences.jsonSpaces);
		fields.title ="$:/plugins/bj/unieditor/edoptions.json"
		fields.type = "application/json"
		this.wiki.addTiddler(new $tw.Tiddler(fields))	
	};
	if(changedTiddlers[Heighttid]) {
		var fields ={}
		this.editopts.height = $tw.wiki.getTiddlerText(Heighttid)
		fields.text = JSON.stringify(this.editopts,null,$tw.config.preferences.jsonSpaces);
		fields.title ="$:/plugins/bj/unieditor/edoptions.json"
		fields.type = "application/json"
		this.wiki.addTiddler(new $tw.Tiddler(fields))
	};		
	if(changedTiddlers["$:/plugins/bj/unieditor/edoptions.json"]) {
		let self = this
		console.log("refesh")
		this.domNode.innerHTML=""
		this.instance = new uniEditor(this.domNode, (code) => {
		self.saveChanges(code);
		}, this.editopts);
		this.instance.setCode(this.editInfo.value)
	}
	return this.refreshChildren(changedTiddlers);

};

uniEditorWidget.prototype.saveChanges = function(text) {
	var editInfo = this.getEditInfo();
	if(text !== editInfo.value) {
		editInfo.update(text);
	}
};

exports["edit-uni"] = uniEditorWidget;

})();
