var DDJ = new components.ComponentContainer();

DDJ.init = function (id, debugging) {
    DDJ.deckA = new DDJ.Deck(1, 0);
    DDJ.deckB = new DDJ.Deck(2, 1);
    DDJ.deckC = new DDJ.Deck(3, 2);
    DDJ.deckD = new DDJ.Deck(4, 3);


}

DDJ.shutdown = function () {
    // send MIDI messages to turn off the lights of the controller
};

// Implement a constructor for a custom Deck object specific to the controller
DDJ.Deck = function (deckNumber, midiChannel) {
    // Call the generic Deck constructor to setup the currentDeck and deckNumbers properties, using Function.prototype.call to assign the custom Deck being constructed to 'this' in the context of the generic components.Deck constructor https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call
    components.Deck.call(this, deckNumber);

    const channel = '[Channel' + (deckNumber) + ']';

    this.playButton = new components.PlayButton([0x90 + midiChannel, 0x0B]);
    this.cueButton = new components.CueButton([0x90 + midiChannel, 0x0C]);
    this.syncButton = new components.SyncButton([0x96, 0x58 + midiChannel]);
    this.syncMaster = new components.Button({
        midi: [0x96, 0x5C + midiChannel],
        group: channel,
        key: 'sync_leader',
        type: components.Button.prototype.types.toggle,
    });

    this.keylock = new components.Button({
        midi: [0x90 + midiChannel, 0x1A],
        group: channel,
        key: 'keylock',
        type: components.Button.prototype.types.toggle,
    });
    this.pflButton = new components.Button({
        midi: [0x96, 0x54 + midiChannel],
        group: channel,
        key: 'pfl',
        type: components.Button.prototype.types.toggle,
    });
    this.loopInButton = new components.Button({
        midi: [0x90 + midiChannel, 0x10],
        group: channel,
        key: 'loop_in',
        type: components.Button.prototype.types.toggle,
        on: 0x7F,
        off: 0x00,
    });
    this.loopOutButton = new components.Button({
        midi: [0x90 + midiChannel, 0x11],
        group: channel,
        key: 'loop_out',
        type: components.Button.prototype.types.toggle,
        on: 0x7F,
        off: 0x00,
    });

    this.autoLoopLength = function (_, __, value, ___, ____) {
        const currentValue = engine.getParameter(channel, "beatloop_size");
        const nextValue = value === 1 ? currentValue * 2 : currentValue / 2;
        if (nextValue >= 0.03125 && nextValue <= 512) {
            engine.setParameter(channel, "beatloop_size", nextValue);
        }
    };

    this.hotcues = [];
    for (let i = 1; i <= 4; i++) {
        this.hotcues[i] = new components.HotcueButton({
            midi: [0x90 + midiChannel, 0x2E + i - 1],
            number: i,
        });
    }
    for (let i = 5; i <= 8; i++) {
        this.hotcues[i] = new components.HotcueButton({
            midi: [0x90 + midiChannel, 0x5F + i - 1],
            number: i,
        });
    }

    this.fxAssign1 = new components.Button({
        midi: [0x96, 0x4C + midiChannel],
        group: '[EffectRack1_EffectUnit1]',
        key: `group_${channel}_enable`,
        type: components.Button.prototype.types.toggle,
        on: 0x7F,
        off: 0x00,
    });
    this.fxAssign2 = new components.Button({
        midi: [0x96, 0x50 + midiChannel],
        group: '[EffectRack1_EffectUnit2]',
        key: `group_${channel}_enable`,
        type: components.Button.prototype.types.toggle,
        on: 0x7F,
        off: 0x00,
    });

    this.tempo = new components.Pot({
        group: channel,
        inKey: 'rate',
        invert: true,
    });

    this.pitchWheel = new components.JogWheelBasic({
        deck: deckNumber, // whatever deck this jog wheel controls
        wheelResolution: 360,
        alpha: 1 / 8, // alpha-filter
        beta: 1 / 8 / 32, // optional
        rpm: 33 + 1 / 3, // optional
    });

    this.scratchWheel = new components.JogWheelBasic({
        deck: deckNumber, // whatever deck this jog wheel controls
        wheelResolution: 360,
        alpha: 1 / 8, // alpha-filter
        beta: 1 / 8 / 32, // optional
        rpm: 33 + 1 / 3, // optional
    });

    // Set the group properties of the above Components and connect their output callback functions. Without this, the group property for each Component would have to be specified to its constructor.
    this.reconnectComponents(function (c) {
        if (c.group === undefined) {
            // 'this' inside a function passed to reconnectComponents refers to the ComponentContainer so 'this' refers to the custom Deck object being constructed
            c.group = this.currentDeck;
        }
    });
    // when called with JavaScript's 'new' keyword, a constructor function implicitly returns 'this'
};

// Give the custom Deck all the methods of the generic Deck in the Components library
DDJ.Deck.prototype = new components.Deck();