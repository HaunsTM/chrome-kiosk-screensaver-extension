
importScripts("mqtt.min.js");

// Now you can use the MQTT library
// For example, create a client and connect to a broker
let mqttClient = null;
let idleTimer = null;

const State = Object.freeze({
  INITIAL: Symbol("initial"),
  ACTIVE: Symbol("active"),
  COUNTDOWN_COUNTER: Symbol("countdownCounter"),
  IDLE: Symbol("idle"),
  ALERT: Symbol("alert")
});

// common settings constants
const settings = {
  screensaverPage : {
    urlStart: 'http://10.0.0.6:8123/local/screensaver/index.html#/screen-saver',
    regexMandatoryUrl: /(https?:[/]{2})10[.]0[.]0[.]6[:]8123[/](?=.*screen-saver).*/g,
    dimPercent: 60   //fully dimmed
  },
  
  webPage : {
    urlStart: 'http://10.0.0.6:8123/lovelace/default_view',
    regexMandatoryUrl: /(https?:[/]{2})10[.]0[.]0[.]6[:]8123[/](?!local[/]).*/g,
    dimPercent: 0   //no dim
  },
  noDim: 0,
  idleTime : 10,								// Idle time in seconds
  countDownStart: 5,
  countDownDim: 30,
  mqtt : {
    brokerURL: 'ws://10.0.0.6:1884',
    credentials: {
      username: 'mqtt1',
      password: 'mqtt1'
    },
    topicIotKioskAlert: 'iot/kiosk/alert',
    topicIotKioskDebug: 'iot/kiosk/debug'
  }
};

// common runtime variables
const runtime = {
  alertPage : {
    urlCurrent : 'NO_URL',
    messageToDisplay:"",
    dimPercent: 0, // no dim
    timeToShowURLBeforeGoingToActiveStateMs: 1,
    tabId : -1
  },
  screensaver : {
    urlCurrent : 'NO_URL',
    tabId : -1,
  },
  webPage: {
    urlCurrent : 'NO_URL',
    tabId : -1,
  },
  state : State.INITIAL,
  alertTimerId: null,
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

const GetTimestamp = () => {
  let date = new Date().toLocaleString("sv-SE", {timeZone: "Europe/Stockholm"});
  date = new Date(date);

  let year = date.getFullYear();
  let month = ("0" + (date.getMonth() + 1)).slice(-2);
  let day = ("0" + date.getDate()).slice(-2);
  let hours = ("0" + date.getHours()).slice(-2);
  let minutes = ("0" + date.getMinutes()).slice(-2);
  let seconds = ("0" + date.getSeconds()).slice(-2);

  let timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  return timestamp;
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

const SendDebugMqtt = (message) => {
  const messageObject = {
    time: GetTimestamp(),
    message: message
  };

  mqttClient?.publish(
    settings.mqtt.topicIotKioskDebug, JSON.stringify(messageObject));
}

const StartConsumeMqtt = () => {

  const ConnectToBroker = () => {
    mqttClient = mqtt.connect(settings.mqtt.brokerURL, settings.mqtt.credentials); 
  };
  ConnectToBroker();

  // Subscribe to a topic
  mqttClient.subscribe(settings.mqtt.topicIotKioskAlert);

  // Listen for incoming messages
  mqttClient.on("message", async (topic, messageBuffer) => {
    const message = messageBuffer.toString();

    switch(topic) {
      case settings.mqtt.topicIotKioskAlert:
        runtime.state = State.ALERT;
        messageJSON = JSON.parse(message);
        runtime.alertPage = Object.assign(runtime.alertPage, messageJSON);
        await ChangeState();
        break;
      default:
        SendDebugMqtt()
    }
  });

  // Handle disconnections
  mqttClient.on("close", () => {
      // Implement reconnection logic here
      setTimeout(ConnectToBroker, 5000); // Reconnect after 5 seconds (adjust as needed)
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
      
      //WriteToLog(`NOT_FOUND ${regex} | ${JSON.stringify(tabs)}`)
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
function sendMessageToTab(tabId, message, callback) {
  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    } else if (tab.status === 'complete') {
      chrome.tabs.sendMessage(tabId, message, function(response) {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message);
        } else if (response) {
          callback(response);
        } else {
          WriteToLog('No response received, possible reasons could be: no listener in content script, or the listener did not send a response.');
        }
      });
    }
  });
}

function ChangeScreenBrightness(tabId, dimPercent) {
  const dimValue = dimPercent / 100;
  
  const message = {
    category: `backgroundToContentEvent`,
    tabId: tabId,
    time: Date.now(),
    task: 'changeScreenBrightness',
    setPoint: dimValue
  };

  sendMessageToTab(tabId, message, function(response) {
    WriteToLog('change_screen_brightness done');
  });
}

function PrintCountDownCounterValue(tabId, counterValue) {
  const message = {
    category: `backgroundToContentEvent`,
    tabId: tabId,
    time: Date.now(),
    task: 'countDown',
    setPoint: counterValue
  };

  sendMessageToTab(tabId, message, function(response) {
    if (response) {
      //WriteToLog(`countdown performed: ${response}`);
    } else {
      WriteToLog(`countdown failed: ${response}`);
    }
  });
}

function RemoveCountDownCounter (tabId) {
  const message = {
    category: `backgroundToContentEvent`,
    tabId: tabId,
    time: Date.now(),
    task: 'countDownRemove',
    setPoint: null
  };

  sendMessageToTab(tabId, message, function(response) {
    if (response) {
      //WriteToLog(`countDownRemove performed: ${response}`);
    } else {
      WriteToLog(`countDownRemove failed: ${response}`);
    }
  });
}
                                                     
