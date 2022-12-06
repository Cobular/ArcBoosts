// Alternate link click logic
async function processClick(elem, url) {
  const parent = elem.closest("[org-source]");
  const parent_url = parent.getAttribute("org-source")
  console.log({ thisUrl: url, parent_url })
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
  var href;
  var target = e.target || e.srcElement;
  if (target.tagName === 'A') {
    href = target.getAttribute('href');

    //put your logic here...
    if (true) {
      e.preventDefault();
      await processClick(target, href)
      //tell the browser not to respond to the link click
    }
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
 * @property {HTMLElement} login_stuff
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
    login_stuff
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

let open_docs_handler = {
  set(obj, prop, value) {

  }
}
/**
 * Preps a doc for insertion (adding columns, etc)
 * 
 * @param {Element} doc
 */
function prep_doc(doc) {
  const title = doc.getElementsByClassName('firstHeading')[0]
  console.log(title)
  const new_parent = document.createElement("div");
  new_parent.classList.add("page_parent")

  const name_panel = document.createElement("h3")
  name_panel.classList.add("name_strip")

  name_panel.textContent = title.textContent

  new_parent.appendChild(name_panel)
  new_parent.appendChild(doc)

  return new_parent
}

class DocumentTree {
  constructor(container) {
    self.docs = {}
    self.container = container
  }

  insert_doc(this_doc, this_url, found_on_page_url) {
    // First, see if this element itself exists.
    if (this_url in self.docs) {
      console.log("existing")
    } else {
      const doc_preped = prep_doc(this_doc)
      // If it doesn't, let's insert after the parent
      if (found_on_page_url in self.docs) {
        // append after the parent
        const parent_page = self.docs[found_on_page_url];
        parent_page.after(doc_preped)

      } else {
        // append to end of doc
        self.container.appendChild(doc_preped)
      }

      // Handle the setup that happens on all inserts
      doc_preped.setAttribute("org-source", this_url)
      self.docs[this_url] = doc_preped
    }

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
function first_time_setup(doc, upper_chrome) {
  const body = doc.body;

  removeAllChildNodes(body)

  body.appendChild(upper_chrome)
  let big_container = doc.createElement("div");
  big_container.id = "boost-container"
  body.appendChild(big_container)

  let sub_container = doc.createElement("div");
  sub_container.id = "boost-subcontainer"
  big_container.appendChild(sub_container)

  return sub_container
}

const processed_doc = parse_doc(document)
const container = first_time_setup(document, processed_doc.login_stuff)
const doc_tree = new DocumentTree(container)


doc_tree.insert_doc(processed_doc.main_content, window.location.pathname, undefined)

