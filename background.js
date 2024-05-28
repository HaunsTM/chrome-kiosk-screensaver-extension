const State = Object.freeze({
  INITIAL: Symbol("initial"),
  IDLE: Symbol("idle"),
  ACTIVE: Symbol("active")
});

const settings = {
  screensaverPage : {
    url: 'https://www.svt.se/',
    dimPercent: 50   //fully dimmed
  },
  
  webPage : {
    url: 'https://www.sydsvenskan.se/lund',
    dimPercent: 0   //no dim
  },

  idleTime : 15								// Idle time in seconds
};

const runtime = {
  screensaver : {
    tabId : -1,
  },
  webPage: {
    tabId : -1,
  },
  state : State.INITIAL
}

function findTabId(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({url: url}, (tabs) => {
      if (tabs.length > 0) {
        resolve(tabs[0].id);  // Return the ID of the first tab that matches the URL
      } else {
        resolve(-1);  // Return -1 if no tabs match the URL
      }
    });
  });
}

async function createTabAndGetId(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({url: url}, (tab) => {
      resolve(tab.id);
    });
  });
}

async function OpenWebPageTab(url) {
  const existingTabId = await findTabId(url);
  if (existingTabId !== -1) {
    return existingTabId;
  } else {
    const newTabId =  await createTabAndGetId(url);
    return newTabId;
  }
}

async function OpenWebPageTabs() {
  const screensaverPageTabPromise = OpenWebPageTab(settings.screensaverPage.url);
  const webPageTabPromise = OpenWebPageTab(settings.webPage.url);

  [runtime.screensaver.tabId, runtime.webPage.tabId] = await Promise.all([screensaverPageTabPromise, webPageTabPromise]);
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
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message);
        } else {
          console.log(response.status);  // Logs 'success'
        }
      });
    } else {
      chrome.tabs.onUpdated.addListener(function listener (tabId, info) {
        if (info.status === 'complete' && tabId === tab.id) {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(tabId, {
            message: 'dim_screen',
            dimPercent: dimPercent
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.log(chrome.runtime.lastError.message);
            } else {
              console.log(response.status);  // Logs 'success'
            }
          });
        }
      });
    }
  });
};

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle') {
    runtime.state = State.IDLE;
  } else if (state === 'active') {
    runtime.state = State.ACTIVE;
  }
  
console.log(state);
  await ChangeState();
});


async function ChangeState() {

  if (runtime.state === State.INITIAL) {

    await OpenWebPageTabs();
    runtime.state = State.ACTIVE;    
    chrome.idle.setDetectionInterval(settings.idleTime);

  } else if (runtime.state === State.ACTIVE) {
    debugger;
    await OpenWebPageTabs();
    chrome.tabs.update(runtime.webPage.tabId, {active: true});
    DimScreen(runtime.webPage.tabId, settings.webPage.dimPercent);

  } else if (runtime.state === State.IDLE) {
    debugger;
    chrome.tabs.update(runtime.screensaver.tabId, {active: true});
    DimScreen(runtime.screensaver.tabId, settings.screensaverPage.dimPercent);
    await OpenWebPageTabs();

  }
}

(async function() {
  await ChangeState();
})();