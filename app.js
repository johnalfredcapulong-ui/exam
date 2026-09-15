// app.js

// Global State
let currentStudent = null;
let examState = {
    currentQuestionIndex: 0,
    examScore: 0,
    colorScore: 0,
    isCompleted: false
};

let currentQuestion = null;
let targetRGB = { r: 0, g: 0, b: 0 };

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const examScreen = document.getElementById('exam-screen');
const colorGameScreen = document.getElementById('color-game-screen');
const loginForm = document.getElementById('login-form');
const passcodeInput = document.getElementById('passcode-input');
const loginError = document.getElementById('login-error');
const studentNameDisplay = document.getElementById('student-name-display');
const currentScoreDisplay = document.getElementById('current-score');

const questionTextEl = document.getElementById('question-text');
const questionInstructionEl = document.getElementById('question-instruction');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const feedbackMsg = document.getElementById('feedback-msg');

const targetColorBox = document.getElementById('target-color-box');
const colorPicker = document.getElementById('color-picker');
const submitColorBtn = document.getElementById('submit-color-btn');
const colorResult = document.getElementById('color-result');
const colorScoreDisplay = document.getElementById('color-score-display');
const colorFinalMsg = document.getElementById('color-final-msg');

const TOTAL_QUESTIONS = 10;

// --- LOGIN LOGIC ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passcode = passcodeInput.value.trim().toUpperCase();
    loginError.textContent = '';
    if (!passcode) return;

    try {
        const { data: studentData, error: studentError } = await supabaseClient
            .from('students').select('*').eq('passcode', passcode).maybeSingle();

        if (studentError) throw new Error(`DB Error: ${studentError.message}`);
        if (!studentData) throw new Error("Passcode not found in database.");
        currentStudent = studentData;

        const { data: resultData, error: resultError } = await supabaseClient
            .from('exam_results').select('*').eq('student_passcode', passcode).maybeSingle();

        if (resultError) throw new Error(`Result Error: ${resultError.message}`);

        if (resultData) {
            examState = {
                currentQuestionIndex: resultData.current_question_index,
                examScore: resultData.exam_score,
                colorScore: resultData.color_score,
                isCompleted: resultData.is_completed
            };
        } else {
            const { error: insertError } = await supabaseClient
                .from('exam_results').insert([{ student_passcode: passcode }]);
            if (insertError) throw new Error(`Insert Error: ${insertError.message}`);
        }

        showExamScreen();

    } catch (error) {
        loginError.textContent = error.message;
        passcodeInput.value = '';
    }
});

function showExamScreen() {
    loginScreen.classList.add('hidden');
    
    // If exam is completed, go straight to color game
    if (examState.isCompleted) {
        startColorGame();
        return;
    }

    examScreen.classList.remove('hidden');
    studentNameDisplay.textContent = currentStudent.student_name || currentStudent.passcode;
    currentScoreDisplay.textContent = examState.examScore;
    loadQuestion();
}

// --- QUESTION GENERATION ---
function generateQuestion(index) {
    const typeIndex = index % 6;
    let questionText = "";
    let instruction = "";
    let correctAnswer = "";

    const randomDec = Math.floor(Math.random() * 200) + 1;
    const randomCharCode = Math.floor(Math.random() * 26) + 65;
    const randomChar = String.fromCharCode(randomCharCode);

    switch(typeIndex) {
        case 0: // Binary -> Decimal
            questionText = randomDec.toString(2);
            instruction = "Convert this Binary number to Decimal:";
            correctAnswer = randomDec.toString();
            break;
        case 1: // Decimal -> Binary
            questionText = randomDec.toString();
            instruction = "Convert this Decimal number to Binary:";
            correctAnswer = randomDec.toString(2);
            break;
        case 2: // Binary -> ASCII
            questionText = randomCharCode.toString(2).padStart(8, '0');
            instruction = "Convert this Binary to its ASCII Character:";
            correctAnswer = randomChar;
            break;
        case 3: // ASCII -> Binary
            questionText = randomChar;
            instruction = "Convert this ASCII Character to Binary (8 bits):";
            correctAnswer = randomCharCode.toString(2).padStart(8, '0');
            break;
        case 4: // Decimal -> ASCII
            questionText = randomCharCode.toString();
            instruction = "Convert this Decimal to its ASCII Character:";
            correctAnswer = randomChar;
            break;
        case 5: // ASCII -> Decimal
            questionText = randomChar;
            instruction = "Convert this ASCII Character to Decimal:";
            correctAnswer = randomCharCode.toString();
            break;
    }

    return { questionText, instruction, correctAnswer };
}