async function ChangeState() {
  
  await EnsureOpenWebPagesAndUpdateTabIds();

  switch (runtime.state) {
    case State.INITIAL:
      WriteToLog(`State.INITIAL`);
      
      StartConsumeMqtt();
      idleTimer = new Timer(settings.idleTime, OnTimesUpGoToIdle);
      runtime.state = State.ACTIVE;
      await ChangeState();
      break;

    case State.ACTIVE:
      WriteToLog(`State.ACTIVE`);

      idleTimer = idleTimer?? new Timer(settings.idleTime, OnTimesUpGoToIdle);
      idleTimer.start();

      // Clear the timeout if it exists      
      if (runtime.countdownBeforeIdlenessTimerId) {
        clearTimeout(runtime.countdownBeforeIdlenessTimerId);
        runtime.countdownBeforeIdlenessTimerId = null;
      }

      if (runtime.countdownCounterTimerId) {
        clearTimeout(runtime.countdownCounterTimerId);
        runtime.countdownCounterTimerId = null;
      }

      RemoveCountDownCounter(runtime.webPage.tabId);
      ChangeScreenBrightness(runtime.webPage.tabId, settings.noDim);
      ChangeScreenBrightness(runtime.screensaver.tabId, settings.noDim);
      
      // Set a new timeout
      runtime.countdownBeforeIdlenessTimerId = setTimeout(async () => {
        runtime.state = State.COUNTDOWN;
        await ChangeState();
      }, (settings.idleTime - settings.countDownStart) * 1000);
      
      chrome.tabs.update(runtime.webPage.tabId, {active: true});
      break;

    case State.COUNTDOWN:
      WriteToLog(`State.COUNTDOWN`);

      if (runtime.countdownCounterTimerId) {
        clearInterval(runtime.countdownCounterTimerId);
      }
      
      runtime.countdownCounterValue = settings.countDownStart;
      ChangeScreenBrightness(runtime.webPage.tabId, settings.countDownDim);

      runtime.countdownCounterTimerId = setInterval(async () => {
        runtime.countdownCounterValue--;
        PrintCountDownCounterValue(runtime.webPage.tabId, runtime.countdownCounterValue);        
      }, 1000);
      break;

    case State.IDLE:
      WriteToLog(`State.IDLE`);
      idleTimer?.stop();

      if (runtime.countdownBeforeIdlenessTimerId) {
        clearTimeout(runtime.countdownBeforeIdlenessTimerId);
        runtime.countdownBeforeIdlenessTimerId = null;
      }

      if (runtime.countdownCounterTimerId) {
        clearTimeout(runtime.countdownCounterTimerId);
        runtime.countdownCounterTimerId = null;
      }

      ChangeScreenBrightness(runtime.screensaver.tabId, settings.screensaverPage.dimPercent);
      chrome.tabs.update(runtime.screensaver.tabId, {active: true});
      
      RemoveCountDownCounter(runtime.webPage.tabId);
      ChangeScreenBrightness(runtime.webPage.tabId, settings.noDim);
      break;
    case State.ALERT:
      idleTimer?.stop();

      if (runtime.countdownBeforeIdlenessTimerId) {
        clearTimeout(runtime.countdownBeforeIdlenessTimerId);
        runtime.countdownBeforeIdlenessTimerId = null;
      }

      if (runtime.countdownCounterTimerId) {
        clearTimeout(runtime.countdownCounterTimerId);
        runtime.countdownCounterTimerId = null;
      }
      runtime.alertPage.tabId = await createTabAndGetId(runtime.alertPage.urlCurrent);
      chrome.tabs.update(runtime.alertPage.tabId, {active: true});
      ChangeScreenBrightness(runtime.alertPage.tabId, runtime.alertPage.dimPercent);

      runtime.alertTimerId = setTimeout(async () => {        
        clearTimeout(runtime.alertTimerId);
        runtime.alertTimerId = null;
        chrome.tabs.remove(runtime.alertPage.tabId);
        runtime.state = State.ACTIVE;
        await ChangeState();
      }, runtime.alertPage.timeToShowURLBeforeGoingToActiveStateMs);

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
       // message.type === 'mousemove' || // mousemove seems to trigger even if no mouse or movement is present 
       message.type === 'touchmove' || 
       message.type === 'touchstart' 
     )) {
     runtime.state = State.ACTIVE;
     SendDebugMqtt(`event registered: ${JSON.stringify(message)}`);
     
     await ChangeState();
   }
  });
});


const OnTimesUpGoToIdle = async () => {
  runtime.state = State.IDLE;
  await ChangeState();
}

// start the extension
(async () => {
  await ChangeState();
})();


class Timer {
  constructor(seconds, onTimesUpCallbackFunction) {
      this.seconds = seconds;
      this.originalSeconds = seconds;
      this.intervalId = null;
      this.onTimesUpCallback = onTimesUpCallbackFunction;
  }

  initiate() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.reset();
  }

  start() {
    this.initiate();
    this.intervalId = setInterval(() => {
        if(this.seconds === 0) {
            this.timesUp();
            this.stop();
        } else {
            this.seconds--;
            console.log(this.seconds);
        }
    }, 1000);
  }

  reset() {
      this.seconds = this.originalSeconds;
  }

  stop() {    
    this.initiate();
  }

  timesUp() {
    this.onTimesUpCallback();
  }
}