/*\
title: $:/plugins/bj/unieditor/edit-uni.js
type: application/javascript
module-type: widget

adapter for uniEditor lib for editing code files

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";
const consolelog = function () {}
var MIN_TEXT_AREA_HEIGHT = 100; //in px

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

uniEditorWidget.prototype = new Widget();


uniEditorWidget.prototype.render = function(parent,nextSibling) {
	var self = this;
	consolelog("enter render")
    this.saving = false;
	this.parentDomNode = parent;
	consolelog(this.children)
	
	this.computeAttributes();
	this.execute();
	//only edit with tool bar, else use text editor
	if  (!this.children || this.children.length == 0 || this.document.isTiddlyWikiFakeDom){
		this.makeChildWidgets([{
			type: "edit-" + "text",
			attributes: this.parseTreeNode.attributes,
			children: this.parseTreeNode.children
		}]);
		this.renderChildren(parent,nextSibling);
		return;
	}
	
 	// create toolbarNode so that toolbar is above
	this.toolbarNode = this.document.createElement("div");
	this.toolbarNode.className = "tc-editor-toolbar";
	parent.insertBefore(this.toolbarNode,nextSibling);
	this.domNodes.push(this.toolbarNode);
	this.editInfo = this.getEditInfo();
     
    this.lastSearch = "" 
    this.lastReplace = ""
	this.renderChildren(this.toolbarNode,null);
	this.domNode = this.document.createElement("div");
	this.domNode.classList.add("tc-edit-texteditor","tc-edit-texteditor-body")
	this.domNode.style.display = "inline-block";
	parent.insertBefore(this.domNode,nextSibling);
 	this.domNodes.push(this.domNode);
	
	this.editopts.language=this.editInfo.type;
	//if (!this.instance) - need to destroy?? gurumed
		this.instance = new uniEditor(this.domNode, (code) => {
			self.saveChanges(code);
		}, this.handleKeydownEvent.bind(this), this.editopts);
	//gurumed the following causes an indirect save -- should be sorted out
	this.instance.setCode(this.editInfo.value);consolelog("rend " + this.editInfo.value)
 
		this.addEventListeners([
			{type: "tm-edit-text-operation", handler: "handleEditTextOperationMessage"}
		]);
};
	uniEditorWidget.prototype.handleEditTextOperationMessage = function(event) {
		var operation;
		
		if (event.param ==="historyRedo" ||event.param ==="historyUndo") {
			this.instance.doAction(event.param)
			return
		}	
			
		if (event.param ==="replace-selection"){
			//gurumed set last replace - used when used presses crtl-g -when it is implemented
			this.lastSearch = event.paramObject.find
			this.lastReplace = event.paramObject.text
			// make highlight
			this.createHighLightOP(event.paramObject.find,false);

		}
		if (event.param ==="replace-all"){
			// make highlight
			this.createHighLightOP(event.paramObject.find,false);
			let content= this.domNode.querySelector('textarea').value;
			this.instance.setCode(content.replaceAll( event.paramObject.find, event.paramObject.text));
			return
		}

		// Prepare information about the operation
		operation =this.createTextOperation();
		// Invoke the handler for the selected operation
		var handler = this.editorOperations[event.param];
		if(handler) {
			handler.call(this,event,operation);
		}	
		if(operation.replacement !== null) {
			var newText = operation.text.substring(0,operation.cutStart) + operation.replacement + operation.text.substring(operation.cutEnd);
		}else var newText = operation.text;
		// Execute the operation via the engine
		//var newText = this.engine.executeTextOperation(operation);
		consolelog('oper '+operation)
		this.instance.setCode(newText)
	}; 
	uniEditorWidget.prototype.createHighLightOP = function(searchTerm,next) {
		
		function calculateSelectedTextPosition(textarea) {
		  const selectionStart = textarea.selectionStart;

		  if (selectionStart === textarea.selectionEnd) return; // No selection, so exit

		  // Assume each character has a width of 0.5em
		  const characterWidth = 0.5; // in em units

		  // so charsPerLine = widthOfTextarea / charWidthInPx
		  const charsPerLine = Math.floor(textarea.clientWidth / (characterWidth * parseFloat(getComputedStyle(textarea).fontSize)));

		  // calc xy of selected text relative to start of textarea
		  const textUpToSelection = textarea.value.substring(0, selectionStart);

		  // Initialize line and column counters
		  let line = 0;
		  let column = 0;

		  // Calculate line and column based on text up to selection in chars
		  for (let i = 0; i < textUpToSelection.length; i++) {
			if (textUpToSelection[i] === '\n') {
			  line++;
			  column = 0; // Reset column for the new line
			} else if (column >= charsPerLine) {
			  //rapped line
			  line++;
			  column = 0;
			} else {
			  column++;
			}
		  }

		  const coordY = line * parseFloat(getComputedStyle(textarea).lineHeight); // lineHeight in pixels
		  return Math.round(coordY);

		}//end of calculateSelectedTextPosition


	  const textarea = this.domNode.querySelector('textarea');
	  const text = textarea.value;
	  if (!searchTerm) return; // Do nothing if the search term is empty
	  let start = 0;
	  if (next) start = textarea.selectionEnd||0
	  const index = text.toLowerCase().indexOf(searchTerm.toLowerCase(),start);

	  if (index !== -1) {
		// Highlight the search term by selecting the range
		textarea.focus();
		textarea.selectionStart = index;
		textarea.selectionEnd = index + searchTerm.length;
    // Scroll to the selected text
		const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
		const linesAbove = text.slice(0, index).split("\n").length - 1;
		textarea.scrollTop = calculateSelectedTextPosition(textarea)//linesAbove * lineHeight;
	  } 
	
	}
	uniEditorWidget.prototype.createTextOperation = function(begin,end) {
	var textarea = this.domNode.querySelector('textarea');
	var operation = {
		text: textarea.value,
		selStart: begin||textarea.selectionStart,
		selEnd: end||textarea.selectionEnd,
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

// from tiddlywiki factory.js
uniEditorWidget.prototype.handleKeydownEvent = function(event) {
	// Check for a keyboard shortcut
	if(this.toolbarNode) {
		//crtl-g handled gurumed - probably not needed
		//if (event.ctrlKey && event.key === "g") {
		//	event.preventDefault();
		//	this.createHighLightOP(this.lastSearch,true);
		//	return true
		//}
		var shortcutElements = this.toolbarNode.querySelectorAll("[data-tw-keyboard-shortcut]");
		for(var index=0; index<shortcutElements.length; index++) {
			var el = shortcutElements[index],
				shortcutData = el.getAttribute("data-tw-keyboard-shortcut"),
				keyInfoArray = $tw.keyboardManager.parseKeyDescriptors(shortcutData,{
					wiki: this.wiki
				});
			if($tw.keyboardManager.checkKeyDescriptors(event,keyInfoArray)) {
				var clickEvent = this.document.createEvent("Events");
				clickEvent.initEvent("click",true,false);
				el.dispatchEvent(clickEvent);
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
		}
	}
	// Otherwise, process the keydown normally
	return false;
};
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
		};consolelog("type is "+type)
	if (type in this.mappings) type = this.mappings[type]||type
	return {value: value, update: update, type: type};
};


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
		//BJ FIXED saving causes the widget to get redrawn
        //Gurumed - Only a 'saving' variable is needed and every time we 
        //save we set to true, and then test here, if true set to false and
        //return, else refresh
        if (this.saving) {
            this.saving = false
            return false
        }else {
            this.refreshSelf()
            return true
        }
	}
	if(changedTiddlers[modetid]) {//changes from toolbar buttons
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
		consolelog("refesh")
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