function loadQuestion() {
    if (examState.currentQuestionIndex >= TOTAL_QUESTIONS) {
        finishExam();
        return;
    }

    currentQuestion = generateQuestion(examState.currentQuestionIndex);
    questionInstructionEl.textContent = currentQuestion.instruction;
    questionTextEl.textContent = currentQuestion.questionText;
    answerInput.value = '';
    answerInput.disabled = false;
    feedbackMsg.textContent = '';
    feedbackMsg.className = '';
    answerInput.focus();
}

// --- ANSWER VALIDATION ---
answerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userAnswer = answerInput.value.trim();
    if (!userAnswer) return;

    if (userAnswer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase()) {
        feedbackMsg.textContent = "Correct! Loading next question...";
        feedbackMsg.className = "correct";
        answerInput.disabled = true;

        examState.examScore += 1;
        examState.currentQuestionIndex += 1;
        currentScoreDisplay.textContent = examState.examScore;

        await saveProgress();

        setTimeout(() => {
            loadQuestion();
        }, 800);

    } else {
        feedbackMsg.textContent = "Incorrect. Try again!";
        feedbackMsg.className = "wrong";
        answerInput.value = '';
        answerInput.focus();
    }
});

// --- SAVE PROGRESS TO SUPABASE ---
async function saveProgress() {
    const { error } = await supabaseClient
        .from('exam_results')
        .update({
            current_question_index: examState.currentQuestionIndex,
            exam_score: examState.examScore,
            last_updated: new Date().toISOString()
        })
        .eq('student_passcode', currentStudent.passcode);

    if (error) console.error("Failed to save progress:", error);
}

// --- FINISH EXAM & START COLOR GAME ---
async function finishExam() {
    examState.isCompleted = true;
    
    const { error } = await supabaseClient
        .from('exam_results')
        .update({ is_completed: true, exam_score: examState.examScore })
        .eq('student_passcode', currentStudent.passcode);
    
    if (error) console.error("Error finishing exam:", error);
    
    // Transition to Color Game
    startColorGame();
}

// --- COLOR MATCHING GAME ---
function startColorGame() {
    examScreen.classList.add('hidden');
    colorGameScreen.classList.remove('hidden');

    // Generate random target RGB
    targetRGB = {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256)
    };

    // Apply target color to the box
    targetColorBox.style.backgroundColor = `rgb(${targetRGB.r}, ${targetRGB.g}, ${targetRGB.b})`;
    
    // Reset color picker to a neutral value
    colorPicker.value = '#808080';
    colorResult.classList.add('hidden');
    submitColorBtn.disabled = false;
}

submitColorBtn.addEventListener('click', async () => {
    // Get user picked color
    const hex = colorPicker.value;
    const userRGB = {
        r: parseInt(hex.substr(1, 2), 16),
        g: parseInt(hex.substr(3, 2), 16),
        b: parseInt(hex.substr(5, 2), 16)
    };

    // Calculate Euclidean distance
    const rDiff = targetRGB.r - userRGB.r;
    const gDiff = targetRGB.g - userRGB.g;
    const bDiff = targetRGB.b - userRGB.b;
    const distance = Math.sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff);

    // Maximum distance in RGB space is sqrt(3 * 255^2) ≈ 441.67
    const maxDistance = Math.sqrt(3 * (255 * 255));
    
    // Calculate Score (100% = exact match, 0% = furthest possible)
    let score = Math.max(0, 100 - (distance / maxDistance) * 100);
    score = Math.round(score);

    examState.colorScore = score;

    // Save to Supabase
    const { error } = await supabaseClient
        .from('exam_results')
        .update({ color_score: score })
        .eq('student_passcode', currentStudent.passcode);

    if (error) console.error("Error saving color score:", error);

    // Show results
    submitColorBtn.disabled = true;
    colorResult.classList.remove('hidden');
    colorScoreDisplay.textContent = `Color Score: ${score}%`;
    
    if (score === 100) {
        colorFinalMsg.textContent = "Perfect Match! 🎯";
    } else if (score >= 90) {
        colorFinalMsg.textContent = "Excellent eye! 👏";
    } else if (score >= 70) {
        colorFinalMsg.textContent = "Pretty close! 👍";
    } else {
        colorFinalMsg.textContent = "Not quite, but good effort! 🎨";
    }
});