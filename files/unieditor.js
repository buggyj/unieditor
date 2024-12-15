"use strict";

const consolelog = function () {}
const {highlightElement,utils} = require("$:/plugins/tiddlywiki/unicode/libs.js");

exports.uniEditor = class uniEditor {
  constructor (parent, callback, callkey, opts) {
    opts = opts||{}
    this.events = {}
    this.editor = document.createElement('div')
    parent.appendChild(this.editor)
    this.editor.classList.add('unieditor')
    this.canvasLayer = new canvas(this.editor,opts)
    this.textLayer = new textLayer(this.editor,this.canvasLayer.scrollCanvas,
						this.canvasLayer.updateCanvas,this.resize,callback,callkey,opts)    
	//this.doLayer =
  }

    resize = (newHeight) => {
	  this.editor.style.height = newHeight;
  }

setCode (code) {this.textLayer.setCode(code)}
doAction (action) {this.textLayer.doAction(action)}

destroy(){
    this.editor.remove()
    this.editor = null
    this.canvasLayer = null
    this.textLayer.destroy()
    this.textLayer = null
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
	this.canvas.innerHTML = utils.htmlEncode(code)
    highlightElement(this.canvas, false)
  }
  
   scrollCanvas = (e) => { 
	  	this.canvas.style.transform= `translate(-${e.target.scrollLeft}px,-${e.target.scrollTop}px)`;
  }
  
  //destroy() {}
}   
//===============text area
  class textLayer {
	constructor(parent, scrollCanvas, updateCanvas, resize, callback, callkey, opts) {
	this.containerResize = resize
	this.callback = callback
	this.callkey = callkey
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
        if (Array.isArray(opts.spellCheck)) {consolelog(opts)
         if (opts.spellCheck.indexOf(opts.language||'html') ===-1) this.txtarea.setAttribute('spellcheck', 'false')
		} else   this.txtarea.setAttribute('spellcheck', 'false')
	}  
    this.doTabs =     (opts.tabs)?    this.handleTabs:(e)=>{return false};
    this.doBrackets = (opts.brackets)?this.handleBrackets:(e)=>{return false};      
    this.doIndents =  (opts.indents)? this.handleIndents:(e)=>{return false};   

    this.txtarea.addEventListener('keydown', this.whenKey = (e) => {
      if  (this.doTabs(e)||this.doBrackets(e)||this.doIndents(e)||this.handleHistory(e)||this.callkey(e)){
             if (!this.dirty) {
             this.updateTop() 
             this.dirty = true
		 } 
		  this.updateEditor()//bj mod
	  }
    })
    this.txtarea.addEventListener('input', this.whenInput = (e) => {
		if (!this.dirty) {
			this.updateTop()
		    this.dirty = true
		}
		this.updateEditor()
    })
    this.txtarea.addEventListener('scroll', this.whenScroll = (e) => {
		scrollCanvas(e)
    })
    
    this.cursor = []
    this.stack = []
    this.current = 0
    this.top = 0
    this.bottom = 0 
    this.maxSize = opts.historySize||32
    this.dirty = true//gurumed ??
	
	this.txtarea.addEventListener("beforeinput", e => {
		let value
		switch (e.inputType) {
		  case 'historyRedo':
		  e.preventDefault();
		  if(this.dirty) return;//top of history
			value = this.pullRedo()
			if (value === null ) {
				this.txtarea.value=this.dirtyBuffer
				this.setCursor(this.dirtyCursor)
				this.updateEditor(this.dirtyBuffer)
				this.dirty = true
				return
			}
			this.txtarea.value=value.txt
			this.setCursor(value.pos)
			this.updateEditor(value.txt)
			
			break
		  case 'historyUndo':
		  	if (this.dirty) {
				this.dirtyBuffer =this.txtarea.value
				this.dirtyCursor =this.txtarea.selectionEnd
				this.dirty = false
			}
			value = this.pullUndo()
			e.preventDefault();
			if (value === null) return
			this.txtarea.value=value.txt
			this.setCursor(value.pos)
			this.updateEditor(value.txt)
			break
		  case 'insertFromPaste':
		  case 'deleteByCut':
		  case 'insertFromDrop':
		  case 'deleteByDrag':
			if (!this.dirty) this.updateTop()
			this.push(this.txtarea.value,this.txtarea.selectionEnd)
			break
		  default:
			break
		}		
	})
	
	this.txtarea.addEventListener("keydown", e => {	
					// Undo with Ctrl + Z
		let value
		if (e.ctrlKey && e.key === "z") {
		 	if (this.dirty) {
				this.dirtyBuffer =this.txtarea.value
				this.dirtyCursor =this.txtarea.selectionEnd
				this.dirty = false
			}
			value = this.pullUndo()
			e.preventDefault();
			if (value === null) return
			this.txtarea.value=value.txt
			this.setCursor(value.pos)
			this.updateEditor(value.txt)
		}
		// Redo with Ctrl + Y
		else if (e.ctrlKey && e.key === "y") {
			e.preventDefault();
			if(this.dirty) return;
			value = this.pullRedo()
			if (value === null ) {
				this.txtarea.value=this.dirtyBuffer
				this.setCursor(this.dirtyCursor)
				this.updateEditor(this.dirtyBuffer)
				this.dirty = true
				return
			}
			this.txtarea.value=value.txt
			this.setCursor(value.pos)
			this.updateEditor(value.txt)
		}

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
    this.containerResize(this.opts.height?this.opts.height:utils.resizeTextAreaToFit(this.txtarea,"100px")+"px");
    setTimeout(()=>{this.callback(this.code)}, 1)
  }

  setCursor = (pos) => {consolelog(pos,"=====")
	  if (pos === -1) return;
	   this.txtarea.setSelectionRange(pos, pos);
	   this.txtarea.focus()
  }
  
  setCode = (code) => { 
	 //and previous state to history
	if (!this.dirty) this.updateTop()

	if (this.current === 0){ 
		this.push(code)	;consolelog('*****************************')	
	}
	else {this.push(this.txtarea.value,this.txtarea.selectionEnd); consolelog(';;;;;;',this.txtarea.value,this.txtarea.selectionEnd)}
	
    this.txtarea.value = code
    this.updateEditor(code)
    this.dirty = true
  }
  
  doAction = (action) => {
	let value
	switch (action) {
	  case 'historyRedo':
	  if(this.dirty) return;//top of history
		value = this.pullRedo()
		consolelog("uhistredo "+value)
		if (value === null ) {
			this.txtarea.value=this.dirtyBuffer
			this.setCursor(this.dirtyCursor)
			this.updateEditor(this.dirtyBuffer)
			this.dirty = true
			return
		}
		this.txtarea.value=value.txt
		this.setCursor(value.pos)
		this.updateEditor(value.txt)
		
		break
	  case 'historyUndo':
		if (this.dirty) {
			this.dirtyBuffer =this.txtarea.value
			this.dirtyCursor =this.txtarea.selectionEnd
			this.dirty = false
		}
		value = this.pullUndo()
		consolelog("uhistoryundo "+value)
		if (value === null) return
		this.txtarea.value=value.txt
		this.setCursor(value.pos)
		this.updateEditor(value.txt)
		break
	}
  }
  
//--------------------history


  // Push a new string onto the stack, update current, top, and check for maxSize overflow
  push(value,pos =-1) { //consolelog("push " + value + "-" +this.current, this.top, this.dirty,this.stack,this.cursor)
    // If we are in the middle of the stack, remove all items above the current index
    if (this.current < this.top) {
      this.stack = this.stack.slice(0, this.current + 1);
      this.cursor = this.cursor.slice(0, this.current + 1);
    }
    this.stack.push(value)
    this.cursor.push(pos)
    this.current++
    this.top = this.current

    // Check if we exceeded maxSize, if so, remove the bottom item
    if (this.stack.length > this.maxSize) {
      this.stack.shift();  // Remove the first item (bottom of the stack)
      this.cursor.shift();  // Remove the first item (bottom of the stack)
      this.current--;      // Adjust current pointer due to shift
      this.top--;          // Adjust top pointer due to shift
    }
  }

  // Undo action, decrements current index and returns stack[current] if possible
  pullUndo() {consolelog("undo "+ this.current, " "+this.top, this.dirty,this.stack, this.cursor)
    if (this.current > this.bottom) {
      this.current--;
      return {txt:this.stack[this.current],pos:this.cursor[this.current]};
    }
    return null;
  }

  // Redo action, increments current index and returns stack[current] if possible
  pullRedo() {consolelog("redo",this.current, this.top,this.dirty,this.stack, this.cursor)
    if (this.current < this.top) {
      this.current++;
      if (this.current < this.top) return {txt:this.stack[this.current], pos:this.cursor[this.current]};
    }
	return null;
  }

  updateTop () { consolelog ("updatetop", this.dirty,this.stack,this.cursor)
	  this.current++
	  this.stack = this.stack.slice(0, this.current);
	  this.cursor = this.cursor.slice(0, this.current);
	  this.top = this.current
	  this.dirty = true
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
		this.push(txtarea.value,txtarea.selectionEnd)
		let start = txtarea.selectionStart
		const end = txtarea.selectionEnd;
		
		if (start === end) {
			if (!event.shiftKey) {
				txtarea.setRangeText(tab, start, end, "end");
				return true
			}  else if (start > tab.length) {
				txtarea.setRangeText("", start-(tab.length), end);
				txtarea.setSelectionRange(start-(tab.length), start-(tab.length))
				return true
			}
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
    this.push(txtarea.value,txtarea.selectionEnd)
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
    if (e.ctrlKey || e.altKey || e.shiftKey) return false
    //gurumed - history for undo/redo could be implemented on newline here
	const txtarea = this.txtarea
	event.preventDefault(); 
			this.push(txtarea.value,txtarea.selectionEnd)
			
	const caretPosition = txtarea.selectionStart;
	const lineStart = txtarea.value.lastIndexOf('\n', caretPosition - 1) + 1;
	const currentLine = txtarea.value.slice(lineStart, caretPosition);

	//number of leading spaces from the start of the line to the first non-space character
	const leadingSpaces = currentLine.match(/^\s*/)[0].length;	
	
	let firstchar = currentLine[leadingSpaces]
	// Insert newline and spaces
	let spaces = '\n' + ' '.repeat(leadingSpaces);
	if (this.opts.language === "tw" &&  this.opts.bullets.indexOf(firstchar) !== -1) {
		 spaces += firstchar;
		 firstchar = currentLine[leadingSpaces+1]
		 if (this.opts.bullets.indexOf(firstchar) !== -1) {
			 spaces += firstchar;
			 firstchar = currentLine[leadingSpaces+2]
			 if (this.opts.bullets.indexOf(firstchar) !== -1) {
				 spaces += firstchar;
				 firstchar = currentLine[leadingSpaces+3]
				 if (this.opts.bullets.indexOf(firstchar) !== -1) {
					 spaces += firstchar;
				 }
			 }
		 }
	 }
	const newText = txtarea.value.slice(0, caretPosition) + spaces + txtarea.value.slice(caretPosition);

	// Update textarea content and move the caret
	txtarea.value = newText;
	txtarea.setSelectionRange(caretPosition + spaces.length, caretPosition + spaces.length);

    return true;

  }
  //--------------------history
  handleHistory (e) {  
	 if (e.ctrlKey || e.altKey || e.shiftKey) return false
	  if (e.key === ' ' ||e.key === '\n') 	this.push(this.txtarea.value,this.txtarea.selectionEnd)
  
    return false;
  }
}