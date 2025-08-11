# Snake Head: Vision-Controlled Snake Game

This is a modern implementation of the classic snake game, with a twist: you control the snake with your head! Using your webcam and the power of MediaPipe's FaceLandmarker, this game tracks your head movements in real-time to guide the snake on the screen.

## Features

- **Vision-Based Controls**: Look up, down, left, or right to direct the snake.
- **Real-time Video Background**: See yourself playing with the webcam feed displayed behind the game.
- **Classic Gameplay, Modern Tech**: Enjoy the nostalgic snake game, rebuilt with a modern web stack.
- **Win Condition**: The game ends when you collect 5 pieces of food.
- **Scoring and Timer**: Track your score and how long it takes to win.
- **Screen Wrapping**: The snake can travel through walls and appear on the opposite side.

## How to Play

1.  **Start the Game**: Open the game in your browser and click the "Start Game" button.
2.  **Allow Webcam Access**: Your browser will ask for permission to use your webcam. Please allow it.
3.  **Calibrate**: The game will use your head position at the moment you click "Start" as the neutral center.
4.  **Control the Snake**:
    - Look **up** to move the snake up.
    - Look **down** to move the snake down.
    - Look **left** to move the snake left.
    - Look **right** to move the snake right.
5.  **Objective**: Eat the red food blocks to score points and make your snake grow.
6.  **Win/Lose**:
    - You win by collecting 5 food blocks.
    - You lose if the snake collides with itself.

## Setup and Installation

To run this project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <repo-directory>
    ```

2.  **Install dependencies:**
    This project uses `pnpm` as the package manager.
    ```bash
    pnpm install
    ```

3.  **Run the development server:**
    ```bash
    pnpm run dev
    ```

4.  **Open in browser:**
    Navigate to the local URL provided by Vite (usually `http://localhost:5173`).

## Technologies Used

- **Framework**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Computer Vision**: [MediaPipe FaceLandmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
