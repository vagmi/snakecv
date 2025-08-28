import './style.css'
import {
    FaceLandmarker,
    FilesetResolver,
    type FaceLandmarkerResult,
    type NormalizedLandmark
} from "@mediapipe/tasks-vision";

// DOM Elements
const video = document.getElementById("video") as HTMLVideoElement;
const gameCanvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const gameCtx = gameCanvas.getContext("2d")!;
const scoreEl = document.getElementById("score")!;
const livesEl = document.getElementById("lives")!;
const startButton = document.getElementById("start-button") as HTMLButtonElement;
const loadingOverlay = document.getElementById("loading-overlay")!;
const loadingMessage = document.getElementById("loading-message")!;
const errorMessage = document.getElementById("error-message")!;

// Game state
let faceLandmarker: FaceLandmarker;
let lastVideoTime = -1;
let gameRunning = false;
let gameLoopId: number;
let neutralChinPosition: { x: number; y: number } | null = null;

// New state for smoothing
interface HeadPose {
    timestamp: number;
    x: number;
    y: number;
}
const poseHistory: HeadPose[] = [];
const SMOOTHING_DURATION = 200; // 200ms for responsiveness

// Breakout Game Variables
const paddleHeight = 15;
const paddleWidth = 120;
let paddleX = (gameCanvas.width - paddleWidth) / 2;

const ballRadius = 10;
let ballX = gameCanvas.width / 2;
let ballY = gameCanvas.height - 30;
let ballDX = 4;
let ballDY = -4;

let score = 0;
let lives = 3;

// Brick variables
const brickRowCount = 5;
const brickColumnCount = 7;
const brickWidth = 75;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 30;
const brickOffsetLeft = 30;

type Brick = { x: number; y: number; status: number };
let bricks: Brick[][] = [];

// --- MEDIA PIPE SETUP ---
async function createFaceLandmarker() {
    try {
        loadingMessage.textContent = "Loading vision model...";
        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
        });
        loadingMessage.textContent = "Vision model loaded. Enabling webcam...";
        await enableWebcam();
    } catch (error) {
        console.error("Error creating FaceLandmarker:", error);
        errorMessage.textContent = "Failed to load the vision model. Please refresh the page.";
        loadingOverlay.style.display = 'none';
    }
}

// --- WEBCAM SETUP ---
async function enableWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
             loadingOverlay.style.display = 'none';
             startButton.disabled = false;
             startButton.style.opacity = "1";
             predictWebcam();
        });
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        errorMessage.textContent = "Could not access webcam. Please allow camera permissions and refresh.";
        loadingOverlay.style.display = 'none';
    }
}

// --- VISION PROCESSING ---
async function predictWebcam() {
    const videoTime = video.currentTime;
    if (videoTime !== lastVideoTime) {
        lastVideoTime = videoTime;
        const results: FaceLandmarkerResult | undefined = faceLandmarker.detectForVideo(video, Date.now());
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            processLandmarks(results.faceLandmarks[0]);
        }
    }
    window.requestAnimationFrame(predictWebcam);
}

function processLandmarks(landmarks: NormalizedLandmark[]) {
    const chin = landmarks[152];
    if (!chin) return;

    if (gameRunning && !neutralChinPosition) {
        neutralChinPosition = { x: chin.x, y: chin.y };
    }

    const now = Date.now();
    poseHistory.push({ timestamp: now, x: chin.x, y: chin.y });

    const cutoff = now - SMOOTHING_DURATION;
    while (poseHistory.length > 0 && poseHistory[0].timestamp < cutoff) {
        poseHistory.shift();
    }

    if (poseHistory.length === 0) return;

    const avgX = poseHistory.reduce((sum, p) => sum + p.x, 0) / poseHistory.length;
    
    let targetPaddleX: number;

    // Aim-assist logic
    if (gameRunning && ballDY > 0 && neutralChinPosition) { // Ball is coming down and game is on
        const hDiff = avgX - neutralChinPosition.x;
        const horizontalThreshold = 0.02;
        
        let userDirection: 'left' | 'right' | 'none' = 'none';
        // video is mirrored. If user moves head right, chin.x increases.
        if (hDiff > horizontalThreshold) {
            userDirection = 'left'; // User moved head left
        } else if (hDiff < -horizontalThreshold) {
            userDirection = 'right'; // User moved head right
        }

        const ballIsMovingRight = ballDX > 0;
        const requiredDirection = ballIsMovingRight ? 'right' : 'left';

        if (userDirection === requiredDirection) {
            // Snap paddle to ball's X position
            targetPaddleX = ballX - paddleWidth / 2;
        } else {
            // If user moves wrong way or not at all, use direct control
            targetPaddleX = (1 - avgX) * gameCanvas.width - (paddleWidth / 2);
        }
    } else {
        // Default direct control when game not running, ball going up, or neutral not set
        targetPaddleX = (1 - avgX) * gameCanvas.width - (paddleWidth / 2);
    }
    
    // Apply movement with easing for smoothness
    paddleX += (targetPaddleX - paddleX) * 0.2;

    // Clamp paddle position to be within canvas bounds
    paddleX = Math.max(0, Math.min(gameCanvas.width - paddleWidth, paddleX));
}

