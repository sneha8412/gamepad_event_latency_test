// Stores which gamepad index is currently active.
let gamepadIndex = null;

// Stores previous input state so you can compare what has changed.
let lastState = {
  buttons: [],
  axes: [],
  touches: []
};

// Stores performance.now() timestamps for when a particular
// input was first detected in each method — used to calculate latency difference.
let pollTimestamps = {
  buttons: {},
  axes: {},
  touches: {}
};
let eventTimestamps = {
  buttons: {},
  axes: {},
  touches: {}
};

// Latency Stastistics
const latencyStats = {
  buttons: [],
  axes: [],
  touches: []
};

function updateLatencyStats(type, delta) {
  if (!latencyStats[type]) return;
  latencyStats[type].push(delta);
}

// Checks if the gamepad’s name contains any of a list of phrases 
// (like "Xbox", "Wireless"), case-insensitively.
function containsAnyPhraseCI(text, phrases) {
  const lowerText = text.toLowerCase();
  return phrases.some(phrase => lowerText.includes(phrase.toLowerCase()));
}

// Calculates latency delta (positive = event is faster), logs result to console and UI.
// Deletes those timestamps to prevent repeated logs for same input.
function logComparison(type, index) {
  const pollTime = pollTimestamps[type][index];
  const eventTime = eventTimestamps[type][index];

  if (pollTime && eventTime) {
    const delta = pollTime - eventTime;
    const absDelta = Math.abs(delta).toFixed(2);
    const faster = delta > 0 ? "Event" : "Polling";
    const line = `[${type} ${index}] ${faster} was faster by ${absDelta} ms`;

    console.log(line);
    const output = document.getElementById("comparisonOutput");
    if (output) output.textContent += line + "\n";

    // Clean up to avoid re-logging same change
    delete pollTimestamps[type][index];
    delete eventTimestamps[type][index];
  }
}

//For stats
// function logComparison(type, index) {
//   const pollTime = pollTimestamps[type][index];
//   const eventTime = eventTimestamps[type][index];
//   if (pollTime && eventTime) {
//     const delta = pollTime - eventTime; // Positive = event is faster

//     latencyStats[type].push(delta);

//     const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
//     const stddev = (arr) => {
//       const m = mean(arr);
//       return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);
//     };

//     const output = document.getElementById("comparisonOutput");
//     if (output) {
//       output.textContent +=
//         `${type.toUpperCase()}[${index}] latency Δ: ${delta.toFixed(2)}ms\n` +
//         `→ avg: ${mean(latencyStats[type]).toFixed(2)}ms, stddev: ${stddev(latencyStats[type]).toFixed(2)}ms\n\n`;
//     }

//     delete pollTimestamps[type][index];
//     delete eventTimestamps[type][index];
//   }
// }

window.addEventListener("gamepadconnected", (event) => {
  if (containsAnyPhraseCI(event.gamepad.id, ["Xbox", "Wireless"])) {
    gamepadIndex = event.gamepad.index;
    console.log(`Gamepad connected at index ${gamepadIndex}: ${event.gamepad.id}`);
  }
});

window.addEventListener("gamepadrawinputchanged", (event) => {
  const snapshot = event.gamepadSnapshot;
  if (containsAnyPhraseCI(snapshot.id, ["Xbox", "Wireless"])) {
    gamepadIndex = snapshot.index;

    // Saves timestamps for changed buttons, axes, and touches.
    // Triggers logComparison(...) to compare with polling timestamps.
    event.buttonsPressed.forEach((i) => {
      eventTimestamps.buttons[i] = performance.now();
      logComparison("buttons", i);
    });

    event.axesChanged.forEach((i) => {
      eventTimestamps.axes[i] = performance.now();
      logComparison("axes", i);
    });

    event.touchesDown.forEach((i) => {
      eventTimestamps.touches[i] = performance.now();
      logComparison("touches", i);
    });
    event.touchesUp.forEach((i) => {
      eventTimestamps.touches[i] = performance.now();
      logComparison("touches", i);
    });

    const payload = {
      id: snapshot.id,
      index: snapshot.index,
      axesChanged: event.axesChanged,
      buttonsPressed: event.buttonsPressed,
      buttonsReleased: event.buttonsReleased,
      touchesChanged: event.touchesChanged,
      touchesDown: event.touchesDown,
      touchesUp: event.touchesUp,
    };

    const rawOutput = document.getElementById("rawEventOutput");
    if (rawOutput) {
      rawOutput.textContent = "Event payload:\n" + JSON.stringify(payload, null, 2);
    }
  }
});

window.addEventListener("gamepaddisconnected", (event) => {
  console.log("Gamepad disconnected");
  gamepadIndex = null;
  const rawOutput = document.getElementById("rawEventOutput");
  if (rawOutput) rawOutput.textContent = "";
  const comparisonOutput = document.getElementById("comparisonOutput");
  if (comparisonOutput) comparisonOutput.textContent += "Gamepad disconnected\n";
});

// POLLING 
function updateGamepad() {
  const output = document.getElementById("output");
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

  if (gamepadIndex !== null && gamepads[gamepadIndex]) {
    const gp = gamepads[gamepadIndex];

    let log = `Gamepad: ${gp.id}\n\nButtons:\n`;

    gp.buttons.forEach((btn, i) => {
      log += `Button ${i}: ${btn.pressed ? "Pressed" : "Released"}\n`;
      if (btn.pressed && !lastState.buttons[i]) {
        pollTimestamps.buttons[i] = performance.now();
        logComparison("buttons", i);
      }
      lastState.buttons[i] = btn.pressed;
    });

    log += "\nAxes:\n";
    gp.axes.forEach((axis, i) => {
      log += `Axis ${i}: ${axis.toFixed(2)}\n`;
      const last = lastState.axes[i] ?? 0;
      if (Math.abs(axis - last) > 0.01) {
        pollTimestamps.axes[i] = performance.now();
        logComparison("axes", i);
      }
      lastState.axes[i] = axis;
    });

    if (gp.touches) {
      log += "\nTouches:\n";
      gp.touches.forEach((touch, i) => {
        const active = touch.pressed;
        log += `Touch ${i}: ${active ? "Down" : "Up"}\n`;
        if (active !== (lastState.touches[i] ?? false)) {
          pollTimestamps.touches[i] = performance.now();
          logComparison("touches", i);
        }
        lastState.touches[i] = active;
      });
    }

    output.textContent = log;
  }

  requestAnimationFrame(updateGamepad);
}

requestAnimationFrame(updateGamepad);
