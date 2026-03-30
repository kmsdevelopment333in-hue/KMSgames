const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');

// Resize canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Game state
let score = 0;
let level = 1;
const maxLevel = 5;
const levelThresholds = [0, 500, 1200, 2000, 3000]; // Level 2 now starts at 500 score
const keys = { w: false, a: false, s: false, d: false };
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let isGameOver = false;
let mouseSensitivity = 1.0;

// Touch state
let leftTouch = { id: null, startX: 0, startY: 0, currentX: 0, currentY: 0 };
let rightTouch = { id: null, startX: 0, startY: 0, currentX: 0, currentY: 0 };
const joystickRadius = 50;
let lastShootTime = 0;
const shootInterval = 150;

// Audio Setup (Web Audio API for robust overlapping custom sounds)
let audioCtx = null;
let shootBuffer = null;

// Initialize and resume AudioContext
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Load the custom sound file
        fetch('shoot.mp3')
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                shootBuffer = audioBuffer;
            })
            .catch(e => console.error("Error decoding audio data:", e));
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playShootSound() {
    if (!audioCtx || !shootBuffer) return;

    // Play the loaded buffer
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = shootBuffer;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.3; // Adjust volume here

    sourceNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    sourceNode.start(0);
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (Object.prototype.hasOwnProperty.call(keys, e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = true;
    }
    
    // Space to shoot or restart
    if (e.code === 'Space') {
        if (isGameOver) {
            resetGame();
        } else if (startScreen.style.display === 'none') {
            shoot();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (Object.prototype.hasOwnProperty.call(keys, e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = false;
    }
});

window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
        mouse.x += e.movementX * mouseSensitivity;
        mouse.y += e.movementY * mouseSensitivity;
        mouse.x = Math.max(0, Math.min(canvas.width, mouse.x));
        mouse.y = Math.max(0, Math.min(canvas.height, mouse.y));
    } else {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }
});

window.addEventListener('mousedown', (e) => {
    initAudio();
    
    // Request pointer lock when clicking canvas during gameplay
    if (!isGameOver && startScreen.style.display === 'none') {
        canvas.requestPointerLock();
    }

    if (e.button === 0 && !isGameOver) {
        shoot();
    } else if (isGameOver) {
        // Restart on click if game over
        resetGame();
    }
});

// Touch controls
window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX < canvas.width / 2 && leftTouch.id === null) {
            leftTouch.id = touch.identifier;
            leftTouch.startX = touch.clientX;
            leftTouch.startY = touch.clientY;
            leftTouch.currentX = touch.clientX;
            leftTouch.currentY = touch.clientY;
        } else if (touch.clientX >= canvas.width / 2 && rightTouch.id === null) {
            rightTouch.id = touch.identifier;
            rightTouch.startX = touch.clientX;
            rightTouch.startY = touch.clientY;
            rightTouch.currentX = touch.clientX;
            rightTouch.currentY = touch.clientY;

            if (isGameOver) resetGame();
        }
    }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === leftTouch.id) {
            leftTouch.currentX = touch.clientX;
            leftTouch.currentY = touch.clientY;
        } else if (touch.identifier === rightTouch.id) {
            rightTouch.currentX = touch.clientX;
            rightTouch.currentY = touch.clientY;
        }
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === leftTouch.id) leftTouch.id = null;
        if (touch.identifier === rightTouch.id) rightTouch.id = null;
    }
}, { passive: false });

window.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === leftTouch.id) leftTouch.id = null;
        if (touch.identifier === rightTouch.id) rightTouch.id = null;
    }
});

// Classes
class Player {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.speed = 4;
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw player body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fill();

        // Draw player gun indicator
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.radius + 15, 0);
        ctx.strokeStyle = '#d6d6d6';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.restore();
    }

    update() {
        // Increase speed when score reaches 500
        this.speed = score >= 500 ? 7 : 4;

        if (leftTouch.id !== null) {
            const dx = leftTouch.currentX - leftTouch.startX;
            const dy = leftTouch.currentY - leftTouch.startY;
            const distance = Math.hypot(dx, dy);

            if (distance > 0) {
                const speedMultiplier = Math.min(distance / joystickRadius, 1);
                const moveX = (dx / distance) * this.speed * speedMultiplier;
                const moveY = (dy / distance) * this.speed * speedMultiplier;

                if (this.x + moveX - this.radius > 0 && this.x + moveX + this.radius < canvas.width) this.x += moveX;
                if (this.y + moveY - this.radius > 0 && this.y + moveY + this.radius < canvas.height) this.y += moveY;
            }
        } else {
            // Movement boundaries
            if (keys.w && this.y - this.radius > 0) this.y -= this.speed;
            if (keys.s && this.y + this.radius < canvas.height) this.y += this.speed;
            if (keys.a && this.x - this.radius > 0) this.x -= this.speed;
            if (keys.d && this.x + this.radius < canvas.width) this.x += this.speed;
        }

        // Mouse look (Angle calculation)
        if (rightTouch.id !== null) {
            const dx = rightTouch.currentX - rightTouch.startX;
            const dy = rightTouch.currentY - rightTouch.startY;
            if (Math.hypot(dx, dy) > 10) {
                this.angle = Math.atan2(dy, dx);
            }
        } else {
            this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        }
    }
}

