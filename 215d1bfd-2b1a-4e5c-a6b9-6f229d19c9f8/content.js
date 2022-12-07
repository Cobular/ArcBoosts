// Alternate link click logic
async function processClick(elem, url) {
  const parent = elem.closest("[org-source]");

  let parent_url;
  // If parent is null, it's probably from search
  if (parent === null) {
    parent_url = "search"
  } else {
    parent_url = parent.getAttribute("org-source")
  }

  const resp = await fetch(url)

  const htmlString = await resp.text();
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(htmlString, "text/html");

  const parsed = parse_doc(htmlDoc)

  doc_tree.insert_doc(parsed.main_content, url, parent_url)

  parsed.main_content.scrollIntoView({
    behavior: 'smooth'
  })
}

// Link interception logic - https://stackoverflow.com/a/33616981
async function interceptClickEvent(e) {
  async function process_link(link) {
    href = link.getAttribute('href');

    //put your logic here...
    if (true) {
      e.preventDefault();
      await processClick(link, href)
      //tell the browser not to respond to the link click
    }
  }
  var href;
  var target = e.target || e.srcElement;
  if (target.tagName === 'A') {
    process_link(target)
  }

  const parent_a = target.closest("a")
  if (parent_a !== null) {
    process_link(parent_a)
  }
}

//listen for link click events at the document level
if (document.addEventListener) {
  document.addEventListener('click', interceptClickEvent);
} else if (document.attachEvent) {
  document.attachEvent('onclick', interceptClickEvent);
}

