////////////////////////////////////////////////////////////////////////
// JSHint configuration                                               //
////////////////////////////////////////////////////////////////////////
/* global engine                                                      */
/* global script                                                      */
/* global midi                                                        */
/* global bpm                                                         */
/* global components                                                  */
////////////////////////////////////////////////////////////////////////

var DDJ = new components.ComponentContainer();

// If true, the vinyl button activates slip. Vinyl mode is then activated by using shift.
// Allows toggling slip faster, but is counterintuitive.
DDJ.invertVinylSlipButton = false;

// Sets the jogwheels sensitivity. 1 is default, 2 is twice as sensitive, 0.5 is half as sensitive.
DDJ.jogwheelSensitivity = 1.0;

// Sets how much more sensitive the jogwheels get when holding shift.
// Set to 1 to disable jogwheel sensitivity increase when holding shift.
DDJ.jogwheelShiftMultiplier = 100;

DDJ.init = function (id, debugging) {
    DDJ.deckA = new DDJ.Deck(1, 0);
    DDJ.deckB = new DDJ.Deck(2, 1);
    DDJ.deckC = new DDJ.Deck(3, 2);
    DDJ.deckD = new DDJ.Deck(4, 3);

    DDJ.channelGroups = {
        "[Channel1]": 0x00,
        "[Channel2]": 0x01,
        "[Channel3]": 0x02,
        "[Channel4]": 0x03
    };

    DDJ.deckSwitchTable = {
        "[Channel1]": "[Channel1]",
        "[Channel2]": "[Channel2]",
        "[Channel3]": "[Channel3]",
        "[Channel4]": "[Channel4]"
    };

    DDJ.scratchMode = [false, false, false, false];

    DDJ.scratchSettings = {
        // "alpha": 1.0 / 8,
        // "beta": 1.0 / 8 / 32,
        "alpha": 1,
        "beta": 0,
        "jogResolution": 7200 * 20,
        "vinylSpeed": 33 + 1 / 3,
    };

    DDJ.nonPadLeds = {
        "headphoneCue": 0x54,
        "shiftHeadphoneCue": 0x68,
        "cue": 0x0C,
        "shiftCue": 0x48,
        "keyLock": 0x1A,
        "shiftKeyLock": 0x60,
        "play": 0x0B,
        "shiftPlay": 0x47,
        "vinyl": 0x17,
        "shiftVinyl": 0x4E,
        "sync": 0x58,
        "shiftSync": 0x5C
    };
}

DDJ.shutdown = function () { }

DDJ.autoLoopFunc = function (channel, control, value, status, group) {
    var currentValue = engine.getParameter(group, "beatloop_size");
    var nextValue = value === 1 ? currentValue * 2 : currentValue / 2;
    if (nextValue >= 0.03125 && nextValue <= 512) {
        engine.setParameter(group, "beatloop_size", nextValue);
    }
}

DDJ.Deck = function (deckNumbers, midiChannel) {
    components.Deck.call(this, deckNumbers);
    var channel = '[Channel' + (midiChannel + 1) + ']';

    this.playButton = new components.PlayButton([0x90 + midiChannel, 0x0B]);
    this.cueButton = new components.CueButton([0x90 + midiChannel, 0x0C]);
    this.syncButton = new components.SyncButton([0x96, 0x58 + midiChannel]);

    this.keylockButton = new components.Button({
        midi: [0x90 + midiChannel, 0x1A],
        group: channel,
        key: 'keylock',
        type: components.Button.prototype.types.toggle,
        on: 0x7F,
        off: 0x00,
    });
    this.pflButton = new components.Button({
        midi: [0x96, 0x54 + midiChannel],
        group: channel,
        key: 'pfl',
        type: components.Button.prototype.types.toggle,
        on: 0x7F,
        off: 0x00,
    });

    this.hotcues = [];
    for (var i = 1; i <= 4; i++) {
        this.hotcues[i] = new components.HotcueButton({
            midi: [0x90 + midiChannel, 0x2E + i - 1],
            number: i,
        });
    }

    this.loopInButton = new components.Button({
        midi: [0x90 + midiChannel, 0x10],
        group: channel,
        key: 'loop_in',
        on: 0x7F,
        off: 0x00,
    });
    this.loopOutButton = new components.Button({
        midi: [0x90 + midiChannel, 0x11],
        group: channel,
        key: 'loop_out',
        on: 0x7F,
        off: 0x00,
    });

    this.reconnectComponents(function (c) {
        if (c.group === undefined) {
            c.group = this.currentDeck;
        }
    });

}

DDJ.Deck.prototype = new components.Deck();

///////////////////////////////////////////////////////////////
//                        ROTARY SELECTOR                    //
///////////////////////////////////////////////////////////////

DDJ.rotarySelectorChanged = false; // new for DDJ-SB2

DDJ.getRotaryDelta = function (value) {
    var delta = 0x40 - Math.abs(0x40 - value),
        isCounterClockwise = value > 0x40;

    if (isCounterClockwise) {
        delta *= -1;
    }
    return delta;
};

