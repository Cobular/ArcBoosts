// This will run in the background
var chromeURLstylable;
chrome.permissions.contains({origins: ["chrome://*/*", "chrome://boost/edit/162f10e9-4ba2-419a-9ced-4fddd51628b0"], permissions: ["tabs"]}, function(state) {
    chromeURLstylable = state;
    console.log("chrome:// urls support", state);

    if (chromeURLstylable) {
        chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
            if (info.status == "loading" && tab.url.indexOf("chrome://") == 0) {
                chrome.tabs.insertCSS({
                    file: "styles.css", 
                    runAt: "document_start",
                    allFrames: true
                });
            }
        });
    }
    
});