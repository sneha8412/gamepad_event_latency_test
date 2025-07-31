// Both polling and event store { timestamp: gamepad.timestamp, perfNow: performance.now() } 
// for each input index.
// logComparison only compares latencies when timestamps match exactly.
// Latency difference (in ms) and which method was faster is logged in console and shown 
// in the UI element with ID "comparisonOutput".
// Old timestamp entries are deleted after comparison to avoid duplicate logs.

// Stores which gamepad index is currently active.
let gamepadIndex = null;

// Stores previous input state so you can compare what has changed.
let lastState = {
  buttons: [],
  axes: [],
  touches: []
};

// Stores timestamps for when input was first detected in each method, keyed by input index.
// Each entry is an object: { timestamp: gamepad.timestamp, perfNow: performance.now() }
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

// For future optimizations if needed.
const missedComparisons = {
  buttons: 0,
  axes: 0,
  touches: 0
};

// Latency Statistics (optional, currently unused)
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

// Compares poll and event timestamps for a specific input index and type,
// but only if the snapshot timestamp matches.
function logComparison(type, index) {
  const pollEntry = pollTimestamps[type][index];
  const eventEntry = eventTimestamps[type][index];

  if (pollEntry && eventEntry) {
    if (pollEntry.timestamp === eventEntry.timestamp) {
      // Calculate latency difference
      const delta = pollEntry.perfNow - eventEntry.perfNow;
      const absDelta = Math.abs(delta).toFixed(2);
      const faster = delta > 0 ? "Event" : "Polling";
      const line = `[${type} ${index}] ${faster} was faster by ${absDelta} ms (timestamp: ${pollEntry.timestamp})`;

      console.log(line);
      const output = document.getElementById("comparisonOutput");
      if (output) output.textContent += line + "\n";

      // Optionally update latency stats (not active)
      // updateLatencyStats(type, delta);

      // Clean up to avoid repeated logs for the same input change
      delete pollTimestamps[type][index];
      delete eventTimestamps[type][index];
    } else {
      // Snapshot timestamps don't match; skip comparison and wait for matching pair
      // Polling and event timestamps should usually align within a few milliseconds.
    }
  }
}

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
    const now = performance.now();

    event.buttonsPressed.forEach((i) => {
      eventTimestamps.buttons[i] = { timestamp: snapshot.timestamp, perfNow: now };
      logComparison("buttons", i);
    });

    event.axesChanged.forEach((i) => {
      eventTimestamps.axes[i] = { timestamp: snapshot.timestamp, perfNow: now };
      logComparison("axes", i);
    });

    event.touchesChanged.forEach((i) => {
      eventTimestamps.touches[i] = { timestamp: snapshot.timestamp, perfNow: now };
      logComparison("touches", i);
    });

    const payload = {
      id: snapshot.id,
      index: snapshot.index,
      axesChanged: event.axesChanged,
      buttonsPressed: event.buttonsPressed,
      buttonsReleased: event.buttonsReleased,
      touchesChanged: event.touchesChanged,
      timestamp: snapshot.timestamp,
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
    const now = performance.now();

    let log = `Gamepad: ${gp.id}\nGamepad timestamp: ${gp.timestamp}\n\nButtons:\n`;

    gp.buttons.forEach((btn, i) => {
      log += `Button ${i}: ${btn.pressed ? "Pressed" : "Released"}\n`;
      if (btn.pressed && !lastState.buttons[i]) {
        pollTimestamps.buttons[i] = { timestamp: gp.timestamp, perfNow: now };
        logComparison("buttons", i);
      }
      lastState.buttons[i] = btn.pressed;
    });

    log += "\nAxes:\n";
    gp.axes.forEach((axis, i) => {
      log += `Axis ${i}: ${axis.toFixed(2)}\n`;
      const last = lastState.axes[i] ?? 0;
      if (Math.abs(axis - last) > 0.05) {
        pollTimestamps.axes[i] = { timestamp: gp.timestamp, perfNow: now };
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
          pollTimestamps.touches[i] = { timestamp: gp.timestamp, perfNow: now };
          logComparison("touches", i);
        }
        lastState.touches[i] = active;
      });
    }

    output.textContent = log;
  }

  requestAnimationFrame(updateGamepad);
}

// Start the polling loop
requestAnimationFrame(updateGamepad);
