const KEYBOARD_LAYOUT = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
let secretWord = "";
let currentGuess = "";
let guesses = [];
let isGameOver = false;
let isAnimating = false;
let lastKey = "";

const FALLBACK_WORDS = ["chips", "salty", "crisp", "tasty", "snack", "party", "lunch", "crunch"];

document.addEventListener('DOMContentLoaded', initGame);
document.addEventListener('keydown', handleKeydown);

async function initGame() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('changelog-overlay').style.display = 'none';
    document.getElementById('board-container').innerHTML = '';
    document.getElementById('keyboard').innerHTML = '';
    document.getElementById('give-up-btn').style.display = 'block';
    
    currentGuess = "";
    guesses = [];
    isGameOver = true;
    isAnimating = false;
    lastKey = "";

    buildBoard();
    buildKeyboard();

    try {
        const res = await fetch('https://random-word-api.herokuapp.com/word?length=5');
        const data = await res.json();
        secretWord = data[0].toLowerCase();
    } catch (e) {
        secretWord = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
    }
    isGameOver = false;
}

async function handlePlayAgain() {
    document.getElementById('modal-overlay').style.display = 'none';
    
    const contents = document.querySelectorAll('.tile-content');
    
    if (contents.length > 0) {
        const promises = Array.from(contents).map(content => {
            const delay = Math.random() * 0.4;
            content.style.animationDelay = `${delay}s`;
            content.classList.add('fall');
            return new Promise(resolve => setTimeout(resolve, 1200 + (delay * 1000)));
        });
        await Promise.all(promises);
    }
    
    initGame();
}

function buildBoard() {
    const container = document.getElementById('board-container');
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.id = `row-${i}`;
        for (let j = 0; j < 5; j++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = `tile-${i}-${j}`;
            
            const content = document.createElement('div');
            content.className = 'tile-content';
            content.id = `tile-content-${i}-${j}`;
            
            tile.appendChild(content);
            row.appendChild(tile);
        }
        container.appendChild(row);
    }
}

function buildKeyboard() {
    const container = document.getElementById('keyboard');
    KEYBOARD_LAYOUT.forEach((rowStr, idx) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        if (idx === 2) addKey(rowDiv, 'Enter', true);
        rowStr.split('').forEach(char => addKey(rowDiv, char));
        if (idx === 2) addKey(rowDiv, 'Backspace', true);
        container.appendChild(rowDiv);
    });
}

function addKey(container, key, isBig = false) {
    const btn = document.createElement('button');
    btn.className = isBig ? 'key big' : 'key';
    if (key === 'Backspace') {
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 12 11.41 6.41 17 5 15.59 10.59 10 5 4.41 6.41 3 12 8.59 17.59 3 19 4.41 13.41 10 19 15.59z"/></svg>';
    } else {
        btn.textContent = key;
    }
    btn.setAttribute('data-key', key.toLowerCase());
    btn.onclick = () => handleInput(key);
    container.appendChild(btn);
}

function handleKeydown(e) {
    if (e.key === '7' && lastKey === '6') {
        showToast("SECRET: " + secretWord.toUpperCase());
    }

    if (e.key === '1' && lastKey === '4') {
        const newWord = prompt("Enter new 5 letter word:");
        if (newWord && newWord.length === 5 && /^[a-zA-Z]+$/.test(newWord)) {
            secretWord = newWord.toLowerCase();
            showToast("Word Changed to " + secretWord.toUpperCase());
        } else {
            showToast("Invalid word");
        }
    }

    if (e.key === '1' && lastKey === '2') {
        const p = prompt("Set Games Played:");
        const w = prompt("Set Wins:");
        if (p !== null && w !== null) {
            localStorage.setItem('chipsPlayed', p);
            localStorage.setItem('chipsWins', w);
            document.getElementById('stat-played').innerText = p;
            document.getElementById('stat-win').innerText = w;
            const pct = parseInt(p) > 0 ? Math.round((parseInt(w) / parseInt(p)) * 100) : 0;
            document.getElementById('stat-ratio').innerText = pct + "%";
            showToast("Stats Updated");
        }
    }

    lastKey = e.key;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    handleInput(e.key);
}

function handleInput(key) {
    if (isGameOver || isAnimating) return;
    key = key.toLowerCase();

    if (key === 'backspace') {
        if (currentGuess.length > 0) {
            currentGuess = currentGuess.slice(0, -1);
            updateCurrentRow();
        }
    } else if (key === 'enter') {
        if (currentGuess.length !== 5) {
            shakeRow();
            showToast("Not enough letters");
            return;
        }
        submitGuess();
    } else if (/^[a-z]$/.test(key)) {
        if (currentGuess.length < 5) {
            currentGuess += key;
            updateCurrentRow();
        }
    }
}

