const State = Object.freeze({
  INITIAL: Symbol("initial"),
  ACTIVE: Symbol("active"),
  COUNTDOWN_COUNTER: Symbol("countdownCounter"),
  IDLE: Symbol("idle")
});

const settings = {
  screensaverPage : {
    url: 'https://www.svt.se/',
    dimPercent: 80   //fully dimmed
  },
  
  webPage : {
    url: 'https://www.sydsvenskan.se/lund',
    dimPercent: 0   //no dim
  },
  noDim: 0,
  idleTime : 15,								// Idle time in seconds
  countDownStart: 5
};

const runtime = {
  screensaver : {
    tabId : -1,
  },
  webPage: {
    tabId : -1,
  },
  state : State.INITIAL,
  countdownBeforeIdlenessTimerId: null,
  countdownCounterTimerId: null
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

function ChangeScreenBrightness(tabId, dimPercent) {
  const dimValue = dimPercent / 100;  

  chrome.tabs.get(tabId, function(tab) {
    if (tab.status === 'complete') {
      chrome.tabs.sendMessage(tabId, {
        message: 'change_screen_brightness',
        dimPercent: dimPercent
      }, function(response) {
        if (response) {
          console.log(response.status);  // Logs 'success'
        } else {
          console.log('No response received');
        }
      });
    }
  });
};

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle') {
    runtime.state = State.IDLE;
    // Clear the countdown if the state changes to 'idle'
    if (runtime.countdownBeforeIdlenessTimerId) {
      clearTimeout(runtime.countdownBeforeIdlenessTimerId);
      runtime.countdownBeforeIdlenessTimerId = null;
    }
  } else if (state === 'active') {
    runtime.state = State.ACTIVE;
    // Start a countdown when the state changes to 'active'
    runtime.countdownBeforeIdlenessTimerId = setTimeout(() => {
      console.log('5 seconds left before idle');
    }, (settings.idleTime - 5) * 1000);
  }  
});


async function ChangeState() {

  await OpenWebPageTabs();

  if (runtime.state === State.INITIAL) {

    runtime.state = State.ACTIVE;    
    //chrome.idle.setDetectionInterval(settings.idleTime);
    setInterval(async function() { await ChangeState(); }, 5000);

  } else if (runtime.state === State.ACTIVE) {
    await OpenWebPageTabs();
    chrome.tabs.update(runtime.webPage.tabId, {active: true});
    ChangeScreenBrightness(runtime.screensaver.tabId, settings.noDim);
    runtime.state = State.IDLE;

  } else if (runtime.state === State.COUNTDOWN_COUNTER) {
    chrome.tabs.update(runtime.screensaver.tabId, {active: true});
    ChangeScreenBrightness(runtime.screensaver.tabId, settings.screensaverPage.dimPercent);
    await OpenWebPageTabs();
    runtime.state = State.ACTIVE;
  } else if (runtime.state === State.IDLE) {
    chrome.tabs.update(runtime.screensaver.tabId, {active: true});
    ChangeScreenBrightness(runtime.screensaver.tabId, settings.screensaverPage.dimPercent);
    await OpenWebPageTabs();
    runtime.state = State.ACTIVE;
  }
}


// start the extension
(async function() {
  await ChangeState();
})();