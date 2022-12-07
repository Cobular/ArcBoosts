// Alternate link click logic
async function processClick(elem, url_string) {
  const parent = elem.closest("[org-source]");

  let parent_url;
  // If parent is null, it's probably from search
  if (parent === null) {
    parent_url = "search"
  } else {
    parent_url = parent.getAttribute("org-source")
  }

  const url_obj = new URL(url_string, window.location.origin)
  url_obj.searchParams.append("useskin", "vector")

  const resp = await fetch(url_obj)

  const htmlString = await resp.text();
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(htmlString, "text/html");

  const parsed = parse_doc(htmlDoc)

  doc_tree.insert_doc(parsed.main_content, url_string, parent_url)

  parsed.main_content.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
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
  const parent_a = target.closest("a")
  if (target.tagName === 'A') {
    process_link(target)
  } else if (parent_a !== null) {
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
 * Preps a doc for insertion (adding columns, etc)
 * 
 * @param {Element} doc
 * @returns {[string, Element]}
 */
function prep_doc(doc, url) {
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
    if (this.selected_child === undefined || Object.keys(this.children).length === 0) {
      this.selected_child = undefined;
      return [this];
    }
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

  removeChildByUrl(url) {
    delete this.children[url]
    this.selected_child = undefined
    if (Object.keys(this.children).length !== 0) {
      const children = Object.keys(this.children)
      this.selected_child = children[children.length - 1]
    }
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
      this.name_container,

      this.name_parent
    ] = LevelFrame.createFrameElement();

    let callback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting === true) {
          this.name_container.classList.remove("boost-tabs-hover-left")
          this.name_container.classList.remove("boost-tabs-hover-right")
        } else {
          if (entry.boundingClientRect.x < 0)
            this.name_container.classList.add("boost-tabs-hover-left")

          if (entry.boundingClientRect.x + entry.boundingClientRect.width > window.innerWidth)
            this.name_container.classList.add("boost-tabs-hover-right")
        }
      });
    };


    this.observer = new IntersectionObserver(callback, {
      root: document.getElementById("boost-subcontainer"),
      rootMargin: '0px',
      threshold: 1
    })

    this.observer.observe(this.name_parent)

    /** @type [string, OnTabClick, OnTabClick][] */
    this.tabs = []
  }

  /** The element part of the constructor 
   * 
   * @returns {[Element, Element, Element, Element]} - the frame element, the document container element, the low level tab element, the tab element to observe
  */
  static createFrameElement() {
    const frame = document.createElement('div')

    frame.classList.add("page_parent")
    const name_panel = document.createElement("div")
    const name_panel_parent = document.createElement("div")
    name_panel_parent.classList.add("name-strip-parent")
    name_panel.classList.add("name_strip")
    name_panel_parent.appendChild(name_panel)
    frame.appendChild(name_panel_parent)

    const document_container = document.createElement("div")
    document_container.classList.add("scroll-container")
    frame.appendChild(document_container)

    return [frame, document_container, name_panel, name_panel_parent]
  }

  /** Creates a new name tab
   * 
   * @param {string} name
   * @param {OnTabClick} cb_interact
   * @returns {Element}
   */
  static createNameElement(name, active, cb_interact, cb_close) {
    const name_element_wrapper = document.createElement("div")
    name_element_wrapper.classList.add("boost-nameelement")

    if (active === true)
      name_element_wrapper.classList.add("boost-active-nameelement")

    const name_element = document.createElement("h3")

    // truncate the length if longer than 10
    if (name.length > 20) {
      name = `${name.slice(0, 17)}...`
    }

    name_element.textContent = name
    name_element.addEventListener('click', cb_interact)
    name_element_wrapper.appendChild(name_element)

    if (cb_close !== undefined) {
      const close_button = document.createElement("button")
      close_button.classList.add("boost-closebutton")
      close_button.addEventListener('click', cb_close)
      close_button.textContent = "x"
      name_element_wrapper.appendChild(close_button)
    }

    return name_element_wrapper
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
   * @param {OnTabClick | undefined} cb_close - the callback to close this element. If undefined, don't render the x button!
   */
  addTab(name, active_tab_name, cb_interact, cb_close) {
    this.tabs.push([name, cb_interact, cb_close])

    removeAllChildNodes(this.name_container)
    for (let tab of this.tabs) {
      this.name_container.appendChild(
        LevelFrame.createNameElement(
          tab[0], tab[0] === active_tab_name, tab[1], tab[2]
        )
      )
    }
  }

  setContents(page) {
    this.doc_container.appendChild(page)
  }

  /** Returns the Element that should be drawn */
  getElemToDraw() {
    return this.elem
  }

  /** Fully resets and clears out the frame. Makes a single frame reusable. */
  clear() {
    removeAllChildNodes(this.doc_container)
    this.tabs = []
    removeAllChildNodes(this.name_container)
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
    /** @type LevelFrame[] */
    this.frames = []
  }

  /** 
   * Generates a tabbed frame that can have docs inserted.
   * 
   * @param {number} i - the index of frame to access
   * @returns {LevelFrame, bool} - The frame plus if this frame should be appended to the doc (only if it was new)
  */
  get_clean_frame(i) {
    if (this.frames.length > i) {
      this.frames[i].clear();
      // console.log({"cleared and reloaded": this.frames, this_one: this.frames[i]})

      return [this.frames[i], false]
    } else {
      while (this.frames.length < i) {
        this.frames.push(new LevelFrame())
      }
      const last_frame = new LevelFrame()
      this.frames.push(last_frame)
      // console.log({"new frames generated": this.frames, this_one_index: this.frames[i], this_one_returned: last_frame})

      return [last_frame, true]
    }
  }

  removeRootNodeByURL(url) {
    delete this.root_docs[url]
    this.active_root_doc = undefined
    if (Object.keys(this.root_docs).length !== 0) {
      const children = Object.keys(this.root_docs)
      this.active_root_doc = children[children.length - 1]
    }
  }

  /** Redraws the container from the current state */
  redraw_container() {
    // If the stack is empty, draw the "nothing here" thing!
    if (this.root_docs.length == 0) {
      throw new Error("nothing here!")
    }

    const this_root_doc = this.root_docs[this.active_root_doc]
    const things_to_draw = this_root_doc.getActiveSubtree()

    // Draw each of the things!

    // Process root node seperately 
    const [root_frame, should_append] = this.get_clean_frame(0)
    {
      const this_page = things_to_draw[0]

      Object.values(this.root_docs).forEach(function (root_node, i) {
        const select_root = function() {
          this.active_root_doc = root_node.url
          this.redraw_container()
          root_frame.elem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          })
        }.bind(this)

        const close_root = function () {
          console.log(this)
          this.removeRootNodeByURL(root_node.url)
          this.redraw_container()
        }.bind(this)

        root_frame.addTab(
          root_node.title,
          this_page.title,
          select_root,
          i === 0 ? undefined : close_root
        )
      }.bind(this))

      root_frame.setContents(this_page.doc)
      if (should_append === true)
        container.appendChild(root_frame.getElemToDraw())
    }

    let i;

    // Process every other node
    let prev_frame = root_frame;
    for (i = 1; i < things_to_draw.length; i++) {
      const [this_frame, should_append] = this.get_clean_frame(i)
      const this_page = things_to_draw[i]
      const parent_doc = things_to_draw[i - 1]

      // Do the tabs
      for (const sibling_node of Object.values(parent_doc.children)) {
        const select = () => {
          console.log("Clicked!")
          parent_doc.setSelectedDocument(sibling_node.url)
          this.redraw_container()
          console.log(this_frame.elem)
          this_frame.elem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          })
        }
        const close = () => {
          parent_doc.removeChildByUrl(sibling_node.url)
          this.redraw_container()
        }

        this_frame.addTab(sibling_node.title, this_page.title, select, close)
        if (should_append === true)
          container.appendChild(this_frame.getElemToDraw())

      }

      // Write in the selected node content
      this_frame.setContents(this_page.doc)

      prev_frame = this_frame
    }

    // Now we need to clean up extra frames using i
    while (this.frames.length > i) {
      const frame = this.frames.pop()
      frame.elem.remove()
      console.log("removed frame")

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
        this.root_docs[this_url] = wrapped_doc;
        this.active_root_doc = this_url;
      }

      this.redraw_container()
    }

    this_doc.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
  }
}


/** 
 * 
 * Fully cleans the document then adds our scrolling chrome 
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
  header_text.innerHTML = '<span class="boost-infinite">Infinite</span> Wikipedia'
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

function ensure_correct_url() {
  const starting_url= new URL(window.location.href)
  if (starting_url.searchParams.has('useskin')){
    return
    }
  starting_url.searchParams.delete("useskin")
  starting_url.searchParams.append("useskin", "vector")
  window.location.href = starting_url
}

document.documentElement.style.display = "none"
ensure_correct_url()


let processed_doc, container, doc_tree
window.addEventListener('load', function () {
  processed_doc = parse_doc(document)
  container = first_time_setup(document, processed_doc.search_tabs)
  doc_tree = new DocumentTree(container)

  doc_tree.insert_root(processed_doc.main_content, window.location.pathname, undefined)
  document.documentElement.style.display = "unset"
})


