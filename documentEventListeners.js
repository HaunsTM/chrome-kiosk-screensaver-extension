let port = chrome.runtime.connect();

port.onDisconnect.addListener(function() {
  console.log("The connection to the background page has been lost.");
  port = null; // Clear the port variable
});

function sendMessage(message) {
  if (port) {
    try {
      port.postMessage(message);
    } catch (error) {
      console.log("Failed to send message:", error);
      // Re-establish the connection
      port = chrome.runtime?.connect();
      if (port) {
        port.postMessage(message);
      } else {
        console.log("Failed to re-establish the connection.");
      }
    }
  } else {
    // Re-establish the connection
    port = chrome.runtime?.connect();
    if (port) {
      port.postMessage(message);
    } else {
      console.log("Failed to re-establish the connection.");
    }
  }
}

// Check if the port is still open before sending a message

document.addEventListener('click', (e) => {
  // Send a message through the port
  sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'click',
  });
});

document.addEventListener('keydown', (e) => {
  sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'keydown',
  });
});

document.addEventListener('mousemove', (e) => {
  sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'mousemove',
  });
});

document.addEventListener('touchmove', (e) => {
  sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'touchmove',
  });
});

document.addEventListener('touchstart', (e) => {
  sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'touchstart',
  });
});