// --- BREAKOUT GAME LOGIC ---
function initializeBricks() {
    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRowCount; r++) {
            bricks[c][r] = { x: 0, y: 0, status: 1 };
        }
    }
}

function resetGame() {
    score = 0;
    lives = 3;
    scoreEl.textContent = String(score);
    livesEl.textContent = String(lives);
    
    ballX = gameCanvas.width / 2;
    ballY = gameCanvas.height - 30;
    ballDX = 4;
    ballDY = -4;
    paddleX = (gameCanvas.width - paddleWidth) / 2;

    neutralChinPosition = null;
    initializeBricks();
}

function collisionDetection() {
    // Brick collision
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const b = bricks[c][r];
            if (b.status === 1) {
                if (
                    ballX > b.x &&
                    ballX < b.x + brickWidth &&
                    ballY > b.y &&
                    ballY < b.y + brickHeight
                ) {
                    ballDY = -ballDY;
                    b.status = 0;
                    score++;
                    scoreEl.textContent = String(score);
                    if (score === brickRowCount * brickColumnCount) {
                        winGame();
                    }
                }
            }
        }
    }
}

function drawBall() {
    gameCtx.beginPath();
    gameCtx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    gameCtx.fillStyle = "#4ade80"; // Green
    gameCtx.fill();
    gameCtx.closePath();
}

function drawPaddle() {
    gameCtx.beginPath();
    gameCtx.rect(paddleX, gameCanvas.height - paddleHeight, paddleWidth, paddleHeight);
    gameCtx.fillStyle = "#60a5fa"; // Light Blue
    gameCtx.fill();
    gameCtx.closePath();
}

function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1) {
                const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
                const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
                bricks[c][r].x = brickX;
                bricks[c][r].y = brickY;
                gameCtx.beginPath();
                gameCtx.rect(brickX, brickY, brickWidth, brickHeight);
                gameCtx.fillStyle = "#f97316"; // Orange
                gameCtx.fill();
                gameCtx.closePath();
            }
        }
    }
}

function draw() {
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent background
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    drawBricks();
    drawPaddle();
    drawBall();
    collisionDetection();

    // Ball movement and wall collision
    if (ballX + ballDX > gameCanvas.width - ballRadius || ballX + ballDX < ballRadius) {
        ballDX = -ballDX;
    }
    if (ballY + ballDY < ballRadius) {
        ballDY = -ballDY;
    } else if (ballY + ballDY > gameCanvas.height - ballRadius) {
        // Collision with paddle
        if (ballX > paddleX && ballX < paddleX + paddleWidth) {
            ballDY = -ballDY;
        } else {
            lives--;
            livesEl.textContent = String(lives);
            if (!lives) {
                endGame("Game Over");
            } else {
                ballX = gameCanvas.width / 2;
                ballY = gameCanvas.height - 30;
                ballDX = 4;
                ballDY = -4;
                paddleX = (gameCanvas.width - paddleWidth) / 2;
            }
        }
    }

    ballX += ballDX;
    ballY += ballDY;
}

function gameLoop() {
    draw();
    if (gameRunning) {
        gameLoopId = requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    if (gameRunning) {
        // This is now a restart button
        resetGame();
        return;
    }
    gameRunning = true;
    startButton.textContent = "Restart Game";
    startButton.style.backgroundColor = "#f97316"; // Orange
    resetGame();
    gameLoop();
}

function endGame(message: string) {
    gameRunning = false;
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.fillStyle = 'white';
    gameCtx.font = '40px "Press Start 2P"';
    gameCtx.textAlign = 'center';
    gameCtx.fillText(message, gameCanvas.width / 2, gameCanvas.height / 2 - 20);
    gameCtx.font = '20px "Press Start 2P"';
    gameCtx.fillText(`Final Score: ${score}`, gameCanvas.width / 2, gameCanvas.height / 2 + 20);
    startButton.textContent = "Play Again";
    startButton.style.backgroundColor = "#2563eb"; // Blue
}

function winGame() {
    endGame("You Win!");
}

// --- INITIALIZATION ---
startButton.addEventListener('click', startGame);

// Disable button until models are loaded
startButton.disabled = true;
startButton.style.opacity = "0.5";

// Start the process
createFaceLandmarker();

// Initial Draw
initializeBricks();
draw();