// Start by getting the main content, storing it,
// then removing everything but the overall header
function removeAllChildNodes(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

/**
 * @typedef DocumentComponents
 * @type {object}
 * @property {HTMLElement} main_content
 * @property {HTMLElement} search_tabs
 */

/**
 * @param {Document} doc
 * @returns {DocumentComponents}
 */
function parse_doc(doc) {
  const main_content = doc.getElementById("content")
  const navigation = doc.getElementById("mw-navigation")
  const left_panel = doc.getElementById("mw-panel")

  const login_stuff = doc.getElementById("p-personal")
  const main_or_talk_tabs = doc.getElementById("left-navigation")
  const search_tabs = doc.getElementById("right-navigation")

  return {
    main_content,
    search_tabs
  }
}

/**
 * @param {DocumentComponents} doc_components
 */
function clean_doc(doc, doc_components) {
  const body = doc.body;

  removeAllChildNodes(body)
  body.appendChild(doc_components.login_stuff)
  body.appendChild(doc_components.main_content)
}
/**
 * Preps a doc for insertion (adding columns, etc)
 * 
 * @param {Element} doc
 * @returns {[string, Element]}
 */
function prep_doc(doc, url) {
  console.log(url)
  const title = doc.getElementsByClassName('firstHeading')[0].textContent
  doc.setAttribute("org-source", url)

  return [title, doc]
}

/** 
 * The data about some specific page, including the subtree.
 * */
class DocumentElement {
  /**
   * 
   * @param {Element} page
   * @param {string} url
   * @param {string} title
   */
  constructor(page, url, title) {
    /** @type Element */
    this.doc = page
    /** @type string */
    this.url = url
    /** @type string */
    this.title = title
    /** @type Object.<string, DocumentElement> */
    this.children = {}
    /** @type string */
    this.selected_child = undefined
  }

  /** 
   * Get the html elements of this and all child elements that should be made active
   * @returns {DocumentElement[]}
  */
  getActiveSubtree() {
    // If there is no selected child, return undefined.
    if (this.selected_child === undefined)
      return [this];

    // Otherwise, return a ref to the currently selected child.
    return [this, ...this.children[this.selected_child].getActiveSubtree()]
  }

  /** Tries to find an element by url in the subtree
   * 
   * @props {string} url
   * @returns {DocumentElement | undefined}
   */
  findElementInSubtree(url) {
    if (this.url === url)
      return this
    else {
      if (this.children.length === 0)
        return undefined
      else {
        const child_results = Object.values(this.children).map((child) => child.findElementInSubtree(url)).filter((e) => e !== undefined)
        if (child_results.length > 0)
          return child_results[0]
        else return undefined
      }
    }
  }

  addChild(url, child) {
    this.children[url] = child
  }

  setSelectedDocument(child_url) {
    this.selected_child = child_url
  }
}

/**
 * A level in the displayed tree. Each one of these shows a single
 * document, along with the tabs required to switch between other
 * documents branching from this level.
 * 
 * @class
 * @property {Element} elem
 * @property {Element} doc_container - The slot where documents are inserted
 * @property {Element} name_container - The slot where name tabs are inserted
 * @property {[string, OnTabClick, OnTabClick][]} tabs
 */
class LevelFrame {
  constructor() {
    [
      this.elem,
      this.doc_container,
      this.name_container
    ] = LevelFrame.createFrameElement();
    /** @type [string, OnTabClick, OnTabClick][] */
    this.tabs = []
  }

  /** The element part of the constructor 
   * 
   * @returns {[Element, Element, Element]}
  */
  static createFrameElement() {
    const frame = document.createElement('div')

    frame.classList.add("page_parent")
    const name_panel = document.createElement("div")
    name_panel.classList.add("name_strip")
    frame.appendChild(name_panel)

    const document_container = document.createElement("div")
    document_container.classList.add("scroll-container")
    frame.appendChild(document_container)

    return [frame, document_container, name_panel]
  }

  /** Creates a new name tab
   * 
   * @param {string} name
   * @param {OnTabClick} cb_interact
   * @returns {Element}
   */
  static createNameElement(name, cb_interact) {
    const name_element = document.createElement("h3")
    name_element.classList.add("boost-nameelement")
    name_element.textContent = name
    name_element.addEventListener('click', cb_interact)
    return name_element
  }

  /**
   * Callback that updates the state of the tree when a tab is clicked
   * @typedef {function(): bool} OnTabClick
   */

  /** 
   * Add a new tab to this item. 
   * Needs the name and the callback that will update the tree when clicked. 
   * 
   * @param {string} name
   * @param {OnTabClick} cb_interact
   * @param {OnTabClick} cb_close
   */
  addTab(name, cb_interact, cb_close) {
    this.tabs.push([name, cb_interact, cb_close])

    console.log({tabs_name: name})
    removeAllChildNodes(this.name_container)
    for (let tab of this.tabs) {
      this.name_container.appendChild(LevelFrame.createNameElement(tab[0], tab[1]))
    }
  }

  setContents(page) {
    this.doc_container.appendChild(page)
  }

  /** Returns the Element that should be drawn */
  getElemToDraw() {
    return this.elem
  }
}

/** 
 * The tree of documents currently open.
 * */
class DocumentTree {
  // Docs is a recursive structure of DocumentElements
  constructor(container) {
    /** @type Object.<string, DocumentElement> */
    this.root_docs = {}
    /** @type string */
    this.active_root_doc = undefined
    /** @type Element */
    this.container = container
  }

  /** 
   * Generates a tabbed frame that can have docs inserted.
   * 
   * @returns {LevelFrame} - 
  */
  create_frame() {
    return new LevelFrame();
  }

  /** Redraws the container from the current state */
  redraw_container() {
    // Clear out the container
    removeAllChildNodes(container)

    // If the stack is empty, draw the "nothing here" thing!
    if (this.root_docs.length == 0) {
      throw new Error("nothing here!")
    }

    const things_to_draw = this.root_docs[this.active_root_doc].getActiveSubtree()
    console.log({things_to_draw, things_len: things_to_draw.length})
    // Draw each of the things!
    for (let i = 0; i < things_to_draw.length; i++) {
      const this_frame = this.create_frame()
      const this_page = things_to_draw[i]

      this_frame.addTab(this_page.title, () => console.log("clicked!"))
      this_frame.setContents(this_page.doc)

      container.appendChild(this_frame.getElemToDraw())
    }
  }

  /**
   * Insert a document at the root level. Used for search or for main page.
   * 
   * @param {Element} this_doc - the document we want to insert into the page
   * @param {string} this_url - the URL of this document (needed to key everything)
   */
  insert_root(this_doc, this_url) {
    // Clean up the doc for presentation
    const [title, doc] = prep_doc(this_doc, this_url);

    const wrapped_doc = new DocumentElement(doc, this_url, title)

    this.root_docs[this_url] = wrapped_doc;
    this.active_root_doc = this_url;

    this.redraw_container()
  }

  insert_doc(this_doc, this_url, found_on_page_url) {
    // First, see if this element itself exists.
    const this_element_already_exists = this.root_docs[this.active_root_doc].findElementInSubtree(this_url)
    
    if (this_element_already_exists !== undefined) {
      console.log("existing")
    } else {
      // The element doesn't already exist, so we need to figure out where to put it!
      
      // Search through open docs to see if we can find the parent
      const this_element_parent = this.root_docs[this.active_root_doc].findElementInSubtree(found_on_page_url)
      
      // Clean up the doc for presentation
      const [title, doc] = prep_doc(this_doc, this_url)
      const wrapped_doc = new DocumentElement(doc, this_url, title)

      if (this_element_parent !== undefined) {
        // append after the parent
        this_element_parent.addChild(this_url, wrapped_doc)
        this_element_parent.setSelectedDocument(this_url)
      } else {
        throw Error("Tried to insert an element with no parent!")
      }
    }

    this.redraw_container()

    this_doc.scrollIntoView({
      behavior: 'smooth'
    })
  }
}


/** Fully cleans the document then adds our scrolling chrome 
 * 
 * @param {Document} doc
 * @param {Element} upper_chrome
 * @param {string} starting_url
 * @param {Element} starting_page_data
 * @returns {Element} container
 * */
function first_time_setup(doc, search) {
  const body = doc.body;

  removeAllChildNodes(body)

  let big_container = doc.createElement("div");
  big_container.id = "boost-container"
  body.appendChild(big_container)

  // header
  const header = document.createElement("div")
  header.id = "boost-header"
  const header_text = document.createElement("h1")
  header_text.id = "boost-headertext"
  header_text.textContent = "Infinite Wikipedia"
  header.appendChild(header_text)
  header.appendChild(search)


  for (child of search.children) {
    if (child.id != "p-search")
      child.remove()
  }
  big_container.appendChild(header)

  let sub_container = doc.createElement("div");
  sub_container.id = "boost-subcontainer"
  big_container.appendChild(sub_container)

  return sub_container
}

const processed_doc = parse_doc(document)
const container = first_time_setup(document, processed_doc.search_tabs)
const doc_tree = new DocumentTree(container)


doc_tree.insert_root(processed_doc.main_content, window.location.pathname, undefined)

