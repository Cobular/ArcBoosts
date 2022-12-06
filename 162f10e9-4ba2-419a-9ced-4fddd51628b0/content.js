console.log("eaae");


const main_content = document.getElementById("main-content")
main_content.style.backgroundColor = 'red'

const button = document.createElement("button")
button.textContent = "test"
main_content.prepend(button)

async function getNewFileHandle() {
  const options = {
    types: [
      {
        description: 'Text Files',
        accept: {
          'text/plain': ['.txt'],
        },
      },
    ],
  };
  const handle = await window.showSaveFilePicker(options);
  return handle;
}

async function test(e) {
 console.log(chrome.runtime.id)
  let fileHandle;
  // Destructure the one-element array.
  [fileHandle] = await window.showDirectoryPicker({
    startIn: 'documents'
  });
  // Do something with the file handle.

  fileHandle.showSaveFilePicker({
      
  })
  console.log(fileHandle)
  return false
}

button.onclick = test
