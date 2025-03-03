import { GoogleGenerativeAI } from "@google/generative-ai";
import md from "markdown-it";

// Initialize markdown parser with proper syntax highlighting
const markdown = md({
  html: true,
  linkify: true,
  typographer: true,
});

// Initialize the model
const genAI = new GoogleGenerativeAI(`${import.meta.env.VITE_API_KEY}`);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
let history = [];
let isProcessing = false;

// Scroll to bottom of chat container
const scrollToBottom = () => {
  const chatArea = document.getElementById("chat-container");
  chatArea.scrollTop = chatArea.scrollHeight;
};

// Show loading indicator
const showLoading = () => {
  const chatArea = document.getElementById("chat-container");
  chatArea.innerHTML += `
    <div class="message bot-message loading-message" id="loading-indicator">
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  scrollToBottom();
};

// Remove loading indicator
const removeLoading = () => {
  const loadingMessage = document.getElementById("loading-indicator");
  if (loadingMessage) {
    loadingMessage.remove();
  }
};

// Handle errors gracefully
const handleError = (error) => {
  const chatArea = document.getElementById("chat-container");
  removeLoading();
  chatArea.innerHTML += `
    <div class="message bot-message error-message">
      <p>I'm sorry, but I encountered an error processing your request. Please try again later.</p>
      <p class="error-details">Error: ${error.message}</p>
    </div>
  `;
  scrollToBottom();
  isProcessing = false;
};

// Get response from AI model
async function getResponse(prompt) {
  try {
    showLoading();
    const chat = await model.startChat({ history: history });
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();
    removeLoading();
    return text;
  } catch (error) {
    console.error("Error getting response:", error);
    handleError(error);
    return null;
  }
}

// User chat message component
export const userDiv = (data) => {
  return `<div class="message user-message">${data}</div>`;
};

// AI chat message component
export const aiDiv = (data) => {
  return `<div class="message bot-message">${data}</div>`;
};

// Handle form submission
async function handleSubmit(event) {
  event.preventDefault();
  
  // Prevent multiple submissions while processing
  if (isProcessing) return;
  
  let userMessage = document.getElementById("prompt");
  const chatArea = document.getElementById("chat-container");
  const prompt = userMessage.value.trim();
  
  if (prompt === "") {
    return;
  }
  
  isProcessing = true;
  
  // Add user message to chat
  chatArea.innerHTML += userDiv(prompt);
  scrollToBottom();
  
  // Clear input field
  userMessage.value = "";
  
  // Get AI response
  const aiResponse = await getResponse(prompt);
  
  // If there was an error, don't continue
  if (!aiResponse) {
    isProcessing = false;
    return;
  }
  
  // Render markdown and add AI response to chat
  let renderedResponse = markdown.render(aiResponse);
  chatArea.innerHTML += aiDiv(renderedResponse);
  scrollToBottom();
  
  // Update conversation history
  history.push({
    role: "user",
    parts: prompt,
  });
  
  history.push({
    role: "model",
    parts: aiResponse,
  });
  
  isProcessing = false;
}

// Initialize event listeners when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const promptInput = document.getElementById("prompt");
  
  // Handle form submission
  chatForm.addEventListener("submit", handleSubmit);
  
  // Auto-resize textarea as user types
  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + "px";
  });
  
  // Handle Enter key for submission (Shift+Enter for new line)
  promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  });
  
  // Focus input field on page load
  promptInput.focus();
  
  // Add CSS for loading animation
  const style = document.createElement("style");
  style.textContent = `
    .loading-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
    }
    
    .loading-dots span {
      width: 8px;
      height: 8px;
      background-color: var(--accent-color);
      border-radius: 50%;
      display: inline-block;
      animation: bounce 1.4s infinite ease-in-out both;
    }
    
    .loading-dots span:nth-child(1) {
      animation-delay: -0.32s;
    }
    
    .loading-dots span:nth-child(2) {
      animation-delay: -0.16s;
    }
    
    @keyframes bounce {
      0%, 80%, 100% { 
        transform: scale(0);
      } 40% { 
        transform: scale(1.0);
      }
    }
    
    .error-message {
      border-left: 4px solid #f44336;
    }
    
    .error-details {
      font-size: 0.8rem;
      color: #f44336;
      margin-top: 8px;
    }
  `;
  document.head.appendChild(style);
});
