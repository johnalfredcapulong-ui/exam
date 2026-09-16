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
let userRGB = { r: 128, g: 128, b: 128 };
let isProcessingAnswer = false; // Prevents spam clicking

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
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const feedbackMsg = document.getElementById('feedback-msg');

const targetColorBox = document.getElementById('target-color-box');
const userColorPreview = document.getElementById('user-color-preview');
const redSlider = document.getElementById('red-slider');
const greenSlider = document.getElementById('green-slider');
const blueSlider = document.getElementById('blue-slider');
const redVal = document.getElementById('red-val');
const greenVal = document.getElementById('green-val');
const blueVal = document.getElementById('blue-val');
const submitColorBtn = document.getElementById('submit-color-btn');
const colorResult = document.getElementById('color-result');
const colorScoreDisplay = document.getElementById('color-score-display');
const colorFinalMsg = document.getElementById('color-final-msg');

const completionModal = document.getElementById('completion-modal');
const modalSummaryText = document.getElementById('modal-summary-text');
const closeModalBtn = document.getElementById('close-modal-btn');

const TOTAL_QUESTIONS = 20;

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
    
    if (examState.isCompleted) {
        startColorGame();
        return;
    }

    examScreen.classList.remove('hidden');
    studentNameDisplay.textContent = currentStudent.student_name || currentStudent.passcode;
    currentScoreDisplay.textContent = examState.examScore;
    loadQuestion();
}

// --- QUESTION GENERATION (ASCII Range 32-127) ---
function generateQuestion(index) {
    const typeIndex = index % 6;
    let questionText = "";
    let instruction = "";
    let correctAnswer = "";

    const randomDec = Math.floor(Math.random() * (127 - 32 + 1)) + 32;
    const randomCharCode = Math.floor(Math.random() * (127 - 32 + 1)) + 32;
    const randomChar = String.fromCharCode(randomCharCode);

    switch(typeIndex) {
        case 0: // Binary -> Decimal
            questionText = randomDec.toString(2).padStart(8, '0');
            instruction = "Convert this Binary number to Decimal:";
            correctAnswer = randomDec.toString();
            break;
        case 1: // Decimal -> Binary
            questionText = randomDec.toString();
            instruction = "Convert this Decimal number to Binary (8 bits):";
            correctAnswer = randomDec.toString(2).padStart(8, '0');
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
    submitAnswerBtn.disabled = false; // Re-enable button
    isProcessingAnswer = false;       // Reset processing flag
    feedbackMsg.textContent = '';
    feedbackMsg.className = '';
    answerInput.focus();
}

// --- ANSWER VALIDATION ---
answerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 1. BLOCK SPAM CLICKING
    if (isProcessingAnswer) return;
    isProcessingAnswer = true;
    submitAnswerBtn.disabled = true; // Instantly disable button

    const userAnswer = answerInput.value.trim();
    if (!userAnswer) {
        isProcessingAnswer = false;
        submitAnswerBtn.disabled = false;
        return;
    }

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
        
        // 2. UNBLOCK ON INCORRECT
        isProcessingAnswer = false;
        submitAnswerBtn.disabled = false;
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
    
    startColorGame();
}

// --- COLOR MATCHING GAME ---
function startColorGame() {
    examScreen.classList.add('hidden');
    colorGameScreen.classList.remove('hidden');

    targetRGB = {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256)
    };

    targetColorBox.style.backgroundColor = `rgb(${targetRGB.r}, ${targetRGB.g}, ${targetRGB.b})`;
    
    redSlider.value = 128;
    greenSlider.value = 128;
    blueSlider.value = 128;
    updateUserColor();

    colorResult.classList.add('hidden');
    submitColorBtn.disabled = false;
}

function updateUserColor() {
    userRGB.r = parseInt(redSlider.value);
    userRGB.g = parseInt(greenSlider.value);
    userRGB.b = parseInt(blueSlider.value);

    redVal.textContent = userRGB.r;
    greenVal.textContent = userRGB.g;
    blueVal.textContent = userRGB.b;

    userColorPreview.style.backgroundColor = `rgb(${userRGB.r}, ${userRGB.g}, ${userRGB.b})`;
}

redSlider.addEventListener('input', updateUserColor);
greenSlider.addEventListener('input', updateUserColor);
blueSlider.addEventListener('input', updateUserColor);

// --- SUBMIT COLOR & SHOW FINAL MODAL ---
submitColorBtn.addEventListener('click', async () => {
    submitColorBtn.disabled = true;

    const rDiff = targetRGB.r - userRGB.r;
    const gDiff = targetRGB.g - userRGB.g;
    const bDiff = targetRGB.b - userRGB.b;
    const distance = Math.sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff);

    const maxDistance = Math.sqrt(3 * (255 * 255));
    
    let score = Math.max(0, 100 - (distance / maxDistance) * 100);
    score = Math.round(score);

    examState.colorScore = score;

    const { error } = await supabaseClient
        .from('exam_results')
        .update({ color_score: score })
        .eq('student_passcode', currentStudent.passcode);

    if (error) console.error("Error saving color score:", error);

    // Show result box
    colorResult.classList.remove('hidden');
    colorScoreDisplay.textContent = `Color Score: ${score}%`;
    
    if (score === 100) {
        colorFinalMsg.textContent = "Perfect Match!";
    } else if (score >= 90) {
        colorFinalMsg.textContent = "Excellent eye!";
    } else if (score >= 70) {
        colorFinalMsg.textContent = "Pretty close!";
    } else {
        colorFinalMsg.textContent = "Good effort!";
    }

    // Show the final Pop-Up
    modalSummaryText.textContent = `You scored ${examState.examScore} / ${TOTAL_QUESTIONS} on the conversion questions, and ${score}% on the color match. Your results have been saved.`;
    completionModal.classList.remove('hidden');
});

// Close Modal Button
closeModalBtn.addEventListener('click', () => {
    completionModal.classList.add('hidden');
});