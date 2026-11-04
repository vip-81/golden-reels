(function () {
  "use strict";

  var STORAGE_KEY = "golden-reels:balance:v1";
  var START_BALANCE = 1000;

  var SYMBOLS = {
    seven: {
      name: "seven",
      plural: "sevens",
      html: '<span class="glyph glyph-seven">7</span>'
    },
    diamond: {
      name: "diamond",
      plural: "diamonds",
      html: '<span class="glyph glyph-diamond" aria-hidden="true"></span>'
    },
    star: {
      name: "star",
      plural: "stars",
      html: '<span class="glyph glyph-star">★</span>'
    },
    bell: {
      name: "bell",
      plural: "bells",
      html: '<span class="glyph glyph-bell"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path fill="currentColor" d="M32 5.5c-2.8 0-5 2.2-5 5v2.2C18.2 15.9 13 24.2 13 35v8l-5 5.2V52h48v-3.8l-5-5.2v-8c0-10.8-5.2-19.1-14-22.3v-2.2c0-2.8-2.2-5-5-5Z"/><path fill="#6f4507" d="M25.5 53.2h13a6.5 6.5 0 0 1-13 0Z"/><path fill="none" stroke="#fff0bd" stroke-width="1.5" stroke-linecap="round" d="M18 35.5c0-8.1 3.5-14.5 9.4-17.7" opacity=".55"/></svg></span>'
    },
    lemon: {
      name: "lemon",
      plural: "lemons",
      html: '<span class="glyph glyph-lemon" aria-hidden="true"></span>'
    },
    cherry: {
      name: "cherry",
      plural: "cherries",
      html: '<span class="glyph glyph-cherry" aria-hidden="true"><span class="stem"></span><span class="fruit fruit-a"></span><span class="fruit fruit-b"></span></span>'
    }
  };

  var SYMBOL_IDS = ["seven", "diamond", "star", "bell", "lemon", "cherry"];
  var PAYTABLE = {
    seven: 80,
    diamond: 40,
    star: 25,
    bell: 15,
    lemon: 12,
    cherry: 8
  };

  var balanceEl = document.getElementById("balance");
  var resetBtn = document.getElementById("reset-balance");
  var slotBet = document.getElementById("slot-bet");
  var spinBtn = document.getElementById("spin");
  var slotStatus = document.getElementById("slot-status");
  var reels = Array.prototype.slice.call(document.querySelectorAll(".reel"));
  var slotMachine = document.querySelector(".slot-machine");

  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[role="tabpanel"]'));

  var bjBet = document.getElementById("bj-bet");
  var bjDeal = document.getElementById("bj-deal");
  var bjHit = document.getElementById("bj-hit");
  var bjStand = document.getElementById("bj-stand");
  var bjDouble = document.getElementById("bj-double");
  var bjStatus = document.getElementById("bj-status");
  var dealerCardsEl = document.getElementById("dealer-cards");
  var playerCardsEl = document.getElementById("player-cards");
  var dealerTotalEl = document.getElementById("dealer-total");
  var playerTotalEl = document.getElementById("player-total");

  var balance = readBalance();
  var spinning = false;
  var spinTimers = [];
  var spinInterval = null;
  var reducedMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var bj = {
    state: "idle",
    player: [],
    dealer: [],
    bet: 0,
    hideHole: true
  };

  var SUITS = [
    { symbol: "♠", name: "spades", red: false },
    { symbol: "♥", name: "hearts", red: true },
    { symbol: "♦", name: "diamonds", red: true },
    { symbol: "♣", name: "clubs", red: false }
  ];

  var RANKS = [
    { rank: 2, label: "2" },
    { rank: 3, label: "3" },
    { rank: 4, label: "4" },
    { rank: 5, label: "5" },
    { rank: 6, label: "6" },
    { rank: 7, label: "7" },
    { rank: 8, label: "8" },
    { rank: 9, label: "9" },
    { rank: 10, label: "10" },
    { rank: 11, label: "J" },
    { rank: 12, label: "Q" },
    { rank: 13, label: "K" },
    { rank: 14, label: "A" }
  ];

  var shoe = [];

  function format(number) {
    return new Intl.NumberFormat("en-US").format(number);
  }

  function readBalance() {
    try {
      var stored = Number(window.localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= 0) {
        return Math.floor(stored);
      }
    } catch (error) {
      /* localStorage can be unavailable in private or embedded contexts. */
    }
    return START_BALANCE;
  }

  function setBalance(next) {
    balance = Math.max(0, Math.floor(next));
    balanceEl.textContent = format(balance);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(balance));
    } catch (error) {
      /* The game still works without persistence. */
    }
    updateControls();
  }

  function setStatus(element, message, tone) {
    element.textContent = message;
    element.classList.toggle("is-win", tone === "win");
    element.classList.toggle("is-loss", tone === "loss");
  }

  function setReel(element, symbolId) {
    var symbol = SYMBOLS[symbolId];
    element.innerHTML = '<span class="sym" aria-hidden="true">' + symbol.html + "</span>";
    element.setAttribute("data-symbol", symbolId);
  }

  function randomInt(max) {
    if (max <= 1) {
      return 0;
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var buffer = new Uint32Array(1);
      var range = 4294967296;
      var limit = range - (range % max);
      do {
        window.crypto.getRandomValues(buffer);
      } while (buffer[0] >= limit);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function randomSymbol() {
    return SYMBOL_IDS[randomInt(SYMBOL_IDS.length)];
  }

  function updateControls() {
    var bet = Number(slotBet.value);
    var cannotSpin = spinning || balance < bet;

    spinBtn.setAttribute("aria-disabled", String(cannotSpin));
    spinBtn.classList.toggle("is-busy", spinning);

    var bjBetValue = Number(bjBet.value);
    var handActive = bj.state === "player" || bj.state === "dealer";
    var canDeal = !handActive && balance >= bjBetValue;

    bjBet.disabled = handActive;
    bjDeal.setAttribute("aria-disabled", String(!canDeal));
    bjDeal.textContent = bj.state === "over" ? "New hand" : "Deal hand";

    var playerTurn = bj.state === "player";
    bjHit.setAttribute("aria-disabled", String(!playerTurn));
    bjStand.setAttribute("aria-disabled", String(!playerTurn));

    var canDouble = playerTurn &&
      bj.player.length === 2 &&
      handValue(bj.player).total < 21 &&
      balance >= bj.bet;

    bjDouble.setAttribute("aria-disabled", String(!canDouble));
  }

  function clearSpinTimers() {
    spinTimers.forEach(function (timer) {
      window.clearTimeout(timer);
    });
    spinTimers = [];
    if (spinInterval) {
      window.clearInterval(spinInterval);
      spinInterval = null;
    }
  }

  function updateReelStates(isSpinning) {
    reels.forEach(function (reel) {
      reel.classList.toggle("is-spinning", isSpinning);
      reel.dataset.spinning = isSpinning ? "true" : "false";
    });
  }

  function finishSpin(finalSymbols, bet) {
    spinning = false;
    updateReelStates(false);
    updateControls();

    var counts = {};
    finalSymbols.forEach(function (symbol) {
      counts[symbol] = (counts[symbol] || 0) + 1;
    });

    var multiplier = 0;
    var winningSymbol = null;

    Object.keys(counts).forEach(function (symbol) {
      if (counts[symbol] === 3) {
        multiplier = PAYTABLE[symbol];
        winningSymbol = symbol;
      }
    });

    if (multiplier === 0 && counts.cherry === 2) {
      multiplier = 1;
      winningSymbol = "cherry";
    }

    var win = bet * multiplier;

    if (win > 0) {
      setBalance(balance + win);
      var label = SYMBOLS[winningSymbol].plural;
      var prefix = multiplier === PAYTABLE.seven ? "Jackpot! " : "";
      var message = multiplier === 1
        ? "Two cherries pay 1×. +" + format(win) + " credits."
        : prefix + "Three " + label + " pay " + multiplier + "×. +" + format(win) + " credits.";
      setStatus(slotStatus, message + " Balance: " + format(balance) + " credits.", "win");
    } else {
      setStatus(slotStatus, "No win this spin. You bet " + format(bet) + " credits. Balance: " + format(balance) + " credits.", "loss");
    }

    if (win > 0 && slotMachine) {
      slotMachine.classList.remove("just-won");
      void slotMachine.offsetWidth;
      slotMachine.classList.add("just-won");
    }
  }

  function spin() {
    if (spinning) {
      return;
    }

    var bet = Number(slotBet.value);
    if (balance < bet) {
      setStatus(slotStatus, "Not enough credits for that bet. Lower the bet or reset your bankroll.", "loss");
      updateControls();
      return;
    }

    spinning = true;
    setBalance(balance - bet);
    setStatus(slotStatus, "Spinning for " + format(bet) + " credits…", "");
    slotBet.disabled = true;
    updateControls();
    clearSpinTimers();

    var finalSymbols = [randomSymbol(), randomSymbol(), randomSymbol()];

    if (reducedMotion.matches) {
      reels.forEach(function (reel, index) {
        setReel(reel, finalSymbols[index]);
      });
      finishSpin(finalSymbols, bet);
      slotBet.disabled = false;
      return;
    }

    updateReelStates(true);

    spinInterval = window.setInterval(function () {
      reels.forEach(function (reel) {
        if (reel.dataset.spinning === "true") {
          setReel(reel, randomSymbol());
        }
      });
    }, 70);

    reels.forEach(function (reel, index) {
      spinTimers.push(window.setTimeout(function () {
        reel.dataset.spinning = "false";
        reel.classList.remove("is-spinning");
        setReel(reel, finalSymbols[index]);
      }, 620 + index * 330));
    });

    spinTimers.push(window.setTimeout(function () {
      if (spinInterval) {
        window.clearInterval(spinInterval);
        spinInterval = null;
      }
      slotBet.disabled = false;
      finishSpin(finalSymbols, bet);
    }, 620 + 2 * 330 + 160));
  }

  function resetBankroll() {
    if (spinning) {
      setStatus(slotStatus, "Finish the spin before resetting your bankroll.", "");
      return;
    }
    clearSpinTimers();
    bj = { state: "idle", player: [], dealer: [], bet: 0, hideHole: true };
    setBalance(START_BALANCE);
    setStatus(slotStatus, "Bankroll reset to 1,000 credits.", "win");
    setStatus(bjStatus, "Set a bet and deal. Blackjack pays 3:2; dealer stands on all 17.", "");
    renderBlackjack();
  }

  function buildShoe() {
    var cards = [];
    for (var deck = 0; deck < 6; deck += 1) {
      SUITS.forEach(function (suit) {
        RANKS.forEach(function (rank) {
          cards.push({
            rank: rank.rank,
            label: rank.label,
            suit: suit.symbol,
            suitName: suit.name,
            red: suit.red
          });
        });
      });
    }
    for (var index = cards.length - 1; index > 0; index -= 1) {
      var swap = randomInt(index + 1);
      var temp = cards[index];
      cards[index] = cards[swap];
      cards[swap] = temp;
    }
    shoe = cards;
  }

  function drawCard() {
    if (shoe.length < 20) {
      buildShoe();
    }
    return shoe.pop();
  }

  function handValue(hand) {
    var total = 0;
    var aces = 0;

    hand.forEach(function (card) {
      if (card.rank === 14) {
        aces += 1;
        total += 11;
      } else {
        total += Math.min(card.rank, 10);
      }
    });

    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }

    return { total: total, soft: aces > 0 };
  }

  function isNatural(hand) {
    return hand.length === 2 && handValue(hand).total === 21;
  }

  function makeCard(card, hidden) {
    var element = document.createElement("div");
    element.className = "playing-card" + (card.red ? " is-red" : "") + (hidden ? " is-hidden" : "");
    element.setAttribute("role", "img");

    if (hidden) {
      element.setAttribute("aria-label", "Face-down card");
      return element;
    }

    element.setAttribute("aria-label", card.label + " of " + card.suitName);
    element.innerHTML =
      '<span class="rank" aria-hidden="true">' + card.label + "</span>" +
      '<span class="pip" aria-hidden="true">' + card.suit + "</span>" +
      '<span class="suit" aria-hidden="true">' + card.suit + "</span>";
    return element;
  }

  function renderHand(container, hand, hideIndex) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    hand.forEach(function (card, index) {
      container.appendChild(makeCard(card, index === hideIndex));
    });
  }

  function renderBlackjack() {
    var dealerTotal = handValue(bj.dealer).total;
    var playerTotal = handValue(bj.player).total;

    renderHand(dealerCardsEl, bj.dealer, bj.hideHole ? 1 : -1);
    renderHand(playerCardsEl, bj.player, -1);

    dealerTotalEl.textContent = bj.dealer.length === 0 ? "?" : (bj.hideHole ? "?" : String(dealerTotal));
    playerTotalEl.textContent = bj.player.length === 0 ? "0" : String(playerTotal);
    dealerCardsEl.setAttribute("aria-label", bj.hideHole ? "Dealer hand, one card face down" : "Dealer hand");
    playerCardsEl.setAttribute("aria-label", "Your hand, total " + playerTotal);

    updateControls();
  }

  function setBlackjackStatus(message, tone) {
    setStatus(bjStatus, message, tone);
  }

  function dealBlackjack() {
    if (bj.state === "player" || bj.state === "dealer") {
      return;
    }

    var bet = Number(bjBet.value);
    if (balance < bet) {
      setBlackjackStatus("Not enough credits for that bet. Lower the bet or reset your bankroll.", "loss");
      updateControls();
      return;
    }

    setBalance(balance - bet);
    bj = {
      state: "player",
      player: [drawCard(), drawCard()],
      dealer: [drawCard(), drawCard()],
      bet: bet,
      hideHole: true
    };
    renderBlackjack();

    var playerTotal = handValue(bj.player).total;
    var dealerUp = bj.dealer[0];
    setBlackjackStatus("Your move. You have " + playerTotal + "; dealer shows " + dealerUp.label + " of " + dealerUp.suitName + ".", "");

    if (playerTotal === 21) {
      setBlackjackStatus("Blackjack! Revealing the dealer's hand.", "win");
      window.setTimeout(function () {
        if (bj.state === "player") {
          standBlackjack();
        }
      }, 520);
    }
  }

  function hitBlackjack() {
    if (bj.state !== "player") {
      return;
    }

    bj.player.push(drawCard());
    var total = handValue(bj.player).total;
    renderBlackjack();

    if (total > 21) {
      bj.state = "over";
      bj.hideHole = false;
      renderBlackjack();
      setBlackjackStatus("Bust with " + total + ". Dealer wins this hand. Balance: " + format(balance) + " credits.", "loss");
    } else if (total === 21) {
      setBlackjackStatus("21. Standing automatically.", "win");
      window.setTimeout(function () {
        if (bj.state === "player") {
          standBlackjack();
        }
      }, 480);
    } else {
      setBlackjackStatus("Hit. Your total is " + total + ". Hit or stand?", "");
    }
  }

  function doubleBlackjack() {
    if (bj.state !== "player" || bj.player.length !== 2 || handValue(bj.player).total >= 21 || balance < bj.bet) {
      return;
    }

    setBalance(balance - bj.bet);
    bj.bet *= 2;
    bj.player.push(drawCard());
    var total = handValue(bj.player).total;
    renderBlackjack();

    if (total > 21) {
      bj.state = "over";
      bj.hideHole = false;
      renderBlackjack();
      setBlackjackStatus("Doubled, then bust with " + total + ". Dealer wins. Balance: " + format(balance) + " credits.", "loss");
      return;
    }

    setBlackjackStatus("Doubled to " + format(bj.bet) + " credits. One card dealt; the dealer now reveals.", "");
    window.setTimeout(function () {
      if (bj.state === "player") {
        standBlackjack();
      }
    }, 520);
  }

  function standBlackjack() {
    if (bj.state !== "player") {
      return;
    }

    bj.state = "dealer";
    bj.hideHole = false;
    renderBlackjack();
    setBlackjackStatus("Dealer reveals " + handValue(bj.dealer).total + ".", "");
    window.setTimeout(dealerStep, 460);
  }

  function dealerStep() {
    if (bj.state !== "dealer") {
      return;
    }

    var total = handValue(bj.dealer).total;

    if (total < 17) {
      bj.dealer.push(drawCard());
      renderBlackjack();
      setBlackjackStatus("Dealer hits. Showing " + handValue(bj.dealer).total + ".", "");
      window.setTimeout(dealerStep, 460);
      return;
    }

    settleBlackjack();
  }

  function settleBlackjack() {
    bj.state = "over";
    bj.hideHole = false;
    renderBlackjack();

    var playerTotal = handValue(bj.player).total;
    var dealerTotal = handValue(bj.dealer).total;
    var playerNatural = isNatural(bj.player);
    var dealerNatural = isNatural(bj.dealer);
    var payout = 0;
    var message = "";
    var tone = "";

    if (playerTotal > 21) {
      message = "Bust with " + playerTotal + ". Dealer wins.";
      tone = "loss";
    } else if (playerNatural && !dealerNatural) {
      payout = bj.bet + Math.floor(bj.bet * 1.5);
      message = "Blackjack! You beat " + dealerTotal + " and win " + format(payout - bj.bet) + " credits.";
      tone = "win";
    } else if (dealerTotal > 21) {
      payout = bj.bet * 2;
      message = "Dealer busts with " + dealerTotal + ". You win " + format(bj.bet) + " credits.";
      tone = "win";
    } else if (playerTotal > dealerTotal) {
      payout = bj.bet * 2;
      message = "You win " + playerTotal + " to " + dealerTotal + ". +" + format(bj.bet) + " credits.";
      tone = "win";
    } else if (playerTotal < dealerTotal) {
      message = "Dealer wins " + dealerTotal + " to " + playerTotal + ".";
      tone = "loss";
    } else {
      payout = bj.bet;
      message = "Push at " + playerTotal + ". Your " + format(bj.bet) + "-credit stake is returned.";
      tone = "";
    }

    if (payout > 0) {
      setBalance(balance + payout);
    }

    setBlackjackStatus(message + " Balance: " + format(balance) + " credits.", tone);
  }

  function selectTab(index, focusTab) {
    tabs.forEach(function (tab, tabIndex) {
      var selected = tabIndex === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("tabindex", selected ? "0" : "-1");
      if (selected && focusTab) {
        tab.focus();
      }
    });

    panels.forEach(function (panel, panelIndex) {
      panel.hidden = panelIndex !== index;
    });

    if (index === 1) {
      updateControls();
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      selectTab(index, false);
    });

    tab.addEventListener("keydown", function (event) {
      var next = null;
      if (event.key === "ArrowRight") {
        next = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        next = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = tabs.length - 1;
      }

      if (next !== null) {
        event.preventDefault();
        selectTab(next, true);
      }
    });
  });

  spinBtn.addEventListener("click", function () {
    if (spinBtn.getAttribute("aria-disabled") === "true") {
      if (!spinning && balance < Number(slotBet.value)) {
        setStatus(slotStatus, "Not enough credits for that bet. Lower the bet or reset your bankroll.", "loss");
      }
      return;
    }
    spin();
  });

  slotBet.addEventListener("change", updateControls);
  bjBet.addEventListener("change", function () {
    updateControls();
    if (bj.state !== "player" && bj.state !== "dealer" && balance < Number(bjBet.value)) {
      setBlackjackStatus("Not enough credits for that bet. Lower the bet or reset your bankroll.", "loss");
    }
  });

  bjDeal.addEventListener("click", function () {
    if (bjDeal.getAttribute("aria-disabled") === "true") {
      if (balance < Number(bjBet.value)) {
        setBlackjackStatus("Not enough credits for that bet. Lower the bet or reset your bankroll.", "loss");
      }
      return;
    }
    dealBlackjack();
  });

  bjHit.addEventListener("click", function () {
    if (bjHit.getAttribute("aria-disabled") === "true") {
      return;
    }
    hitBlackjack();
  });

  bjStand.addEventListener("click", function () {
    if (bjStand.getAttribute("aria-disabled") === "true") {
      return;
    }
    standBlackjack();
  });

  bjDouble.addEventListener("click", function () {
    if (bjDouble.getAttribute("aria-disabled") === "true") {
      return;
    }
    doubleBlackjack();
  });

  resetBtn.addEventListener("click", resetBankroll);

  reels.forEach(function (reel, index) {
    setReel(reel, ["seven", "diamond", "cherry"][index]);
  });

  buildShoe();
  balanceEl.textContent = format(balance);
  renderBlackjack();
  updateControls();

  window.GoldenReels = {
    get balance() {
      return balance;
    },
    get spinning() {
      return spinning;
    },
    get blackjack() {
      return {
        state: bj.state,
        player: bj.player.map(function (card) { return card.label + card.suit; }),
        dealer: bj.dealer.map(function (card) { return card.label + card.suit; }),
        playerTotal: handValue(bj.player).total,
        dealerTotal: bj.state === "over" ? handValue(bj.dealer).total : null
      };
    },
    spin: spin,
    deal: dealBlackjack,
    hit: hitBlackjack,
    stand: standBlackjack,
    double: doubleBlackjack,
    reset: resetBankroll
  };
})();