class Projectile {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.fill();
    }

    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Enemy {
    constructor(x, y, radius, color, baseSpeed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.baseSpeed = baseSpeed;
        this.velocity = { x: 0, y: 0 };
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fill();
    }

    update() {
        this.draw();

        // Speed dynamically increases as score grows!
        const currentSpeed = this.baseSpeed + (score * 0.02);

        // Move towards player
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity = {
            x: Math.cos(angle) * currentSpeed,
            y: Math.sin(angle) * currentSpeed
        };
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.draw();
        this.velocity.x *= 0.99; // Friction
        this.velocity.y *= 0.99;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.01;
    }
}

// Instantiate entities
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let spawnInterval;
let animationId;

function init() {
    player = new Player(canvas.width / 2, canvas.height / 2, 20, '#4CAF50');
    projectiles = [];
    enemies = [];
    particles = [];
    score = 0;
    level = 1;
    scoreElement.innerHTML = score;
    if (levelElement) levelElement.innerHTML = level;
    isGameOver = false;
}

function shoot(overrideAngle) {
    const now = Date.now();
    if (now - lastShootTime < shootInterval) return;
    lastShootTime = now;

    const angle = overrideAngle !== undefined ? overrideAngle : Math.atan2(mouse.y - player.y, mouse.x - player.x);
    const velocity = {
        x: Math.cos(angle) * 12,
        y: Math.sin(angle) * 12
    };
    projectiles.push(new Projectile(player.x, player.y, 6, '#ffeb3b', velocity));

    playShootSound();

    // Shoot recoil effect (optional camera shake or slight backward movement)
    // player.x -= Math.cos(angle) * 2;
    // player.y -= Math.sin(angle) * 2;
}

function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const radius = Math.random() * 3 + 1;
        const velocity = {
            x: (Math.random() - 0.5) * (Math.random() * 8),
            y: (Math.random() - 0.5) * (Math.random() * 8)
        };
        particles.push(new Particle(x, y, radius, color, velocity));
    }
}

function spawnEnemies() {
    if (spawnInterval) clearInterval(spawnInterval);
    
    const spawnLogic = () => {
        if (isGameOver) return;

        let radius = Math.random() * 15 + 10;
        let baseSpeed = 1.0 + (Math.random() * 0.5);
        let spawnDelay = 1200;

        // Level-specific logic
        if (level === 2) {
            spawnDelay = 1000;
        } else if (level === 3) {
            // Level 3: Big bubbles come fast
            radius = Math.random() * 25 + 25; // Much larger
            baseSpeed = 2.5 + (Math.random() * 1.0); // Much faster base
            spawnDelay = 900;
        } else if (level === 4) {
            // Level 4: Very hard
            spawnDelay = 600; // Fast spawn
            baseSpeed = 2.0 + (Math.random() * 1.0);
        } else if (level === 5) {
            // Level 5: Extreme
            spawnDelay = 400;
            radius = Math.random() * 20 + 10;
            baseSpeed = 3.0 + (Math.random() * 1.5);
        }

        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
        }

        const color = `hsl(${Math.random() * 360}, 50%, 50%)`;
        enemies.push(new Enemy(x, y, radius, color, baseSpeed));

        // Schedule next spawn
        spawnInterval = setTimeout(spawnLogic, spawnDelay);
    };

    spawnLogic();
}