function updateCurrentRow() {
    const rowIdx = guesses.length;
    for (let i = 0; i < 5; i++) {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        const content = document.getElementById(`tile-content-${rowIdx}-${i}`);
        content.textContent = currentGuess[i] || '';
        tile.setAttribute('data-state', currentGuess[i] ? 'active' : 'empty');
    }
}

function shakeRow() {
    const row = document.getElementById(`row-${guesses.length}`);
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
}

function submitGuess() {
    isAnimating = true;
    const guess = currentGuess;
    const rowIdx = guesses.length;
    const solutionChars = secretWord.split('');
    const guessChars = guess.split('');
    const statuses = Array(5).fill('absent');

    guessChars.forEach((char, i) => {
        if (char === solutionChars[i]) {
            statuses[i] = 'correct';
            solutionChars[i] = null;
            guessChars[i] = null;
        }
    });

    guessChars.forEach((char, i) => {
        if (char && solutionChars.includes(char)) {
            statuses[i] = 'present';
            solutionChars[solutionChars.indexOf(char)] = null;
        }
    });

    statuses.forEach((status, i) => {
        setTimeout(() => {
            const tile = document.getElementById(`tile-${rowIdx}-${i}`);
            tile.classList.add('flip');
            setTimeout(() => {
                tile.setAttribute('data-state', status);
                updateKeyColor(guess[i], status);
            }, 250);
        }, i * 250);
    });

    setTimeout(() => {
        guesses.push(guess);
        currentGuess = "";
        isAnimating = false;

        if (guess === secretWord) {
            handleWin(rowIdx);
        } else if (guesses.length === 6) {
            handleLoss();
        }
    }, 5 * 250 + 300);
}

function updateKeyColor(char, status) {
    const keyBtn = document.querySelector(`.key[data-key='${char}']`);
    if (!keyBtn) return;
    const current = keyBtn.getAttribute('data-state');
    if (current === 'correct') return;
    if (status === 'correct') {
        keyBtn.setAttribute('data-state', 'correct');
    } else if (status === 'present' && current !== 'correct') {
        keyBtn.setAttribute('data-state', 'present');
    } else if (status === 'absent' && current !== 'present' && current !== 'correct') {
        keyBtn.setAttribute('data-state', 'absent');
    }
}

function handleWin(rowIdx) {
    isGameOver = true;
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const tile = document.getElementById(`tile-${rowIdx}-${i}`);
            tile.classList.add('bounce');
        }, i * 100);
    }
    showToast("YOU WON!");
    setTimeout(() => showModal(true), 1500);
}

function handleLoss() {
    isGameOver = true;
    showToast("YOU LOST!");
    setTimeout(() => showModal(false), 1000);
}

function handleGiveUp() {
    if (isGameOver || isAnimating) return;
    isGameOver = true;
    showToast("You gave up!");
    setTimeout(() => showModal(false, true), 1000);
}

function resetStats() {
    localStorage.setItem('chipsPlayed', '0');
    localStorage.setItem('chipsWins', '0');
    document.getElementById('stat-played').innerText = '0';
    document.getElementById('stat-win').innerText = '0';
    document.getElementById('stat-ratio').innerText = '0%';
    showToast("Stats Reset!");
}

function showModal(isWin, isGiveUp = false) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const wordSpan = document.getElementById('word-reveal');
    
    let played = parseInt(localStorage.getItem('chipsPlayed') || '0');
    let wins = parseInt(localStorage.getItem('chipsWins') || '0');

    if (!isGiveUp) {
        played++;
        if (isWin) wins++;
        localStorage.setItem('chipsPlayed', played);
        localStorage.setItem('chipsWins', wins);
    }

    let winPct = played > 0 ? Math.round((wins / played) * 100) : 0;

    document.getElementById('stat-played').innerText = played;
    document.getElementById('stat-win').innerText = wins;
    document.getElementById('stat-ratio').innerText = winPct + "%";

    if (isGiveUp) {
        title.innerText = "GAVE UP";
        title.className = "modal-header giveup";
    } else {
        title.innerText = isWin ? "YOU WON!" : "GAME OVER";
        title.className = isWin ? "modal-header win" : "modal-header loss";
    }
    
    wordSpan.innerText = secretWord.toUpperCase();
    overlay.style.display = 'flex';
}

function toggleChangelog() {
    const overlay = document.getElementById('changelog-overlay');
    overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerText = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    }, 2000);
}


window.handlePlayAgain = handlePlayAgain;
window.handleGiveUp = handleGiveUp;
window.resetStats = resetStats;
window.toggleChangelog = toggleChangelog;
