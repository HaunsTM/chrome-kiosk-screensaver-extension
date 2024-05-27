/*
let screensaverPage = 'http://10.0.0.6:8123/local/kommandoran/index.html#/';
let webpage = 'http://10.0.0.6:8123';
*/

const settings = {
  screensaverPage : {
    url: 'https://www.svt.se/',
    dimPercent: 50   //fully dimmed
  },
  
  webpage : {
    url: 'https://www.sydsvenskan.se/lund',
    dimPercent: 0   //no dim
  },

  idleTime : 15								// Idle time in seconds
};

const runtime = {
  screensaver : {
    tabId : -1,
  },
  webpage: {
    tabId : -1,
  },
  webpageTabsOpened : false
}

OpenWebpageTabs();

function OpenWebpageTabs() {
  if (!runtime.webpageTabsOpened) {
    chrome.tabs.create({url: settings.screensaverPage.url}, (tab) => {
      runtime.screensaver.tabId = tab.id;
    });

    chrome.tabs.create({url: settings.webpage.url}, (tab) => {
      runtime.webpage.tabId = tab.id;
    });

    runtime.webpageTabsOpened = true;
  }
}

function DimScreen(tabId, dimPercent) {
  const dimValue = dimPercent / 100;  

  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    } else if (tab.status === 'complete') {
      chrome.tabs.sendMessage(tabId, {
        message: 'dim_screen',
        dimPercent: dimPercent
      });
    } else {
      chrome.tabs.onUpdated.addListener(function listener (tabId, info) {
        if (info.status === 'complete' && tabId === tab.id) {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.runtime.sendMessage(tabId, {
            message: 'dim_screen',
            dimPercent: dimPercent
        }, function(response) {
            console.log(response.status);  // Logs 'success'
        });
        }
      });
    }
  });
};
chrome.idle.setDetectionInterval(settings.idleTime);


chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle') {
    console.log(`idle: ${runtime.screensaver.tabId}`);
    chrome.tabs.update(runtime.screensaver.tabId, {active: true});
    DimScreen(runtime.screensaver.tabId, settings.screensaverPage.dimPercent);

  } else if (state === 'active') {
    console.log(`active: ${runtime.webpage.tabId}`);
    chrome.tabs.update(runtime.webpage.tabId, {active: true});
    DimScreen(runtime.webpage.tabId, settings.webpage.dimPercent);
  }
})