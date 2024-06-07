// this script contains listeners for different tyoes of user actions in the DOM

document.addEventListener('click', (e) => {
  chrome.runtime.sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'click',
  });
});

document.addEventListener('keydown', (e) => {
  chrome.runtime.sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'keydown',
  });
});

document.addEventListener('mousemove', (e) => {
  chrome.runtime.sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'mousemove',
  });
});

document.addEventListener('touchmove', (e) => {
  chrome.runtime.sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'touchmove',
  });
});

document.addEventListener('touchstart', (e) => {
  chrome.runtime.sendMessage({
    category: `documentEvent`,
    event: e,
    time: Date.now(),
    type: 'touchstart',
  });
});