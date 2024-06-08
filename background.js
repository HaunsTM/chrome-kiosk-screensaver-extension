const State = Object.freeze({
  INITIAL: Symbol("initial"),
  ACTIVE: Symbol("active"),
  COUNTDOWN_COUNTER: Symbol("countdownCounter"),
  IDLE: Symbol("idle")
});

// common settings constants
const settings = {
  screensaverPage : {
    urlStart: 'http://10.0.0.6:8123/local/screensaver/index.html#/screen-saver',
    regexMandatoryUrl: /(https?:[/]{2})10[.]0[.]0[.]6[:]8123[/](?=.*screen-saver).*/g,
    dimPercent: 80   //fully dimmed
  },
  
  webPage : {
    urlStart: 'http://10.0.0.6:8123/lovelace/default_view',
    regexMandatoryUrl: /(https?:[/]{2})10[.]0[.]0[.]6[:]8123[/](?!local[/]).*/g,
    dimPercent: 0   //no dim
  },
  noDim: 0,
  idleTime : 15,								// Idle time in seconds
  countDownStart: 5
};

// common runtime variables
const runtime = {
  screensaver : {
    urlCurrent : 'NO_URL',
    tabId : -1,
  },
  webPage: {
    urlCurrent : 'NO_URL',
    tabId : -1,
  },
  state : State.INITIAL,
  countdownBeforeIdlenessTimerId: null,
  countdownCounterTimerId: null,
  countdownCounterValue: -1
}

// debug logic
const WriteToLog = (logMessage) => {
  let currentDateTime = new Date();
  let year = currentDateTime.getFullYear();
  let month = String(currentDateTime.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed in JS
  let date = String(currentDateTime.getDate()).padStart(2, '0');
  let hours = String(currentDateTime.getHours()).padStart(2, '0');
  let minutes = String(currentDateTime.getMinutes()).padStart(2, '0');
  let seconds = String(currentDateTime.getSeconds()).padStart(2, '0');

  console.log(`[${year}-${month}-${date} ${hours}:${minutes}:${seconds} ] - ${logMessage}`);
}

const SetTabName = (tabId, newTabName) => {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function(newTitle) {
      document.title = newTitle;
    },
    args: [newTabName]
  });
}

// tab logic
function findTabId(regex) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      for(let i = 0; i < tabs.length; i++) {
        if (regex.test(tabs[i].url) || regex.test(tabs[i].pendingUrl)) {
          resolve(tabs[i].id);
          return;
        }
      }
      
      WriteToLog(`NOT_FOUND ${regex} | ${JSON.stringify(tabs)}`)
      resolve(-1);  // Return -1 if no tabs match the URL      
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

async function OpenWebPageTab(targetUrl, targetUrlRegex) {
  const existingTabId = await findTabId(targetUrlRegex);
  if (existingTabId !== -1) {    
    return existingTabId;
  } else {
    const newTabId =  await createTabAndGetId(targetUrl);
    
    return newTabId;
  }
}

async function EnsureOpenWebPagesAndUpdateTabIds() {
  const screensaverPageTabPromise = await OpenWebPageTab(settings.screensaverPage.urlStart, settings.screensaverPage.regexMandatoryUrl);
  const webPageTabPromise = OpenWebPageTab(settings.webPage.urlStart, settings.webPage.regexMandatoryUrl);

  [runtime.screensaver.tabId, runtime.webPage.tabId] = await Promise.all([screensaverPageTabPromise, webPageTabPromise]);
  SetTabName(runtime.screensaver.tabId,runtime.screensaver.tabId);
  SetTabName(runtime.webPage.tabId,runtime.webPage.tabId);
}

//message to content.js
function ChangeScreenBrightness(tabId, dimPercent) {
  const dimValue = dimPercent / 100;
  
  const message = {            
    category: `backgroundToContentEvent`,
    tabId: tabId,
    time: Date.now(),
    task: 'changeScreenBrightness',
    setPoint: dimValue
  };

  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    } else if (tab.status === 'complete') {
      chrome.tabs.sendMessage(tabId, message, function(response) {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message);
        } else if (response) {
          WriteToLog('change_screen_brightness done');
        } else {
          WriteToLog('No response received, possible reasons could be: no listener in content script, or the listener did not send a response.');
        }
      });
    }
  });
}

async function ChangeState() {
  
  await EnsureOpenWebPagesAndUpdateTabIds();

  switch (runtime.state) {
    case State.INITIAL:
      WriteToLog(`State.INITIAL`);
      
      runtime.state = State.ACTIVE;
      await ChangeState();
      break;
    case State.ACTIVE:
      WriteToLog(`State.ACTIVE`);

      // Clear the timeout if it exists
      if (runtime.countdownBeforeIdlenessTimerId) {
        clearTimeout(runtime.countdownBeforeIdlenessTimerId);
      }
      if (runtime.countdownCounterTimerId) {
        clearInterval(runtime.countdownCounterTimerId);
      }

      ChangeScreenBrightness(runtime.screensaver.tabId, settings.noDim);
      // Set a new timeout
      runtime.countdownBeforeIdlenessTimerId = setTimeout(async () => {
        runtime.state = State.COUNTDOWN;
        await ChangeState();
      }, (settings.idleTime - settings.countDownStart) * 1000);
      break;

    case State.COUNTDOWN:
      WriteToLog(`State.COUNTDOWN`);

      if (runtime.countdownCounterTimerId) {
        clearInterval(runtime.countdownCounterTimerId);
      }
      
      runtime.countdownCounterValue = settings.countDownStart;

      runtime.countdownCounterTimerId = setInterval(async () => {
        runtime.countdownCounterValue--;
        console.log(`Countdown: ${runtime.countdownCounterValue}`);
        if (runtime.countdownCounterValue <= 0) {
          if (runtime.countdownCounterTimerId) {
            clearInterval(runtime.countdownCounterTimerId);
          }
        }
      }, 1000);
      break;
    case State.IDLE:
      WriteToLog(`State.IDLE`);

      if (runtime.countdownBeforeIdlenessTimerId) {
        clearTimeout(runtime.countdownBeforeIdlenessTimerId);
      }
      if (runtime.countdownCounterTimerId) {
        clearInterval(runtime.countdownCounterTimerId);
      }

      ChangeScreenBrightness(runtime.screensaver.tabId, settings.screensaverPage.dimPercent);
      break;
  }
}

// Listen for connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  // Listen for messages from the content script
  port.onMessage.addListener(async (message) => {
    if (message.category === 'documentEvent' &&
      (message.type === 'click' || 
       message.type === 'keydown' || 
       message.type === 'mousemove' || 
       message.type === 'touchmove' || 
       message.type === 'touchstart' 
     )) {
     runtime.state = State.ACTIVE;
     
     await ChangeState();
   }
  });
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle') {
    runtime.state = State.IDLE;
  } else if (state === 'active') {
    runtime.state = State.ACTIVE;
  }
  await ChangeState();
});

chrome.idle.setDetectionInterval(settings.idleTime);

// start the extension
(async () => {
  await ChangeState();
})();