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
const timerEl = document.getElementById("timer")!;
const startButton = document.getElementById("start-button") as HTMLButtonElement;
const loadingOverlay = document.getElementById("loading-overlay")!;
const loadingMessage = document.getElementById("loading-message")!;
const errorMessage = document.getElementById("error-message")!;

// Game state
let faceLandmarker: FaceLandmarker;
let lastVideoTime = -1;
let gameRunning = false;
let gameLoopId: number;
let startTime: number;
const MAX_SCORE = 5;
let neutralChinPosition: { x: number; y: number } | null = null;

// New state for smoothing
interface HeadPose {
    timestamp: number;
    x: number;
    y: number;
}
const poseHistory: HeadPose[] = [];
const SMOOTHING_DURATION = 500; // 500ms

type Direction = 'up' | 'down' | 'left' | 'right';

// Snake Game Variables
const gridSize = 20;
let snake: { x: number, y: number }[] = [{ x: 15, y: 15 }];
let food: { x: number, y: number } = {} as any;
let direction: Direction = 'right';
let newDirection: Direction = 'right';
let score = 0;

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
        // First frame with a chin after game start, set it as neutral center
        neutralChinPosition = { x: chin.x, y: chin.y };
    }

    // Add current chin position to history
    const now = Date.now();
    poseHistory.push({ timestamp: now, x: chin.x, y: chin.y });

    // Remove old poses from history
    const cutoff = now - SMOOTHING_DURATION;
    while (poseHistory.length > 0 && poseHistory[0].timestamp < cutoff) {
        poseHistory.shift();
    }

    if (poseHistory.length === 0 || !neutralChinPosition) return;

    // Calculate average position
    const avgX = poseHistory.reduce((sum, p) => sum + p.x, 0) / poseHistory.length;
    const avgY = poseHistory.reduce((sum, p) => sum + p.y, 0) / poseHistory.length;
    
    // Compare smoothed position to neutral position
    const hDiff = avgX - neutralChinPosition.x;
    const vDiff = avgY - neutralChinPosition.y;

    const horizontalThreshold = 0.03;
    const verticalThreshold = 0.01;

    // video is mirrored. If user moves head right, chin.x increases.
    if (hDiff > horizontalThreshold && direction !== 'right') {
        newDirection = 'left';
    } else if (hDiff < -horizontalThreshold && direction !== 'left') {
        newDirection = 'right';
    } else if (vDiff < -verticalThreshold && direction !== 'down') {
        newDirection = 'up';
    } else if (vDiff > verticalThreshold && direction !== 'up') {
        newDirection = 'down';
    }
    console.log(`Direction: ${newDirection}, Chin Position: (${chin.x}, ${chin.y})`);
}

// --- SNAKE GAME LOGIC ---
function resetGame() {
    snake = [{ x: 15, y: 15 }];
    direction = 'right';
    newDirection = 'right';
    score = 0;
    scoreEl.textContent = String(score);
    placeFood();
    neutralChinPosition = null;
}

function placeFood() {
    const gridWidth = gameCanvas.width / gridSize;
    const gridHeight = gameCanvas.height / gridSize;
    food = {
        x: Math.floor(Math.random() * (gridWidth - 2)),
        y: Math.floor(Math.random() * (gridHeight - 2))
    };
    // Ensure food doesn't spawn on the snake
    for (let segment of snake) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (segment.x === food.x + i && segment.y === food.y + j) {
                    placeFood();
                    return;
                }
            }
        }
    }
}

function draw() {
    // Clear canvas for full transparency to see video background
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent background
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Draw food
    gameCtx.fillStyle = '#ef4444'; // Red
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            gameCtx.fillRect((food.x + i) * gridSize, (food.y + j) * gridSize, gridSize - 1, gridSize - 1);
        }
    }

    // Draw snake
    for (let i = 0; i < snake.length; i++) {
        gameCtx.fillStyle = (i === 0) ? '#4ade80' : '#22c55e'; // Green shades
        gameCtx.fillRect(snake[i].x * gridSize, snake[i].y * gridSize, gridSize - 1, gridSize - 1);
    }
}

function update() {
    direction = newDirection;
    const head = { x: snake[0].x, y: snake[0].y };

    // Move head
    if (direction === 'right') head.x++;
    if (direction === 'left') head.x--;
    if (direction === 'up') head.y--;
    if (direction === 'down') head.y++;

    // Wrap snake position on edge collision
    const gridWidth = gameCanvas.width / gridSize;
    const gridHeight = gameCanvas.height / gridSize;

    if (head.x < 0) {
        head.x = gridWidth - 1;
    } else if (head.x >= gridWidth) {
        head.x = 0;
    }

    if (head.y < 0) {
        head.y = gridHeight - 1;
    } else if (head.y >= gridHeight) {
        head.y = 0;
    }

    // Check for self-collision
    if (checkSelfCollision(head)) {
        endGame();
        return;
    }

    snake.unshift(head);

    // Check for food
    if (
        head.x >= food.x && head.x < food.x + 3 &&
        head.y >= food.y && head.y < food.y + 3
    ) {
        score++;
        scoreEl.textContent = String(score);
        if (score >= MAX_SCORE) {
            endGame();
            return;
        }
        placeFood();
    } else {
        snake.pop();
    }
}

function checkSelfCollision(head: { x: number, y: number }) {
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}

function gameLoop() {
    update();
    draw();

    if (gameRunning) {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        timerEl.textContent = `${elapsedTime}s`;
    }
}

function startGame() {
    if (gameRunning) return;
    gameRunning = true;
    startTime = Date.now();
    timerEl.textContent = '0.0s';
    startButton.textContent = "Restart Game";
    startButton.style.backgroundColor = "#f97316"; // Orange
    resetGame();
    // Vision prediction loop is already running
    gameLoopId = setInterval(gameLoop, 150);
}

function endGame() {
    gameRunning = false;
    clearInterval(gameLoopId);
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.fillStyle = 'white';
    gameCtx.font = '40px "Press Start 2P"';
    gameCtx.textAlign = 'center';
    gameCtx.fillText('Game Over', gameCanvas.width / 2, gameCanvas.height / 2 - 20);
    gameCtx.font = '20px "Press Start 2P"';
    gameCtx.fillText(`Final Score: ${score}`, gameCanvas.width / 2, gameCanvas.height / 2 + 20);
    startButton.textContent = "Play Again";
    startButton.style.backgroundColor = "#4ade80"; // Green
}

// --- INITIALIZATION ---
startButton.addEventListener('click', startGame);

// Disable button until models are loaded
startButton.disabled = true;
startButton.style.opacity = "0.5";

// Start the process
createFaceLandmarker();

// Initial Draw
draw();
