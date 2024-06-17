# Kiosk Screensaver
This Chrome extension aims to mimic a screensaver. There are a few important points to note:

1. Kiosk Mode: This extension cannot be used if Chrome is running in KIOSK mode.
1. Tab Behavior: When the extension is running in a browser, two tabs will be alternating: the “main webpage” and the “screensaver webpage.”
1. Alert Page: The extension can also display an “alert page” in a tab. It consumes MQTT messages, and messages on a certain topic trigger the extension to act. Fo   example, JSON-message
     ```
    {
        "urlCurrent": "https://www.svtplay.se/kanaler/svt2?start=auto", // URL of a web page to display
        "messageToDisplay": "", // Message to display
        "dimPercent": 0, // [0 = no dim <=> 100 = fully dimmed]
        "timeToShowURLBeforeGoingToActiveStateMs": 10 * 1000 // How long the alert tab should be displayed
    }
    ```
on topic `iot/kiosk/alert`.

# When is it suitable to use this screensaver?
For example, use it with your home automation system on a raspberry pi with a touch screen:

| Tab/Url    | Example of usage |
| -------- | ------- |
| main webpage  | home automation system    |
| screensaver webpage | webpage with family photos, weather forecast, clock, bus departures, etc.|
| alert webpage    | video feed from security cam   |


The extension operates as follows:

1. ACTIVE State: If the user is interacting with the browser, the “main webpage” tab is displayed.
1. IDLE State: If the user is not interacting with the browser, the “screensaver webpage” tab is displayed.
1. Alert State: If an alert MQTT message is published, it takes precedence over other states. The alert URL will be displayed in a new tab, which will close after a specified time before returning to the ACTIVE state.
# How to run with Chromium Browser
## Linux:
Open your terminal and type the following command:

```
chromium-browser --noerrdialogs \
  --disable-infobars \
  --load-extension=/home/pi/chrome-kiosk-screensaver-extension \
  --start-fullscreen \
  --check-for-update-interval=31536000 \
  --ignore-gpu-blacklist \
  --use-gl=egl \
  --enable-native-gpu-memory-buffers \
  --enable-accelerated-2d-canvas \
  --force-gpu-rasterization
```
### If code is updated...
Please note that if the code is updated, simply restarting the extension is not enough. You must RELOAD it from the GUI. Follow these steps:
1. Start the extension without the --start-fullscreen flag.
1. Go to chrome://extensions.
1. Reload the extension.
1. Restart the Raspberry Pi and the extension with the --start-fullscreen flag.
## Windows:
(Not the primary target for this extension; provided for development and evaluation purposes.)
Run the following command in the Windows command prompt:
```
chrome.exe --start-fullscreen --load-extension="C:\Users\person\Desktop\chrome-kiosk-screensaver-extension"
```
Or use PowerShell:
```
Start-Process "chrome.exe" -ArgumentList "--start-fullscreen", "--load-extension=C:\Users\person\Desktop\chrome-kiosk-screensaver-extension"
```


# A guide to set up a KIOSK on a Raspberry Pi
A working guide to set up the KIOSK has been this: https://www.oddicles.net/blog/step-by-step-set-up-a-kiosk-web-display-using-the-raspberry-pi/:

> ## Step-by-Step
> 
> ### Configure the raspberry pi
> 
> Enter the command below, and use the configuration that follows. 
> `raspi-config`  may have different menu structures, but the options
> should still be there.
> 
> ```bash sudo raspi-config ```
> 
> 1.  Change the password
> 2.  Set Timezone (ie. America/Vancouver)
> 3.  Set Keyboard (optional, only if not using SSH)
>     1.  Choose “Generic 104-key PC” for US/Canada, 105-key PC (intl.) for the rest of the world
>     2.  Choose “Other Language -> English (US)”
> 4.  Update hostname
> 5.  Display Options -> Underscan -> No Compensation
> 6.  System Options -> Boot/Autologin -> Console Autologin -> Yes
> 7.  Set gpu memory to 128mb or more
> 8.  Set GL graphics driver the FakeKMS. Others may not display properly, or audio may not work
> 9.  Finish and Reboot
> 
> ### Update package (apt) data.
> 
> IMPORTANT! Do this before installing other packages.
> 
> ```bash sudo apt update ```
> 
> ### Install x server and tools
> 
> ```bash sudo apt install -y --no-install-recommends xserver-xorg xinit
> x11-xserver-utils xdotool ```
> 
> ### Install openbox and chromium
> 
> ```bash sudo apt install -y --no-install-recommends openbox
> chromium-browser ```
> 
> ### Install mesa drivers for hw acceleration
> 
> ```bash sudo apt install -y libgles2-mesa mesa-utils libsdl2-dev ```
> 
> ### Edit  `/etc/xdg/openbox/autostart`  as root, and add the following content
> 
> /etc/xdg/openbox/autostart
> 
> `xset -dpms      # turn off display power management system xset s
> noblank  # turn off screen blanking xset s off      # turn off the
> screen saver
> 
> # Set manual resolution for X
> # xrandr --output HDMI-1 --mode 1280x720 --rate 30
> 
> # Prevent chromium crash error popups sed -i 's/"exited_cleanly":false/"exited_cleanly":true/'
> ~/.config/chromium/'Local State' sed -i
> 's/"exited_cleanly":false/"exited_cleanly":true/;
> s/"exit_type":"[^"]\+"/"exit_type":"Normal"/'
> ~/.config/chromium/Default/Preferences
> 
> # Run chromium with the KIOSK_URL env variable chromium-browser --noerrdialogs \   --disable-infobars \   --kiosk $KIOSK_URL \   --check-for-update-interval=31536000 \   --ignore-gpu-blacklist \   --use-gl=egl \   --enable-native-gpu-memory-buffers \   --enable-accelerated-2d-canvas \   --force-gpu-rasterization \   --cast-app-background-color=000000ff \   --default-background-color=000000ff   # --disable-gpu-compositing \  # Do not disable gpu compositing. Canvas effects are smoother this way`
> 
> Hint: Shift-Insert to paste into putty+vim in insert mode
> 
> Hint: Use the command  `:set`  paste and  `:set nopaste`  within vim,
> if auto-formatting is a problem when pasting.
> 
> ### Edit  `/etc/xdg/openbox/environment`  as root, and add the following
> 
> /etc/xdg/openbox/environment
> 
> `export KIOSK_URL=http://localhost:3530`
> 
> This will be the URL that will be opened when the RPi boots up.
> 
> ### Edit/append to  `~/.bash_profile`
> 
> ~/.bash_profile
> 
> `# Start X server on boot [[ -z $DISPLAY && $XDG_VTNR -eq 1 ]] &&
> startx -- -nocursor`
> 
> ### Reboot
> 
> ```bash sudo reboot ```
> 
> If X server gives an error and chromium doesn’t start, try setting a
> screen resolution in  `sudo raspi-config`  or changing the GL driver.
> FakeKMS is preferred.