// Game Loop
function animate() {
    animationId = requestAnimationFrame(animate);

    // Clear screen with a slight fade effect (creates trail)
    ctx.fillStyle = 'rgba(26, 26, 26, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Touch shooting
    if (rightTouch.id !== null && !isGameOver) {
        const dx = rightTouch.currentX - rightTouch.startX;
        const dy = rightTouch.currentY - rightTouch.startY;
        if (Math.hypot(dx, dy) > 15) {
            const angle = Math.atan2(dy, dx);
            shoot(angle);
        }
    }

    player.update();
    player.draw();

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            p.update();
        }
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update();

        // Remove projectiles off screen
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
            projectiles.splice(i, 1);
        }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();

        // Detect collision with player (game over)
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - enemy.radius - player.radius < 1) {
            gameOver();
            return; // Stop updating after game over
        }

        // Detect collision with projectiles
        for (let j = projectiles.length - 1; j >= 0; j--) {
            const p = projectiles[j];
            const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);

            // Collision detected
            if (dist - enemy.radius - p.radius < 1) {
                // Explosion particles
                createExplosion(enemy.x, enemy.y, enemy.color, enemy.radius * 2);

                // Increase score
                score += 10;
                scoreElement.innerHTML = score;

                // Level up logic based on thresholds (max 5)
                let newLevel = level;
                for (let i = levelThresholds.length - 1; i >= 0; i--) {
                    if (score >= levelThresholds[i]) {
                        newLevel = i + 1;
                        break;
                    }
                }
                
                if (newLevel > level && level < maxLevel) {
                    level = newLevel;
                    if (levelElement) levelElement.innerHTML = level;
                    
                    // Show Level Up text effect
                    showLevelUpMessage();
                }

                // Remove enemy & projectile
                // Set timeout is a trick to avoid flash when removing from arrays during iteration
                setTimeout(() => {
                    enemies.splice(i, 1);
                    projectiles.splice(j, 1);
                }, 0);
                break; // Break inner loop because enemy is hit
            }
        }
    }

    drawJoysticks();
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    if (spawnInterval) {
        clearTimeout(spawnInterval);
        clearInterval(spawnInterval); // Safety for both types
    }

    // Create huge explosion on player
    createExplosion(player.x, player.y, player.color, 100);
    player.draw = function () { }; // hide player

    // Final render to show explosion
    ctx.fillStyle = 'rgba(26, 26, 26, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) p.update();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '24px "Segoe UI"';
    ctx.fillText('Your Score: ' + score, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillText('Max Level: ' + level, canvas.width / 2, canvas.height / 2 + 70);
    ctx.fillText('Click to play again', canvas.width / 2, canvas.height / 2 + 110);
}

function showLevelUpMessage() {
    const originalDraw = player.draw;
    let frame = 0;
    const maxFrames = 60;
    
    // Simple temporary overlay for Level Up
    const drawLevelUp = () => {
        if (frame < maxFrames) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 255, 255, ${1 - frame/maxFrames})`;
            ctx.font = 'bold 36px "Segoe UI"';
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL UP!', canvas.width / 2, canvas.height / 2 - 100);
            ctx.restore();
            frame++;
            requestAnimationFrame(drawLevelUp);
        }
    };
    drawLevelUp();
}

function resetGame() {
    init();
    spawnEnemies();
    animate();
}

function drawJoysticks() {
    ctx.lineWidth = 2;
    if (leftTouch.id !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(leftTouch.startX, leftTouch.startY, joystickRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();

        ctx.beginPath();
        const dx = leftTouch.currentX - leftTouch.startX;
        const dy = leftTouch.currentY - leftTouch.startY;
        const distance = Math.min(Math.hypot(dx, dy), joystickRadius);
        const angle = Math.atan2(dy, dx);
        const knobX = leftTouch.startX + Math.cos(angle) * distance;
        const knobY = leftTouch.startY + Math.sin(angle) * distance;

        ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
        ctx.restore();
    }

    if (rightTouch.id !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(rightTouch.startX, rightTouch.startY, joystickRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();

        ctx.beginPath();
        const dx = rightTouch.currentX - rightTouch.startX;
        const dy = rightTouch.currentY - rightTouch.startY;
        const distance = Math.min(Math.hypot(dx, dy), joystickRadius);
        const angle = Math.atan2(dy, dx);
        const knobX = rightTouch.startX + Math.cos(angle) * distance;
        const knobY = rightTouch.startY + Math.sin(angle) * distance;

        ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
        ctx.restore();
    }
}

function startGame() {
    startScreen.style.opacity = '0';
    setTimeout(() => {
        startScreen.style.display = 'none';
        init();
        spawnEnemies();
        animate();
        initAudio(); // Initialize audio context on first purposeful click
        canvas.requestPointerLock(); // Lock the mouse
    }, 500);
}

startButton.addEventListener('click', startGame);

// Remove automatic start at the bottom
// init();
// spawnEnemies();
// animate();