DDJ.rotarySelector = function (channel, control, value, _status) {
    var delta = DDJ.getRotaryDelta(value);
    engine.setValue("[Playlist]", "SelectTrackKnob", delta);

    DDJ.rotarySelectorChanged = true;
};

DDJ.shiftedRotarySelector = function (channel, control, value, _status) {
    var delta = DDJ.getRotaryDelta(value),
        f = (delta > 0 ? "SelectNextPlaylist" : "SelectPrevPlaylist");

    engine.setValue("[Playlist]", f, Math.abs(delta));
};

DDJ.rotarySelectorClick = function (channel, control, value, _status) {
    if (DDJ.rotarySelectorChanged === true) {
        if (value) {
            engine.setValue("[PreviewDeck1]", "LoadSelectedTrackAndPlay", true);
        } else {
            if (DDJ.jumpPreviewEnabled) {
                engine.setValue("[PreviewDeck1]", "playposition", DDJ.jumpPreviewPosition);
            }
            DDJ.rotarySelectorChanged = false;
        }
    } else {
        if (value) {
            engine.setValue("[PreviewDeck1]", "stop", 1);
        } else {
            DDJ.rotarySelectorChanged = true;
        }
    }
};

DDJ.rotarySelectorShiftedClick = function (channel, control, value, _status) {
    if (value) {
        engine.setValue("[Playlist]", "ToggleSelectedSidebarItem", 1);
    }
};

///////////////////////////////////////////////////////////////
//                          JOGWHEELS                        //
///////////////////////////////////////////////////////////////

// The top of the platter that enables/disables scratching
DDJ.jogTouch = function (channel, control, value, status, group) {
    const deckNumber = script.deckFromGroup(group);
    // if ((status & 0xF0) === 0x90) {    // If button down
    if (status === 0x7F) {
        engine.scratchEnable(
            deckNumber,
            DDJ.scratchSettings.jogResolution,
            DDJ.scratchSettings.vinylSpeed,
            DDJ.scratchSettings.alpha,
            DDJ.scratchSettings.beta,
            false
        );
    } else {
        engine.scratchDisable(deckNumber);
    }
}

DDJ.jogMove = function (channel, control, value, status, group) {
    var newValue;
    if (value < 64) {
        newValue = value;
    } else {
        newValue = value - 128;
    }

    const deckNumber = script.deckFromGroup(group);
    if (engine.isScratching(deckNumber)) {
        engine.scratchTick(deckNumber, newValue); // Scratch!
    } else {
        engine.setValue(group, 'jog', newValue); // Pitch bend
    }
}

DDJ.jogRingTick = function (channel, control, value, status, group) {
    DDJ.jogMove(channel, control, value, status, group);
}

DDJ.jogRingTickShift = function (channel, control, value, status, group) {
    DDJ.jogMove(channel, control, value * DDJ.jogwheelShiftMultiplier, status, group);
};

DDJ.jogPlatterTick = function (channel, control, value, status, group) {
    DDJ.jogMove(channel, control, value, status, group);
};

DDJ.jogPlatterTickShift = function (channel, control, value, status, group) {
    DDJ.jogMove(channel, control, value, status * DDJ.jogwheelShiftMultiplier, group);
};

// DDJ.pitchBendFromJog = function (channel, movement) {
//     var group = (typeof channel === "string" ? channel : "[Channel" + channel + 1 + "]");

//     // engine.setValue(group, "jog", movement / 5 * DDJ.jogwheelSensitivity);
//     engine.setValue(group, "jog", 1);
// };

// DDJ.toggleScratch = function (channel, control, value, status, group) {
//     var deck = DDJ.channelGroups[group];
//     if (value) {
//         DDJ.scratchMode[deck] = !DDJ.scratchMode[deck];
//         if (!DDJ.invertVinylSlipButton) {
//             DDJ.nonPadLedControl(deck, DDJ.nonPadLeds.vinyl, DDJ.scratchMode[deck]);
//             DDJ.nonPadLedControl(deck, DDJ.nonPadLeds.shiftVinyl, DDJ.scratchMode[deck]);
//         }
//         if (!DDJ.scratchMode[deck]) {
//             engine.scratchDisable(deck + 1, true);
//         }
//     }
// };

// DDJ.deckConverter = function (group) {
//     var index;

//     if (typeof group === "string") {
//         for (index in DDJ.deckSwitchTable) {
//             if (group === DDJ.deckSwitchTable[index]) {
//                 return DDJ.channelGroups[group];
//             }
//         }
//         return null;
//     }
//     return group;
// };

// DDJ.nonPadLedControl = function (deck, ledNumber, active) {
//     var nonPadLedsBaseChannel = 0x90,
//         midiChannelOffset = PioneerDDJSB2.deckConverter(deck);

//     if (midiChannelOffset !== null) {
//         midi.sendShortMsg(
//             nonPadLedsBaseChannel + midiChannelOffset,
//             ledNumber,
//             active ? 0x7F : 0x00
//         );
//     }
// };