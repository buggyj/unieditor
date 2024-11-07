"use strict";

const {highlightElement,utils} = require("$:/plugins/tiddlywiki/unicode/libs.js");

exports.uniEditor = class uniEditor {
  constructor (parent, callback, opts) {
    opts = opts||{}
    this.events = {}
    this.editor = document.createElement('div')
    parent.appendChild(this.editor)
    this.editor.classList.add('unieditor')
    this.canvasLayer = new canvas(this.editor,opts)
    this.textLayer = new textLayer(this.editor,this.canvasLayer.scrollCanvas,
						this.canvasLayer.updateCanvas,this.resize,callback,opts)    
  }

    resize = (newHeight) => {
	  this.editor.style.height = newHeight;
  }

setCode (code) {this.textLayer.setCode(code)}

  destroy(){
    this.editor.remove();
  }
}

//===============cavas area
 class canvas  {
	constructor(parent,opts) {
    this.canvas = document.createElement('pre')
	parent.appendChild(this.canvas)
    this.canvas.classList.add('unieditor__pre','unieditor_controlwrap')
    this.canvas.classList.add(`language-${opts.language||'html'}`)
    if (!!opts.height) {this.canvas.classList.add('overflowy')}
    else if (!opts.dev) {this.canvas.classList.add('overflowy')}
    
    if (opts.textReverse) this.canvas.setAttribute('dir', 'rtl')
  }
 
  updateCanvas = (code) => {
	this.canvas.innerHTML = $tw.utils.htmlEncode(code)
    highlightElement(this.canvas, false)
  }
  
   scrollCanvas = (e) => { 
	  	this.canvas.style.transform= `translate(-${e.target.scrollLeft}px,-${e.target.scrollTop}px)`;
  }
  
  //destroy() {}
}   
//===============text area
  class textLayer {
	constructor(parent, scrollCanvas, updateCanvas, resize, callback, opts) {
	this.containerResize = resize
	this.callback = callback
	this.opts = opts
	this.updateCanvas = updateCanvas
	
    this.txtarea = document.createElement('textarea')
    parent.appendChild(this.txtarea)
    this.txtarea.classList.add('unieditor__textarea','unieditor_controlwrap')
    this.txtarea.classList.add(`lang-${opts.language||'html'}`)
    
    if (!!opts.height) {this.txtarea.classList.add('overflowy')}
    else    if (opts.dev) {this.txtarea.classList.add('NoOverflowy');}//chrome  only
			else {this.txtarea.classList.add('overflowy')}
    
    if (opts.textReverse) this.txtarea.setAttribute('dir', 'rtl')
    if (opts.spellCheck) {
        if (Array.isArray(opts.spellCheck)) {console.log(opts)
         if (opts.spellCheck.indexOf(opts.language||'html') ===-1) this.txtarea.setAttribute('spellcheck', 'false')
		} else   this.txtarea.setAttribute('spellcheck', 'false')
	}  
    this.doTabs =     (opts.tabs)?    this.handleTabs:(e)=>{return false};
    this.doBrackets = (opts.brackets)?this.handleBrackets:(e)=>{return false};      
    this.doIndents =  (opts.indents)? this.handleIndents:(e)=>{return false};   

    this.txtarea.addEventListener('keydown', this.whenKey = (e) => {
      if  (this.doTabs(e)||this.doBrackets(e)||this.doIndents(e)||this.handleHistory(e))
             this.updateEditor()//bj mod
    })
    this.txtarea.addEventListener('input', this.whenInput = (e) => {
		this.updateEditor()
    })
    this.txtarea.addEventListener('scroll', this.whenScroll = (e) => {
		scrollCanvas(e)
    })
  }
  
  destroy() {
	this.txtarea.removeEventListener("input",this.whenInput)
	this.txtarea.removeEventListener("keydown",this.whenKeydown)
	this.txtarea.removeEventListener("scroll",this.whenScroll)
  }

  updateEditor (data) {
    this.code = data||this.txtarea.value
    this.updateCanvas(this.code)
    this.containerResize(this.opts.height?this.opts.height:$tw.utils.resizeTextAreaToFit(this.txtarea,"100px")+"px");
    setTimeout(()=>{this.callback(this.code)}, 1)
  }

  setCode = (code) => {
    this.txtarea.value = code
    this.updateEditor(code)
  }
  
//--------------------tabs
  handleTabs (event) {
	
	function lineStartPx(textarea, selectionStart) {//begining of first line
		const txtBefore = textarea.value.slice(0, selectionStart);
		return txtBefore.lastIndexOf("\n") + 1
	}  
	 
	if (event.key === "Tab") { 
		let tab = this.opts.tabs;
		const txtarea = this.txtarea
		event.preventDefault(); 
		let start = txtarea.selectionStart
		const end = txtarea.selectionEnd;
		
		if (start === end) {
			txtarea.setRangeText(tab, start, end, "end");
			return true
		} 
		
		start = lineStartPx(txtarea, start);
		const selectedText = txtarea.value.slice(start, end);
		const lines = selectedText.split("\n");

		let modifiedText;
		if (event.shiftKey) {
			// Shift + Tab: Un-indent 
			modifiedText = lines.map(line => {
				if (line.startsWith(tab)) { 
					return line.slice(tab.length); 
				}
				return line; //else no tab found 
			}).join("\n");
		} else {
			// Tab: Indent by a 'tab'
			modifiedText = lines.map(line => tab + line).join("\n")
		}

		txtarea.setRangeText(modifiedText, start, end, "end");

		// Adjust the selection to maintain the highlighted area
		txtarea.selectionStart = start;
		txtarea.selectionEnd = start + modifiedText.length;
		return true
	}
	return false
  }
//--------------------Brackets
  handleBrackets (event) {
	const brackets = {'(': ')','[': ']','{': '}','"': '"',"'": "'","<":">"};
    const key = event.key
    
    if (!brackets[key]) return false
    event.preventDefault()
    const txtarea = this.txtarea
	const start = txtarea.selectionStart
	const end = txtarea.selectionEnd
	let selectedText = ""
	if (start<end) selectedText = txtarea.value.slice(start, end);
	
	txtarea.setRangeText(key+selectedText+brackets[key], start, end, "end");
	txtarea.setSelectionRange((end+1),(end+1))
	return true

  }
//--------------------Indents
  handleIndents (e) {
    if (e.key !== "Enter") return false
    //gurumed - history for undo/redo could be implemented on newline here
	const txtarea = this.txtarea
	event.preventDefault(); 
	
	const caretPosition = txtarea.selectionStart;
	const lineStart = txtarea.value.lastIndexOf('\n', caretPosition - 1) + 1;
	const currentLine = txtarea.value.slice(lineStart, caretPosition);

	//number of leading spaces from the start of the line to the first non-space character
	const leadingSpaces = currentLine.match(/^\s*/)[0].length;	
	
	// Insert newline and spaces
	const spaces = '\n' + ' '.repeat(leadingSpaces);
	const newText = txtarea.value.slice(0, caretPosition) + spaces + txtarea.value.slice(caretPosition);

	// Update textarea content and move the caret
	txtarea.value = newText;
	txtarea.setSelectionRange(caretPosition + spaces.length, caretPosition + spaces.length);

    return true;

  }
  //--------------------history
  handleHistory (e) {  
/*
	// Undo with Ctrl + Z
	if (e.ctrlKey && e.key === "z") {
		e.preventDefault(); 
		undo();
	}
	// Redo with Ctrl + Y
	else if (e.ctrlKey && e.key === "y") {
		e.preventDefault(); 
		redo();
	}

// this is not correct! must handle repeat crt-z and then crt-y
// there needs to be a way to handle history for current line without
// storing the whole text - probably linehistory limited to words.
// linehistory - startOfLine, endOfLine(updated by edits)
// a space triggers storing, movement off line - store and start a new one.
 
    function undo() {
        if (historyStack.length > 0) {
            redoStack.push(currentText); 
            currentText = historyStack.pop(); 
            textarea.value = currentText;
        }
    }

    function redo() {
        if (redoStack.length > 0) {
            historyStack.push(currentText); 
            currentText = redoStack.pop(); 
            textarea.value = currentText;
        }
    }
    // function whenSpace() {} add to line-hisory
    // function whenLineFeed() add to history
       
*/	  
    return false;
  }
}